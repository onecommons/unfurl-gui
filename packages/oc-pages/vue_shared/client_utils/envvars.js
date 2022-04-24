import axios from '~/lib/utils/axios_utils'

import {USER_HOME_PROJECT} from '../util.mjs'

// TODO this won't work for groups
const variablesEndpoint = `/${window.gon.current_username}/${USER_HOME_PROJECT}/-/variables`

export async function patchEnv(env, environmentScope, fullPath) {
    if(!fullPath) { console.warn('TODO use fullPath for patchEnv') }
    const endpoint = fullPath? `/${fullPath}/-/variables`: variablesEndpoint
    const envPatch = []
    for(const _key in env) {
        let key = _key.startsWith('$')? _key.slice(1) : _key
        if(! /^[a-zA-Z_]+[a-zA-Z0-9_]*$/.test(key)) {
            key = `_` + key.split('').map(c => c.charCodeAt(0).toString(16)).join('')
        }

        const secret_value = env[_key]

        envPatch.push({
            key,
            secret_value,
            environment_scope: environmentScope,
            variable_type: 'env_var',
            // TODO check on below
            masked: false,
            protected: false
        })
    }


    if(window.gon.unfurl_gui) {
        console.log({envPatch})
    } else {
        if(envPatch.length) {
            const currentVars = (await axios.get(endpoint)).data.variables
            for(const currentVar of currentVars) {
                const existingVar = envPatch.find(newVar => newVar.key == currentVar.key)
                if(existingVar) {
                    existingVar.id = currentVar.id
                }
            }
            await axios.patch(endpoint, {variables_attributes: envPatch})
        }
    }

}

export async function fetchEnvironmentVariables(fullPath) {
    // #!if false
    
    if(!fullPath) { console.warn('TODO use fullPath for fetchEnvironmentVariables') }
    const endpoint = fullPath? `/${fullPath}/-/variables`: variablesEndpoint
    return (await axios.get(endpoint)).data.variables

    // #!endif
    return []
}
