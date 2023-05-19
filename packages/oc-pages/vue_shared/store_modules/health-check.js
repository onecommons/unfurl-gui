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
    etas: {},
    pollingLoopStarted: false,
})
const state = stateFn()

const mutations = {
    _addUrlPoll(state, {url, name, initialStatus}) {
        state.urlPolls[name] = () => xhrIframe.doXhr('GET', url)
        Vue.set(state.statuses, name, initialStatus)
    },
    clearPollingStateFor(state, name) {
        Vue.delete(state.urlPolls, name)
        Vue.delete(state.etas, name)
        Vue.delete(state.statuses, name)
    },
    markUrlPending(state, name) {
        Vue.set(state.statuses, name, 'PENDING')
    },
    completeUrlPolling(state, name) {
        delete state.urlPolls[name]
        Vue.set(state.statuses, name, 'COMPLETE')
    },
    setPollingLoopStarted(state) {
        state.pollingLoopStarted = true
    },
    insertEta(state, {name, deployTime, readinessEstimate}) {
        const value = (deployTime - Date.now()) / 1000 + readinessEstimate
        Vue.set(
            state.etas,
            name,
            Math.max(value, 0)
        )
    },
    decrimentEtas(state, quantity=1000) {
        Object.entries(state.etas).forEach(([key, value]) => {
            Vue.set(state.etas, key, Math.max(value - quantity / 1000, 0))
        })
    }
}

const actions = {
    async addUrlPoll({state, commit, dispatch, rootGetters}, {deployment, environment}) {
        const deployPath = rootGetters.lookupDeployPath(deployment.name, environment.name)
        const lastWorkflow = deployPath?.pipeline?.variables?.WORKFLOW
        if(!( //NOT
            deployment.status &&
            ![3,5].includes(deployment.status) &&
            deployment.healthCheckUrl &&
            deployment.deployTime &&
            deployment.workflow == 'deploy' &&
            lastWorkflow == 'deploy'
        )) {
            console.warn(`Skipping polling ${deployment.name}`, deployment)
            commit('clearPollingStateFor', deployment.name)
            return
        }

        if(['PENDING', 'LIKELY_UP'].includes(state.statuses[deployment.name])) return
        
        const readinessEstimate = deployment.readinessEstimate || DEFAULT_STARTUP_ESTIMATE
        const initialStatus = Date.now() - deployment.deployTime < readinessEstimate ? 'PENDING': 'LIKELY_UP'

        commit('insertEta', {name: deployment.name, deployTime: deployment.deployTime, readinessEstimate})
        commit('_addUrlPoll', {initialStatus, name: deployment.name, url: deployment.healthCheckUrl})
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
            for(const [name, healthCheck] of Object.entries(state.urlPolls)) {
                if(!waitingFor[name]) {
                    waitingFor[name] = true

                    if(!backoffCounters[name]) {
                        if(state.statuses[name] == 'LIKELY_UP') {
                            backoffCounters[name] = 5
                        } else {
                            backoffCounters[name] = 1
                        }
                    }

                     const healthCheckPromise = healthCheck()
                        .then(_payload => commit('completeUrlPolling', name))
                        .catch(_e => commit('markUrlPending', name))

                    const promiseWithBackoff = Promise.all([
                        sleep(BASE_POLLING_INTERVAL * Math.pow(backoffCounters[name], BACKOFF_EXPONENT)),
                        healthCheckPromise
                    ])

                    promiseWithBackoff.finally(() => {
                        backoffCounters[name] += 1
                        waitingFor[name] = false
                    })
                }
            }

            await sleep(BASE_POLLING_INTERVAL)
            commit('decrimentEtas', BASE_POLLING_INTERVAL)
        }
    }
}

const getters = {
    pollingStatus(state) {
        return function(name) {
            if(!xhrIframe) return 'COMPLETE'
            try {
                return state.statuses[name]
            } catch(e) {
                return null
            }
        }
    },
    deploymentEta(state) {
        return function(name) {
            try {
                return Math.floor(state.etas[name])
            } catch(e) {
                return 0
            }
        }
    },
    formattedDeploymentEta(_, getters) {
        return function(name) {
            const deploymentEta = getters.deploymentEta(name)
            const result = []
            const minutes = deploymentEta / 60
            let seconds
            if(minutes > 1) {
                result.push(Math.floor(minutes) + ' minutes')
                seconds = deploymentEta % 60
            } else {
                seconds = deploymentEta
            }

            if(seconds == 0) {}
            else if (seconds == 1) {result.push('1 second')}
            else {result.push(`${seconds} seconds`)}

            if(result.length == 0) return 'now'
            return result.join(', ')
        }
    }
}

export default { state, mutations, actions, getters }
