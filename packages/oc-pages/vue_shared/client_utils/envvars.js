import axios from '~/lib/utils/axios_utils'

export function toDepTokenEnvKey(projectId) {
    return `_dep_${projectId}`
}

const variablesByPath = {}

export async function patchEnv(env, environmentScope, fullPath) {
    if(!fullPath) {
        throw new Error('Need a path to update environment variables')
    }
    const endpoint = `/${fullPath}/-/variables`
    const envPatch = []
    for(const _key in env) {
        let key = _key.startsWith('$')? _key.slice(1) : _key
        if(! /^[a-zA-Z_]+[a-zA-Z0-9_]*$/.test(key)) {
            key = `_` + key.split('').map(c => c.charCodeAt(0).toString(16)).join('')
        }

        let secret_value = env[_key]
        let data = {}

        if(typeof secret_value == 'object') {
            data = secret_value
            secret_value = data.value || data.secret_value
        }

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


    if(window.gon.unfurl_gui) {
        console.log({envPatch})
    }
    if(envPatch.length) {
        const currentVars = (await axios.get(endpoint)).data.variables
        for(const currentVar of currentVars) {
            const existingVar = envPatch.find(newVar => newVar.key == currentVar.key && currentVar.environment_scope == environmentScope)
            if(existingVar) {
                existingVar.id = currentVar.id
            }
        }
        const response = await axios.patch(endpoint, {variables_attributes: envPatch})
        const result = response?.data

        variablesByPath[fullPath] = result.variables
        return result
    }

    return null
}

export async function deleteEnvironmentVariables(environmentScope, fullPath) {
    if(!fullPath) { console.warn('TODO use fullPath for patchEnv') }
    const endpoint = fullPath? `/${fullPath}/-/variables`: variablesEndpoint
    const currentVars = (await axios.get(endpoint)).data.variables
    const envPatch = []

    for(const currentVar of currentVars) {
        if(currentVar.environment_scope == environmentScope) {
            envPatch.push({...currentVar, _destroy: true})
        }
    }

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
    try {
        const data = (await axios.get(endpoint)).data
        return variablesByPath[fullPath] = data.variables || []
    } catch(e) {
        return []
    }
}
