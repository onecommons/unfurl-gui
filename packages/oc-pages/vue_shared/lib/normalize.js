function normalizeDirectives(directives) {
    for(let i in directives || []) {
        if(directives[i] == 'substitution') {
            directives[i] = 'substitute'
        }
    }
}

export function normpath(path) {
    return path.split('/').filter(c => !!c).join('/')
}

const transforms = {
    ApplicationBlueprint(blueprint, root) {
        if(blueprint.projectPath) {
            blueprint.projectPath = normpath(blueprint.projectPath)
        }
    },

    Deployment(deployment, root) {
        deployment._environment = root._environment

        let primary
        try {
            if(primary = root.Resource[deployment.primary]) {
                deployment.healthCheckUrl = primary.computedProperties?.find(({name}) => name == 'health_check_url')?.value
                if(!deployment.healthCheckUrl.match(/^\w+:\/\//)) {
                   deployment.healthCheckUrl = 'https://' + deployment.healthCheckUrl
                }
                deployment.readinessEstimate = primary.computedProperties?.find(({name}) => name == 'readiness_estimate')?.value
            }
        } catch(e) {}

        try {
            if(deployment.deployTime) {
                let deployTime
                try {
                    deployTime = new Date(deployment.deployTime + 'Z')
                    deployTime.toISOString()
                } catch(e) {
                    deployTime = new Date(deployment.deployTime)
                }
                deployment.deployTime = deployTime
            }
        } catch(e) {
            delete deployment.deployTime
        }
    },


    DeploymentTemplate(dt, root) {
        if(dt.ResourceTemplate) {
            Object.entries(dt.ResourceTemplate).forEach(([name, rt]) => {
                rt._local = true
                localNormalize(rt, 'ResourceTemplate', root)
            })
        }
        if(!dt.projectPath) {
            try {
                dt.projectPath = Object.values(root.ApplicationBlueprint)[0].projectPath
            } catch(e) {}
        }

        if(dt.projectPath) {
            dt.projectPath = normpath(dt.projectPath)
        }
    },

    ResourceType(resourceType) {
        if(!resourceType.title) resourceType.title = resourceType.name
        resourceType.__typename = 'ResourceType'

        resourceType._localName = resourceType.name.split('@')[0]

        if(! resourceType.requirements) {
            resourceType.requirements = []
        }

        if(!resourceType.metadata) {
            resourceType.metadata = {}
        }

        if(resourceType.metadata.alias) {
            resourceType.implementations = []
        }

        /*
             * see also getValidEnvironmentConnections and instantiableResourceTypes
             * if a resource type specifies deprecates, its extends will be searched along with the extends of every type that it 'deprecates'
             * if a resource type is marked as deprecated by another type, it cannot be 'created' if its deprecating type is an option to create
             * if a resource type is marked as deprecated by another type, it can be 'connected' when its deprecating type would be connectable
             * this ultimately affects how both types will be available to connect or create

             * e.g. Route53DNSZone has deprecates: Route53DNSZone@unfurl.cloud/onecommons/unfurl-types:dns-services
             * this has the following consequences (assuming Route53DNSZone has the correct implementations):
               - Route53DNSZone can always be created when Route53DNSZone@unfurl.cloud/onecommons/unfurl-types:dns-services is also a valid option to create
               - Route53DNSZone@unfurl.cloud/onecommons/unfurl-types:dns-services cannot be created when Route53DNSZone is a valid option to create
               - Route53DNSZone can always be connected when Route53DNSZone@unfurl.cloud/onecommons/unfurl-types:dns-services is also a valid option to connect
               - inversely, Route53DNSZone@unfurl.cloud/onecommons/unfurl-types:dns-services can always be connected when Route53DNSZone is also a valid option to connect

             * if a provider type deprecates another provider type, either provider type can always be used to fulfill implementation_requirements
        */
        if(resourceType.metadata.deprecates) {
            const deprecates = resourceType.metadata.deprecates
            if(!Array.isArray(deprecates)) {
                resourceType.metadata.deprecates = [deprecates]
            }
        }

        normalizeDirectives(resourceType.directives)

        const utilization = resourceType.directives?.includes('substitute')? 0: 1
        for(const req of resourceType.requirements) {
            req._utilization = utilization
            req.title = req.title || req.name
        }

        // unmatched requirements are now filtered out before patching
        // frontend now handles the substitution, so the match must be seen
        // if(resourceType.directives?.includes('substitute')) {
        //     resourceType.requirements = resourceType.requirements.filter(req => !req.match)
        // }

        // will prevent nested dependencies with visibility set from overriding parent constraint visibility
        resourceType.requirements = resourceType.requirements.filter(req => req.visibility != 'hidden' || req.match)

        resourceType._maxUtilization = 1


        function normalizeSchemaProperty(property) {
            if(property.type == 'object' && property.properties && typeof property.properties == 'object') {
                try {
                    Object.values(property.properties).forEach(normalizeSchemaProperty)
                } catch(e) {}
            }
            if(property.hidden) {
                property.visibility = 'hidden'
            }

            const expression = property?.default?.eval || property?.default

            if(expression?.abspath || expression?.get_dir) {
                property.input_type = 'file'
            }

            if(property.input_type == 'file') {
                property.sensitive = false
            }

            if(property.type == 'object' && property.additionalProperties) {
                property.tab_title = property.tab_title || property.title?.split(' ').map(w => w[0]?.toUpperCase() + w.slice(1)).join(' ')
                property.metadata = property.metadata || {}
                property.additionalPropertiesAddLabel = property.additionalPropertiesAddLabel || property.metadata.additionalPropertiesAddLabel
            }
        }
        ['inputsSchema', 'computedPropertiesSchema', 'outputsSchema'].forEach(schemaType => {
            let properties
            try {
                properties = Object.values(resourceType[schemaType].properties)
            } catch(e) {}

            if(properties) {
                properties.forEach(normalizeSchemaProperty)
            }
        })
    },

    ResourceTemplate(resourceTemplate, root) {
        if(!resourceTemplate.title) resourceTemplate.title = resourceTemplate.name
        resourceTemplate.__typename = 'ResourceTemplate'

        const typeName = resourceTemplate.type?.name || resourceTemplate.type
        resourceTemplate._localTypeName = typeName.split('@')[0]

        if(!resourceTemplate.visibility) resourceTemplate.visibility = 'inherit'

        // modifying dependencies is currently a vuex validation error because of local template handling in both normalization functions

        if(!resourceTemplate.dependencies) {
            resourceTemplate.dependencies = []
        }

        resourceTemplate.dependencies.forEach(dep => {
            const visibility = dep.visibility || dep.constraint.visibility || 'visible'
            dep.constraint.visibility = dep.visibility = visibility
        })

        resourceTemplate.dependencies = resourceTemplate.dependencies.filter(dep => !(dep.constraint.visibility == 'hidden' && !dep.match))

        normalizeDirectives(resourceTemplate.directives)

        if(root && !resourceTemplate._sourceinfo) {
            try {
                const type = root.ResourceType[resourceTemplate.type]
                resourceTemplate._sourceinfo = type._sourceinfo
            } catch (e) {
                console.error(`Couldn't attach sourceinfo for ${resourceTemplate.name}`)
                console.error(e)
            }
        }

        const utilization = resourceTemplate.directives?.includes('substitute')? 0: 1
        for(const dep of resourceTemplate.dependencies) {
            dep._utilization = utilization
            dep.constraint._utilization = utilization
            dep.title = dep.title || dep.name
            dep.constraint.title = dep.constraint.title || dep.constraint.name
        }

        resourceTemplate._maxUtilization = 1
    },
}

export function localNormalize(object, typename=null, root) {
    if(object._normalized) return
    if(!(object.__typename || typename)) {
        throw new Error(`Couldn't normalize ${object.name}: no typename`)
    }
    const t = object.__typename = typename || object.__typename

    if(typeof transforms[t] == 'function') {
        transforms[t](object, root)
        object._normalized = true
    }
}
