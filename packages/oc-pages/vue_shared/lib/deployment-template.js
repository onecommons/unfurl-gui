import _ from 'lodash'
export function visitProperties(deploymentObject, cb) {
    const {DeploymentTemplate, ResourceTemplate} = deploymentObject
    for(const rt of Object.values(DeploymentTemplate?.ResourceTemplate || {})) {
        for(const property of rt.properties || []) {
            cb(property)
        }
    }

    for(const rt of Object.values(ResourceTemplate || {})) {
        for(const property of rt.properties || []) {
            cb(property)
        }
    }
}
export function environmentVariableDependencies(deploymentObject) {
    const {DeploymentTemplate, ResourceTemplate} = deploymentObject
    const result = []
    function deepIterateReferences(prop) {
        for(const value of Object.values(prop)){
            if(value && typeof value == 'object') {
                if(value?.get_env) {
                    result.push(value?.get_env)
                } else {
                    deepIterateReferences(value)
                }
            }
        }
    }

    visitProperties(deploymentObject, deepIterateReferences)
    
    return _.uniq(result)
}

export function prefixEnvironmentVariables(deploymentObject, prefix) {
    const {DeploymentTemplate, ResourceTemplate} = deploymentObject

    function deepIterateReferences(prop) {
        for(const value of Object.values(prop)){
            if(value && typeof value == 'object') {
                if(value?.get_env) {
                    value.get_env = `${prefix}__${value.get_env}`
                }
            }
        }
    }

    visitProperties(deploymentObject, deepIterateReferences)
}
