export default {
  'nestedcloud-1a': (store, patch) => {
    expect(store.getters.resolveResourceTypeFromAny('CachetApp')).toHaveProperty('_sourceinfo')

    const cachet = patch.find(p => p.name == 'cachetapp')

    expect(cachet).toBeDefined()

    expect(cachet).toHaveProperty('_sourceinfo')

    const dt = patch.find(p => p.__typename == 'DeploymentTemplate')
    expect(dt).toHaveProperty("source", "gcp")
    expect(cachet.dependencies.map(dep => dep.name)).not.toContain('container')
    expect(store.getters.cardIsValid(store.getters.getPrimaryCard)).toBeTruthy()
  },

  'nestedcloud-1b': async (store, patch) => {
    expect(store.getters.cardIsValid('the_app')).toBeTruthy()

    const cachet = store.state.templateResources.resourceTemplates['cachetapp']
    expect(cachet.dependencies.map(dep => dep.name)).not.toContain('container')

    await store.dispatch('deleteNode', {name: 'cachetapp', action: 'delete', dependentName: 'the_app', dependentRequirment: 'nested'})

    for(const template of ['dns-for-cachetapp', 'dockerhost-for-cachetapp', 'floating-ip-for-cachetapp', 'compute-for-cachetapp', 'database-instance-for-cachetapp']) {
      expect(store.state.templateResources.resourceTemplates).not.toHaveProperty(template)
    }

  }
}
