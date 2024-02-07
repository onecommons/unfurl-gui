function normalizeDirectives(directives) {
    for(let i in directives || []) {
        if(directives[i] == 'substitution') {
            directives[i] = 'substitute'
        }
    }
}

const transforms = {
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

        if(resourceType.directives?.includes('substitute')) {
            resourceType.requirements = resourceType.requirements.filter(req => !req.match)
        }

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

    ResourceTemplate(resourceTemplate) {
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
