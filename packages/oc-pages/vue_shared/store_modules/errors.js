import Vue from 'vue'
import _ from 'lodash'
const ERROR_LEVELS = ['minor', 'major', 'critical']
function stateFn() {
    return {
        errors: [],
        errorsClearedTo: 0,
    }
}

const state = stateFn()

const mutations = {
    createError(state, {severity, message, context, ...optional}) {
        const now = new Date(Date.now())

        const traceback = context.details?.startsWith('Traceback')? context.details: undefined
        const err = {
            severity: severity || 'major',
            message,
            context: context?.constructor?.name == 'Error'? context.message: _.cloneDeep(context),
            ...optional,
            time: now.toISOString()
        }
        if(traceback) {
            err.traceback = traceback
        }
        state.errors.push(err)
    },
    clearErrors(state) {
        Vue.set(state, 'errorsClearedTo', state.errors.length)
    }
}

const actions = {
}

const getters = {
    errors(state) {return state.errors.slice(state.errorsClearedTo)},
    errorsBySeverity(_, getters) {
        return function(severity) {
            return getters.errors.filter(e => ERROR_LEVELS.indexOf(e.severity) >= ERROR_LEVELS.indexOf(severity))
        }
    },
    hasCriticalErrors(_, getters) {
        return getters.errorsBySeverity('critical').length > 0
    }
}

export default {state, mutations, actions, getters}
