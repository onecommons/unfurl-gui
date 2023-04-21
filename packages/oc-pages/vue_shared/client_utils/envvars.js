import axios from '~/lib/utils/axios_utils'
import _ from 'lodash'

export function toDepTokenEnvKey(projectId) {
    return `_dep_${projectId}`
}

const variablesByPath = {}
const batches = {}
const batchPromises = {}
const batchResolves = {}
const batchRejects = {}
const pendingPatches = {}

const BATCH_PERIOD = 100 // period to wait before merging calls to PATCH -/variables
// pass batchPeriod=0 to not add this request to a batch
export async function patchEnv(env, environmentScope, fullPath, batchPeriod=BATCH_PERIOD) {
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
                const envPatch = []
                for(const _key in env) {
                    let key = _key.startsWith('$')? _key.slice(1) : _key
                    if(! /^[a-zA-Z_]+[a-zA-Z0-9_]*$/.test(key)) {
                        throw new Error(`Environment variable name does not match "^[a-zA-Z_]+[a-zA-Z0-9_]*$".  Received ${_key}`)
                    }

                    let secret_value = env[_key]
                    let data = {}

                    if(typeof secret_value == 'object') {
                        data = secret_value
                        secret_value = data.value || data.secret_value
                    }

                    if(secret_value) {
                        envPatch.push({
                            key,
                            secret_value,
                            environment_scope: environmentScope,
                            variable_type: 'env_var',
                            masked: secret_value.length >= 8 && !secret_value.includes('\n'),
                            protected: false,
                            ...data
                        })
                    }

                }

                if(window.gon.unfurl_gui) {
                    console.log({envPatch})
                }
                let result = null
                if(envPatch.length) {
                    const currentVars = await tryFetchEnvironmentVariables(fullPath)
                    for(const currentVar of currentVars) {
                        const existingVar = envPatch.find(newVar => newVar.key == currentVar.key && currentVar.environment_scope == environmentScope)
                        if(existingVar) {
                            existingVar.id = currentVar.id
                        }
                    }
                    const response = await axios.patch(endpoint, {variables_attributes: envPatch})
                    result = response?.data

                    variablesByPath[fullPath] = result.variables
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

    batches[key]()

    return await batchPromises[key]
}

export async function deleteEnvironmentVariables(environmentScope, fullPath) {
    if(!fullPath) { console.warn('TODO use fullPath for patchEnv') }
    const endpoint = fullPath? `/${fullPath}/-/variables`: variablesEndpoint
    const currentVars = await fetchEnvironmentVariables(fullPath)
    const envPatch = []

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

export async function fetchEnvironmentVariables(fullPath) {
    if(!fullPath) {
        throw new Error('Need a path to update environment variables')
    }

    let cachedCopy
    if(cachedCopy = variablesByPath[fullPath]) {
        return cachedCopy
    }

    const endpoint = `/${fullPath}/-/variables`
    const data = (await axios.get(endpoint)).data

    return variablesByPath[fullPath] = data.variables || []
}

export async function tryFetchEnvironmentVariables(fullPath) {
    try {
        return await fetchEnvironmentVariables(fullPath)
    } catch(e) {
        console.warn('@tryFetchEnvironmentVariables:', e)
    }
}
