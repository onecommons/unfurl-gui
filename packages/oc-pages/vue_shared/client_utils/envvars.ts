import axios from '~/lib/utils/axios_utils'
import _ from 'lodash'

// A CI/CD variable as GitLab's -/variables endpoint lists it.
export interface EnvironmentVariable {
    id?: number
    key: string
    value?: string
    secret_value?: string
    environment_scope: string
    variable_type?: string
    masked?: boolean
    protected?: boolean
    _destroy?: boolean
    [key: string]: unknown
}

// a value, or the variable's attributes with the value under `value`/`secret_value`
type EnvPatch = Record<string, string | number | Partial<EnvironmentVariable>>

export function toDepTokenEnvKey(projectId: string | number) {
    return `_dep_${projectId}`
}

const variablesByPath: Record<string, EnvironmentVariable[] | undefined> = {}
const batches: Record<string, (() => void) | undefined> = {}
const batchPromises: Record<string, Promise<unknown>> = {}
const batchResolves: Record<string, (result: unknown) => void> = {}
const batchRejects: Record<string, (e: unknown) => void> = {}
const pendingPatches: Record<string, EnvPatch> = {}

const BATCH_PERIOD = 100 // period to wait before merging calls to PATCH -/variables
// pass batchPeriod=0 to not add this request to a batch
export async function patchEnv(env: EnvPatch, environmentScope: string, fullPath: string, batchPeriod=BATCH_PERIOD) {
    const key = `${fullPath}#${environmentScope}`
    if(!fullPath) {
        throw new Error('Need a path to update environment variables')
    }

    pendingPatches[key] = {...(pendingPatches[key] || {}), ...env}

    if(!batches[key]) {
        let func = async() => {
            // shadow env for batched call
            try {
                const env = pendingPatches[key]

                const endpoint = `/${fullPath}/-/variables`
                const envPatch: EnvironmentVariable[] = []
                for(const _key in env) {
                    let key = _key.startsWith('$')? _key.slice(1) : _key
                    if(! /^[a-zA-Z_]+[a-zA-Z0-9_]*$/.test(key)) {
                        throw new Error(`Environment variable name does not match "^[a-zA-Z_]+[a-zA-Z0-9_]*$".  Received ${_key}`)
                    }

                    let secret_value: unknown = env[_key]
                    let data: Partial<EnvironmentVariable> = {}

                    if(typeof secret_value == 'object') {
                        data = secret_value as Partial<EnvironmentVariable>
                        secret_value = data.value || data.secret_value
                    }

                    if(secret_value || secret_value === 0 || data._destroy) {
                        envPatch.push({
                            key,
                            // 15.11 permits only secret_value, 19.3 only value, and strong
                            // params drops the unpermitted one silently -- leaving the
                            // record with a nil value, which fails masked validation as
                            // "Variables value is invalid" and aborts the whole commit.
                            // Same fix as pipelines.js.
                            secret_value: secret_value as string,
                            value: secret_value as string,
                            environment_scope: environmentScope,
                            variable_type: 'env_var',
                            masked:  typeof secret_value == 'string' && (secret_value.length >= 8 && !secret_value.includes('\n')),
                            protected: false,
                            ...data
                        })
                    }

                }

                let result = null
                if(envPatch.length) {
                    // without the ids, existing variables would be posted as new ones
                    const currentVars = await tryFetchEnvironmentVariables(fullPath)
                    if(!currentVars) throw new Error(`Could not read the variables of ${fullPath} to update them`)
                    for(const currentVar of currentVars) {
                        const mutatingVarIndex = envPatch.findIndex(newVar => newVar.key == currentVar.key && currentVar.environment_scope == environmentScope)
                        const mutatingVar = envPatch[mutatingVarIndex]
                        if(mutatingVar) {
                            if(!currentVar.id) {
                                console.warn(`No ID for var \n${JSON.stringify(currentVar, null, 2)}\nNot including in patch`)
                                envPatch.splice(mutatingVarIndex, 1)
                                continue
                            }
                            mutatingVar.id = currentVar.id
                        }
                    }
                    if(envPatch.length > 0) {
                        const response = await axios.patch(endpoint, {variables_attributes: envPatch})
                        result = response?.data
                        variablesByPath[fullPath] = result.variables
                    }
                }

                batchResolves[key](result)
            } catch(e) {
                batchRejects[key](e)
            } finally {
                delete pendingPatches[key]
                delete batchResolves[key]
                delete batchRejects[key]
                delete batches[key]
            }
        }

        batches[key] = _.debounce(func, batchPeriod)
        batchPromises[key] = new Promise((resolve, reject) => {
            batchResolves[key] = resolve
            batchRejects[key] = reject
        })
    }

    batches[key]!()

    return await batchPromises[key]
}

export async function deleteEnvironmentVariables(environmentScope: string, fullPath: string) {
    if(!fullPath) {
        throw new Error('Need a path to update environment variables')
    }
    const endpoint = `/${fullPath}/-/variables`
    const currentVars = await fetchEnvironmentVariables(fullPath)
    const envPatch: EnvironmentVariable[] = []

    for(const currentVar of currentVars) {
        if(currentVar.environment_scope == environmentScope) {
            envPatch.push({...currentVar, _destroy: true})
        }
    }

    // invalidate "cache"
    // TODO share impl with patchEnv
    delete variablesByPath[fullPath]

    if(envPatch.length > 0) {
        return await axios.patch(endpoint, {variables_attributes: envPatch})
    }
}

export async function fetchEnvironmentVariables(fullPath: string): Promise<EnvironmentVariable[]> {
    if(!fullPath) {
        throw new Error('Need a path to update environment variables')
    }

    let cachedCopy
    if(cachedCopy = variablesByPath[fullPath]) {
        return _.cloneDeep(cachedCopy)
    }

    const endpoint = `/${fullPath}/-/variables`
    const data = (await axios.get(endpoint)).data

    variablesByPath[fullPath] = data.variables || []
    // a copy, as from the cache: callers rewrite what they get
    return _.cloneDeep(variablesByPath[fullPath]!)
}

export async function tryFetchEnvironmentVariables(fullPath: string): Promise<EnvironmentVariable[] | undefined> {
    try {
        return await fetchEnvironmentVariables(fullPath)
    } catch(e) {
        console.warn('@tryFetchEnvironmentVariables:', e)
    }
}
