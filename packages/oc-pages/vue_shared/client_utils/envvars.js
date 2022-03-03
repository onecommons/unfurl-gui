import axios from '~/lib/utils/axios_utils'
import {USER_HOME_PROJECT} from '../util.mjs'

export async function patchEnv(env, environmentScope) {
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

    const variablesEndpoint = `/${window.gon.current_username}/${USER_HOME_PROJECT}/-/variables`

    if(envPatch.length) {
        const currentVars = (await axios.get(variablesEndpoint)).data.variables
        for(const currentVar of currentVars) {
            const existingVar = envPatch.find(newVar => newVar.key == currentVar.key)
            if(existingVar) {
                existingVar.id = currentVar.id
            }
        }
        await axios.patch(variablesEndpoint, {variables_attributes: envPatch})
    }
}
