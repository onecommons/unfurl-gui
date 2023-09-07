import _ from 'lodash'
class TargetState {
  constructor(store, patches) {
    Object.assign(this, _.cloneDeep(store.state.project_application_blueprint))

    for(const patch of patches) {
      if(this.hasOwnProperty(patch.__typename)) {
        this[patch.__typename][patch.name] = patch
      } else {
        console.log(`missing ${patch.__typename}`)
      }
    }

    this.store = store
  }

  templatesAB(templateName) {
    // console.log(this.ResourceTemplate[templateName])
    return {
      a: this.store.getters.resolveResourceTemplate(templateName),
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
        // console.log('recurse', dependencyB)
        await this.setProperties(dependencyB.match)
        await this.recursiveCreateDependencies(dependencyB.match)
      }

      const dependencyA = a?.dependencies?.find(dep => dep.name == dependencyB.name)
      // TODO add remove templates
      if(dependencyA?.match == dependencyB.match) {
        await recurse()
      }
      if(!(dependencyA?.match || dependencyB.match)) continue

      // async createNodeResource({ commit, getters, rootGetters, state: _state, dispatch}, {dependentName, dependentRequirement, requirement, name, title, selection, recursiveInstantiate}) {

      if(! this.store.getters.constraintIsHidden(templateName, dependencyB.name) && !dependencyA?.match) {
        const requiredType = dependencyB.constraint.resourceType
        const environmentName = this.store.getters.getCurrentEnvironmentName
        // console.log(environmentName, this.store.getters.getCurrentEnvironment)
        const implementation_requirements = this.store.getters.providerTypesForEnvironment(environmentName)
        const params = {'extends': requiredType, implementation_requirements}

        await this.store.dispatch('fetchTypesForParams', {params})

        // TODO support connect
        await this.store.dispatch('createNodeResource',
          {
            dependentName: templateName,
            dependentRequirement: dependencyB.name,
            requirement: dependencyB,
            name: dependencyB.match,
            title: this.ResourceTemplate[dependencyB.match].title,
            selection: this.store.getters.resolveResourceTypeFromAny(this.ResourceTemplate[dependencyB.match].type)
          }
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
