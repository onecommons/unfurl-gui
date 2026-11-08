// NOTE: hardcoded names
const GENERIC_FALLBACK = 'unfurl.relationships.ConnectsTo.ComputeMachines'

export interface ResourceType {
    name: string
    extends?: string[]
    implementations?: string[]
    implementation_requirements?: string[]
    metadata?: {deprecates?: string[]}
}

interface Environment {
    connections?: Record<string, {type: string}>
}

type ResourceTypeResolver = (typeName: string) => ResourceType | undefined

function hasMatchingConnection(implementationRequirement: string, environment: Environment, resourceTypeResolver: ResourceTypeResolver) {
    let connections = Object.values(environment.connections || {})

    // if no connections, this is a generic environment
    if(connections.length == 0) {
        connections = [{type: GENERIC_FALLBACK}]
    }

    return connections.some(conn => {
        const connResourceType = resourceTypeResolver(conn.type)
        return (
            connResourceType?.extends?.includes(implementationRequirement) ||
            connResourceType?.metadata?.deprecates?.includes(implementationRequirement) ||
            // unresolved: a connection whose type's repository is not loaded yet
            (!!connResourceType && resourceTypeResolver(implementationRequirement)?.metadata?.deprecates?.includes(connResourceType.name))
        )
    })
}

function meetsImplementationRequirements(resourceType: ResourceType, environment: Environment | null | undefined, resourceTypeResolver: ResourceTypeResolver) {
    // maybe this should just be false if there are implementation requirements, but no environment
    if(environment && resourceType.implementation_requirements?.length) {
        if(! resourceType.implementation_requirements.every(req => hasMatchingConnection(req, environment, resourceTypeResolver))) {
            return false
        }
    }
    return true
}

export function isDiscoverable(resourceType: ResourceType, environment: Environment | null | undefined, resourceTypeResolver: ResourceTypeResolver) {
    if(! meetsImplementationRequirements(resourceType, environment, resourceTypeResolver)) return false
    return resourceType?.implementations?.includes('connect')
}

export function isConfigurable(resourceType: ResourceType, environment: Environment | null | undefined, resourceTypeResolver: ResourceTypeResolver) {
    if(isDiscoverable(resourceType, environment, resourceTypeResolver)) {
        return true
    }
    // TODO integrate this
    if(! meetsImplementationRequirements(resourceType, environment, resourceTypeResolver)) return false
    return resourceType?.implementations?.includes('create') || resourceType?.implementations?.includes('configure')
}
