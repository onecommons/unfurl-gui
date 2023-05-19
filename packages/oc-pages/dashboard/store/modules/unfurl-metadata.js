import _ from 'lodash'
function stateFn() {
    return {
        messages: []
    }
}

const state = stateFn()

const getters = {
    getJobSummary(state) {
        const last = _.last(state.messages)
        if(last?.job) {
            return last
        }
        return null
    },

    taskLineNo(state) {
        return function({target, operation}) {
            console.log({target, operation, messages: state.messages})
            return _.find(state.messages, (item) => {
                return item.target == target && item.operation == operation
            })?.lineNumber
        }
    }
}

const mutations = {
    pushMessage(state, message) {
        state.messages.push(message)
        state.messages = state.messages
    }
}

const actions = {}

export default {state, actions, getters, mutations}
