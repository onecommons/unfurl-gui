import axios from '~/lib/utils/axios_utils'

export async function deleteEnvironment(projectPath, projectId, environmentName, environmentId) {
    // #!if false
    const {variables} = (await axios.get(`/${projectPath}/-/variables`)).data
    const patchVariables = []
    for(const variable of variables) {
        if(variable.environment_scope == environmentName) {
            variable._destroy = true
            patchVariables.push(variable)
        }
    }
    if(patchVariables.length) {
        await axios.patch(`/${projectPath}/-/variables`, {variables_attributes: patchVariables})
    }

    await axios.post(`/${projectPath}/-/environments/${environmentId}/stop`)
    await axios.delete(`/api/v4/projects/${projectId}/environments/${environmentId}`)
    // #!endif
}
