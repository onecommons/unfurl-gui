import type {ActionContext, Module} from '@gitlab/vuex-vue3'
import {sleep} from '../client_utils/misc'
import { XhrIFrame } from '../client_utils/crossorigin-xhr'

const BASE_POLLING_INTERVAL = 1000
const BACKOFF_EXPONENT = 1.25
// seconds, like the readiness_estimate a deployment declares
const DEFAULT_STARTUP_ESTIMATE = 5 * 60

type PollStatus = 'PENDING' | 'LIKELY_UP' | 'COMPLETE'

interface State {
    urlPolls: Record<string, () => Promise<unknown>>
    statuses: Record<string, PollStatus>
    // seconds until each deployment is expected to be ready
    etas: Record<string, number>
    pollingLoopStarted: boolean
}

interface HealthGetters {
    deploymentEta: (name: string) => number
}

type Context = ActionContext<State, any>

let xhrIframe: XhrIFrame | null = null

// #!if !standalone
xhrIframe = new XhrIFrame()
// #!endif

const stateFn = (): State => ({
    urlPolls: {},
    statuses: {},
    etas: {},
    pollingLoopStarted: false,
})
const state = stateFn()

const mutations = {
    _addUrlPoll(state: State, {url, name, initialStatus}: {url: string, name: string, initialStatus: PollStatus}) {
        state.urlPolls[name] = () => xhrIframe!.doXhr('GET', url).then(res => res.data)
        state.statuses[name] = initialStatus
    },
    clearPollingStateFor(state: State, name: string) {
        delete state.urlPolls[name]
        delete state.etas[name]
        delete state.statuses[name]
    },
    markUrlPending(state: State, name: string) {
        state.statuses[name] = 'PENDING'
    },
    completeUrlPolling(state: State, name: string) {
        delete state.urlPolls[name]
        state.statuses[name] = 'COMPLETE'
    },
    setPollingLoopStarted(state: State) {
        state.pollingLoopStarted = true
    },
    insertEta(state: State, {name, deployTime, readinessEstimate}: {name: string, deployTime: Date | number, readinessEstimate: number}) {
        const value = (Number(deployTime) - Date.now()) / 1000 + readinessEstimate
        state.etas[name] = Math.max(value, 0)
    },
    decrimentEtas(state: State, quantity=1000) {
        Object.entries(state.etas).forEach(([key, value]) => {
            state.etas[key] = Math.max(value - quantity / 1000, 0)
        })
    }
}

const actions = {
    async addUrlPoll({state, commit, dispatch, rootGetters}: Context, {deployment, environment}: {deployment: Record<string, any> | null | undefined, environment: {name: string} | null | undefined}) {
        // a dashboard item can arrive before its deployment or environment does,
        // and there is nothing to poll without both. Guarded here rather than
        // below because lookupDeployPath dereferences a name off each -- and the
        // report itself must not, which is the mistake this replaces.
        if(!(deployment && environment)) {
            console.warn('Skipping polling: incomplete dashboard item', {deployment, environment})
            if(deployment?.name) commit('clearPollingStateFor', deployment.name)
            return
        }

        const deployPath = rootGetters.lookupDeployPath(deployment.name, environment.name)
        const deploymentItem = rootGetters.deploymentItemDirect({deployment, environment})
        const lastWorkflow = deploymentItem?.pipeline?.variables?.WORKFLOW

        if(!lastWorkflow) {
            // a dashboard with no deploy path yet is the state this branch
            // exists to report, so it cannot assume the lookup found one
            console.error(`No last workflow for ${deployPath?.name ?? deployment.name}`)
        }
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

        const readinessEstimate: number = deployment.readinessEstimate || DEFAULT_STARTUP_ESTIMATE
        const secondsSinceDeploy = (Date.now() - Number(deployment.deployTime)) / 1000
        const initialStatus = secondsSinceDeploy < readinessEstimate ? 'PENDING': 'LIKELY_UP'

        commit('insertEta', {name: deployment.name, deployTime: deployment.deployTime, readinessEstimate})
        commit('_addUrlPoll', {initialStatus, name: deployment.name, url: deployment.healthCheckUrl})
        if(!state.pollingLoopStarted) {
            await sleep(30) // allow other urls to be queued before beginning
            dispatch('startPollingLoop')
        }
    },
    async startPollingLoop({state, commit}: Context) {
        if(state.pollingLoopStarted) return
        commit('setPollingLoopStarted')
        const waitingFor: Record<string, boolean> = {}
        const backoffCounters: Record<string, number> = {}
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
    pollingStatus(state: State) {
        return function(name: string) {
            if(!xhrIframe) return 'COMPLETE'
            try {
                return state.statuses[name]
            } catch(e) {
                return null
            }
        }
    },
    deploymentEta(state: State) {
        return function(name: string) {
            try {
                return Math.floor(state.etas[name])
            } catch(e) {
                return 0
            }
        }
    },
    formattedDeploymentEta(_: State, getters: HealthGetters) {
        return function(name: string) {
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

export default { state, mutations, actions, getters } satisfies Module<State, any>
