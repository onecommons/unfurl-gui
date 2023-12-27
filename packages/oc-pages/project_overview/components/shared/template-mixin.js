export default {
    computed: {
        importedResource() {
            if(!this.card?.imported) return null
            let [deploymentName, ...resourceName] = this.card.imported.split(':')
            resourceName = resourceName.join(':')
            const deployment = deploymentName?
                this.getDeployments.find(dep => dep.name == deploymentName) :
                this.getDeployment

            if(!deployment) return null

            const dict = this.getDeploymentDictionary(deployment.name, deployment._environment)
            const resource = dict['Resource'][resourceName]

            // resolve the template here, since it's not in our other dictionary
            return {...resource, template: dict['ResourceTemplate'][resource.template]}
        },

        _card() {
            if(this.importedResource) {
                return {...this.card, ...this.importedResource, imported: this.card.imported}
            }
            return this.card
        },

    }
}
