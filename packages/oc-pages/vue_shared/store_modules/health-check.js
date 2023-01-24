const HEALTH_CHECK_PATH = '/__unfurl/proxy_health'
import {sleep} from '../client_utils/misc'
import Vue from 'vue'
import {XHR_JAIL_URL} from '../storage-keys';

const BASE_POLLING_INTERVAL = 1000
const BACKOFF_EXPONENT = 1.25
const DEFAULT_STARTUP_ESTIMATE = 5 * 60 * 10000// 5 minutes

function genUid() {
    return Math.random().toString(36).slice(-6)
}

class XhrIFrame {
    constructor() {
        const id = this.id = genUid()
        const element = this.element = document.createElement('IFRAME')
        element.className = 'd-none'
        element.src = `${XHR_JAIL_URL}?${id}`
        document.body.appendChild(element)
    }

    dispatchEvent(event) {
        this.element.contentWindow.dispatchEvent(event)
    }

    async doXhr(_method, url, body, headers) {
        const method = _method.toUpperCase()
        const eventId = genUid()

        const event = new CustomEvent('xhr', {detail: {eventId, method, url, body: JSON.stringify(body), headers: headers || {}}})
        let resolve, reject
        const p = new Promise((_resolve, _reject) => { resolve = _resolve; reject = _reject; })

        try {
            this.dispatchEvent(event)
            function handler ({detail}) {
                if(detail.status >= 200 && detail.status <= 400){
                    resolve(detail.payload)
                } else { reject(detail.payload) }
                document.removeEventListener(eventId, handler)
            }
            document.addEventListener(eventId, handler)
        } catch(e) {
            console.error(e)
            reject(e)
        }

        return p
    }
}

const xhrIframe = new XhrIFrame()

const stateFn = () => ({
    urlPolls: {},
    statuses: {},
    pollingLoopStarted: false,
})
const state = stateFn()

const mutations = {
    _addUrlPoll(state, {url, initialStatus}) {
        let healthCheckUrl = new URL(url)
        healthCheckUrl.pathname = HEALTH_CHECK_PATH
        state.urlPolls[url] = () => xhrIframe.doXhr('GET', healthCheckUrl.toString())
        Vue.set(state.statuses, url, initialStatus)
    },
    markUrlPending(state, url) {
        Vue.set(state.statuses, url, 'PENDING')
    },
    completeUrlPolling(state, url) {
        delete state.urlPolls[url]
        Vue.set(state.statuses, url, 'COMPLETE')
    },
    setPollingLoopStarted(state) {
        state.pollingLoopStarted = true
    }
}

const actions = {
    async addUrlPoll({state, commit, dispatch}, deployment) {
        if(!deployment.status) return
        
        const startupEstimate = deployment.startupEstimate || DEFAULT_STARTUP_ESTIMATE
        const initialStatus = Date.now() - new Date(deployment.deployTime) < startupEstimate ? 'PENDING': 'LIKELY_UP'
        const url = deployment.url

        commit('_addUrlPoll', {initialStatus, url})
        if(!state.pollingLoopStarted) {
            await sleep(30) // allow other urls to be queued before beginning
            dispatch('startPollingLoop')
        }
    },
    async startPollingLoop({state, commit}) {
        if(state.pollingLoopStarted) return
        commit('setPollingLoopStarted')
        const waitingFor = {}
        const backoffCounters = {}
        while(true) {
            for(const [url, healthCheck] of Object.entries(state.urlPolls)) {
                if(!waitingFor[url]) {
                    waitingFor[url] = true

                    if(!backoffCounters[url]) {
                        if(state.statuses[url] == 'LIKELY_UP') {
                            backoffCounters[url] = 5
                        } else {
                            backoffCounters[url] = 1
                        }
                    }

                     const healthCheckPromise = healthCheck()
                        .then(_payload => commit('completeUrlPolling', url))
                        .catch(_e => commit('markUrlPending', url))

                    const promiseWithBackoff = Promise.all([
                        sleep(BASE_POLLING_INTERVAL * Math.pow(backoffCounters[url], BACKOFF_EXPONENT)),
                        healthCheckPromise
                    ])

                    promiseWithBackoff.finally(() => {
                        backoffCounters[url] += 1
                        waitingFor[url] = false
                    })
                }
            }

            await sleep(BASE_POLLING_INTERVAL)
        }
    }
}

const getters = {
    pollingStatus(state) {
        return function(url) {
            if(!xhrIframe) return 'COMPLETE'
            try {
                return state.statuses[url]
            } catch(e) {
                return null
            }
        }
    }
}

export default { state, mutations, actions, getters }
