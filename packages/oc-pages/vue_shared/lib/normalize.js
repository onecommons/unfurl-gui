const transforms = {
    Deployment(deployment, root) {
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