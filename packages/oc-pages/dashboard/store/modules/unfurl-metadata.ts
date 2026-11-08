import _ from 'lodash'
import type {Module} from '@gitlab/vuex-vue3'

// One line of an unfurl job's log, as the job console streams it.
interface JobMessage {
    target?: string
    operation?: string
    lineNumber?: number
    job?: unknown
    [key: string]: unknown
}

interface State {
    messages: JobMessage[]
}

function stateFn(): State {
    return {
        messages: []
    }
}

const state = stateFn()

const getters = {
    getJobSummary(state: State) {
        const last = _.last(state.messages)
        if(last?.job) {
            return last
        }
        return null
    },

    taskLineNo(state: State) {
        return function({target, operation}: {target: string, operation: string}) {
            return _.find(state.messages, (item) => {
                return item.target == target && item.operation == operation
            })?.lineNumber
        }
    }
}

const mutations = {
    pushMessage(state: State, message: JobMessage) {
        state.messages.push(message)
        state.messages = state.messages
    }
}

const actions = {}

export default {state, actions, getters, mutations} satisfies Module<State, any>
