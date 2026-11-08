import _ from 'lodash'

// The unfurl export JSON; typed loosely until the payload types exist.
type Json = Record<string, any>

interface Property {
    name?: string
    value?: unknown
}

export function visitProperties(deploymentObject: Json, cb: (property: Property) => void) {
    const {DeploymentTemplate, ResourceTemplate} = deploymentObject
    if(DeploymentTemplate || ResourceTemplate) {
        for(const rt of Object.values(DeploymentTemplate?.ResourceTemplate || {}) as Json[]) {
            for(const property of rt.properties || []) {
                cb(property)
            }
        }

        for(const rt of Object.values(ResourceTemplate || {}) as Json[]) {
            for(const property of rt.properties || []) {
                cb(property)
            }
        }
    } else if(deploymentObject) {
        if(deploymentObject.ResourceTemplate) {
            for(const rt of Object.values(deploymentObject.ResourceTemplate) as Json[]) {
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

// Calls cb with every {get_env} reference under prop, at any depth: a value
// can be a map or a list that holds the reference.
function visitEnvReferences(prop: object, cb: (reference: {get_env: string}) => void) {
    for(const value of Object.values(prop)) {
        if(value && typeof value == 'object') {
            if(value.get_env) {
                cb(value)
            } else {
                visitEnvReferences(value, cb)
            }
        }
    }
}

export function environmentVariableDependencies(deploymentObject: Json) {
    const result: string[] = []
    visitProperties(deploymentObject, prop => visitEnvReferences(prop, reference => result.push(reference.get_env)))
    return _.uniq(result)
}

export function transformEnvironmentVariables(deploymentObject: Json, variableNames: string[] | null, prefix: string | false | null | undefined, substitutions: [string | RegExp, string][] = []) {
    visitProperties(deploymentObject, prop => visitEnvReferences(prop, reference => {
        // only limit to variables in the variableNames list if it is provided
        if(Array.isArray(variableNames) && !variableNames.includes(reference.get_env)) return

        if(prefix) {
            reference.get_env = `${prefix}__${reference.get_env}`
        }

        substitutions.forEach(([match, replacement]) => {
            reference.get_env = reference.get_env.replace(match, replacement)
        })
    }))
}
