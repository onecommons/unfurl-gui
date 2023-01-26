const HEALTH_CHECK_PATH = '/__unfurl/proxy_health'
import {sleep} from '../client_utils/misc'
import { XhrIFrame } from '../client_utils/crossorigin-xhr'
import Vue from 'vue'

const BASE_POLLING_INTERVAL = 1000
const BACKOFF_EXPONENT = 1.25
const DEFAULT_STARTUP_ESTIMATE = 5 * 60 * 10000// 5 minutes


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
