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

    ResourceType(resourceType) {
        if(!resourceType.title) resourceType.title = resourceType.name
        resourceType.__typename = 'ResourceType'

        if(! resourceType.requirements) {
            resourceType.requirements = []
        }

        const utilization = resourceType.directives?.includes('substitute')? 0: 1
        for(const req of resourceType.requirements) {
            req._utilization = utilization
            req.title = req.title || req.name
        }

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

        const utilization = resourceTemplate.directives?.includes('substitute')? 0: 1
        for(const dep of resourceTemplate.dependencies) {
            dep._utilization = utilization
            dep.constraint._utilization = utilization
            dep.title = dep.title || dep.name
            dep.constraint.title = dep.constraint.title || dep.constraint.name
        }

        resourceTemplate._maxUtilization = 1
    }
}

export function localNormalize(object, typename=null, root) {
    if(!(object.__typename || typename)) {
        throw new Error(`Couldn't normalize ${object.name}: no typename`)
    }
    const t = object.__typename = typename || object.__typename

    if(typeof transforms[t] == 'function') {
        transforms[t](object, root)
    }
}
