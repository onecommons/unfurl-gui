import _ from 'lodash'
export function visitProperties(deploymentObject, cb) {
    const {DeploymentTemplate, ResourceTemplate} = deploymentObject
    if(DeploymentTemplate || ResourceTemplate) {
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
    } else if(deploymentObject) {
        if(deploymentObject.ResourceTemplate) {
            for(const rt of Object.values(deploymentObject.ResourceTemplate)) {
                for(const property of rt.properties || []) {
                    cb(property)
                }
            }
        } else {
            for(const property of deploymentObject.properties || []) {
                cb(property)
            }
        }
    }
}
export function environmentVariableDependencies(deploymentObject) {
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
