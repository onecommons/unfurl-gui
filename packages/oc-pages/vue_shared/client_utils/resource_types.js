// NOTE: hardcoded names
const GENERIC_FALLBACK = 'unfurl.relationships.ConnectsTo.ComputeMachines'

function hasMatchingConnection(implementationRequirement, environment, resourceTypeResolver) {
    let connections = Object.values(environment.connections || {})

    // if no connections, this is a generic environment
    if(connections.length == 0) {
        connections = [{type: GENERIC_FALLBACK}]
    }

    return connections.some(conn => {
        const connResourceType = resourceTypeResolver(conn.type)
        return connResourceType?.extends?.includes(implementationRequirement)
    })
}

function meetsImplementationRequirements(resourceType, environment, resourceTypeResolver) {
    // maybe this should just be false if there are implementation requirements, but no environment
    if(environment && resourceType.implementation_requirements?.length) {
        if(! resourceType.implementation_requirements.every(req => hasMatchingConnection(req, environment, resourceTypeResolver))) {
            return false
        }
    }
    return true
}

export function isDiscoverable(resourceType, environment, resourceTypeResolver) {
    if(! meetsImplementationRequirements(resourceType, environment, resourceTypeResolver)) return false
    return resourceType?.implementations?.includes('connect')
}

export function isConfigurable(resourceType, environment, resourceTypeResolver) {
    if(isDiscoverable(resourceType, environment, resourceTypeResolver)) {
        return true
    }
    // TODO integrate this
    if(! meetsImplementationRequirements(resourceType, environment, resourceTypeResolver)) return false
    return resourceType?.implementations?.includes('create') || resourceType?.implementations?.includes('configure')
}
