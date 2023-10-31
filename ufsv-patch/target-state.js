import _ from 'lodash'
// import {globSync} from 'glob'
import glob from 'glob'
const globSync = glob.sync
import fs from 'fs'


const overwrites = {}

glob.sync('./ufsv-patch/overwrite-templates/*.json').forEach(overwrite => {
  const name = overwrite.slice(0, - '.json'.length).split('/').pop()
  overwrites[name] = fs.readFileSync(overwrite, 'utf8')
})

class TargetState {
  constructor(store, fixture) {

    for(const template of Object.values(fixture.ResourceTemplate)) {
      for(const dependency of template.dependencies) {
        const type = dependency.constraint.resourceType
        const match = dependency.match
        if(match && overwrites[type]) {
          fixture.ResourceTemplate[match] = {
            ...JSON.parse(overwrites[type]),
            name: match
          }

        }
      }
    }
    Object.assign(this, fixture)

    this.store = store
  }

  templatesAB(templateName) {
    // console.log(this.ResourceTemplate[templateName])
    return {
      a: this.store.state.templateResources.resourceTemplates[templateName],
      b: this.ResourceTemplate[templateName]
    }
  }

  async setProperties(templateName) {
    const {a, b} = this.templatesAB(templateName)
    for(const propertyB of b?.properties || []) {
      const propertyA = a?.properties?.find(p => p.name == b.name)
      if(_.isEqual(propertyA, propertyB)) {
        continue
      }

      await this.store.dispatch('updateProperty', {
        deploymentName: this.store.getters.getDeploymentTemplate.name,
        templateName,
        propertyName: propertyB.name,
        propertyValue: propertyB.value,
      })
    }
  }

  async recursiveCreateDependencies(templateName) {
    const {a, b} = this.templatesAB(templateName)

    for(const dependencyB of b?.dependencies || []) {
      const recurse = async () => {
        await this.setProperties(dependencyB.match)
        await this.recursiveCreateDependencies(dependencyB.match)
      }

      const dependencyA = a?.dependencies?.find(dep => dep.name == dependencyB.name)
      // TODO add remove templates
      if(dependencyA?.match == dependencyB.match) {
        await recurse()
      }
      if(!(dependencyA?.match || dependencyB.match)) continue

      if(! this.store.getters.constraintIsHidden(templateName, dependencyB.name) && !dependencyA?.match) {
        const requiredType = dependencyB.constraint.resourceType
        const environmentName = this.store.getters.getCurrentEnvironmentName
        const implementation_requirements = this.store.getters.providerTypesForEnvironment(environmentName)
        const params = {'extends': requiredType, implementation_requirements}

        await this.store.dispatch('fetchTypesForParams', {params})

        const toBeCreated = {
            dependentName: templateName,
            dependentRequirement: dependencyB.name,
            requirement: dependencyB,
            name: dependencyB.match,
            title: this.ResourceTemplate[dependencyB.match].title,
            selection: this.store.getters.resolveResourceTypeFromAny(this.ResourceTemplate[dependencyB.match].type)
        }
        await this.store.dispatch('createNodeResource',
          toBeCreated
        )
      }

      await recurse()
    }
  }

  async createAll() {
    const primary = this.store.getters.getPrimaryCard.name

    await this.setProperties(primary)
    await this.recursiveCreateDependencies(primary)
  }
}

export default TargetState
