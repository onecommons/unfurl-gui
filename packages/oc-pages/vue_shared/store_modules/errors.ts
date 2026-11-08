import _ from 'lodash'
import type {Module} from '@gitlab/vuex-vue3'

const ERROR_LEVELS = ['minor', 'major', 'critical']

export type Severity = 'minor' | 'major' | 'critical'

export interface AppError {
    severity: Severity
    message: string
    context: unknown
    time: string
    traceback?: string
    [key: string]: unknown
}

interface State {
    errors: AppError[]
    errorsClearedTo: number
}

interface ErrorGetters {
    errors: AppError[]
    errorsBySeverity: (severity: Severity) => AppError[]
}

function stateFn(): State {
    return {
        errors: [],
        errorsClearedTo: 0,
    }
}

const state = stateFn()

const mutations = {
    createError(state: State, {severity, message, context, ...optional}: {severity?: Severity, message: string, context?: any, [key: string]: unknown}) {
        const now = new Date(Date.now())

        const traceback = context?.details?.startsWith('Traceback')? context.details: undefined
        const err: AppError = {
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
    clearErrors(state: State) {
        state['errorsClearedTo'] = state.errors.length
    }
}

const actions = {
}

const getters = {
    errors(state: State) {return state.errors.slice(state.errorsClearedTo)},
    errorsBySeverity(_: State, getters: ErrorGetters) {
        return function(severity: Severity) {
            return getters.errors.filter(e => ERROR_LEVELS.indexOf(e.severity) >= ERROR_LEVELS.indexOf(severity))
        }
    },
    hasCriticalErrors(_: State, getters: ErrorGetters) {
        return getters.errorsBySeverity('critical').length > 0
    }
}

export default {state, mutations, actions, getters} satisfies Module<State, any>
