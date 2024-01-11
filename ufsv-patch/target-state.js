import _ from 'lodash'
// import {globSync} from 'glob'
import glob from 'glob'
const globSync = glob.sync
import fs from 'fs'

const TEST_VERSIONS = process.env.TEST_VERSIONS || 'v2'


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
        const ext = store.getters.resolveResourceTypeFromAny(type)?.extends?.map(t => t.split('@').shift()) || []
        const overwriteKey = Object.keys(overwrites).find(o => type.startsWith(`${o}@`) || ext.includes(o))
        if(match && overwrites[overwriteKey]) {
          fixture.ResourceTemplate[match] = {
            ...JSON.parse(overwrites[overwriteKey]),
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

      const inputsSchema = this.store.getters.resolveResourceTypeFromAny(a.type).inputsSchema

      if(!inputsSchema.properties[propertyB.name]) {
        console.warn(`${propertyB.name} not found in :${JSON.stringify(inputsSchema, null, 2)}`)
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

      const aDependencies = this.store.getters.getDependencies(a.name)
      const dependencyA = _.cloneDeep(aDependencies?.find(dep => dep.name == dependencyB.name))
      if(!dependencyA) continue
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

        const expectedType = this.ResourceTemplate[dependencyB.match].type.split('@').shift()
        // if(TEST_VERSIONS != 'v1' && dependencyA.constraint.resourceType.startsWith('unfurl.nodes.DockerHost')) {
        //   dependencyA.constraint.resourceType = 'ContainerHost@unfurl.cloud/onecommons/std:generic_types'
        // }

        const selection = this.store.getters.availableResourceTypesForRequirement(dependencyA)
          .find(t => t.name.startsWith(`${expectedType}@`) || t.name.startsWith(`${expectedType.split('.').pop()}@`))

        if(!selection) {
          const errorMessage = [
            `Could not find a match for ${expectedType} among types available for ${JSON.stringify(dependencyA, null, 2)}`,
            `only ${this.store.getters.availableResourceTypesForRequirement(dependencyA).map(t => t.name)}.`,
            `Available types are: ${JSON.stringify(this.store.state.templateResources.availableResourceTypes.map(rt => rt.name))}`
          ].join('\n')
          throw new Error(errorMessage)
        }

        const toBeCreated = {
            dependentName: templateName,
            dependentRequirement: dependencyB.name,
            requirement: dependencyB,
            name: dependencyB.match,
            title: this.ResourceTemplate[dependencyB.match].title,
            selection
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
