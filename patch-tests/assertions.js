export default {
  'nestedcloud-1': (store, patch) => {
    expect(store.getters.resolveResourceTypeFromAny('CachetApp')).toHaveProperty('_sourceinfo')

    const cachet = patch.find(p => p.name == 'cachetapp')

    expect(cachet).toBeDefined()

    expect(store.getters.resolve)
    expect(cachet).toHaveProperty('_sourceinfo')

    const dt = patch.find(p => p.__typename == 'DeploymentTemplate')
    expect(dt).toHaveProperty("source", "gcp")

    console.log(store.getters.deployTooltip)
    expect(store.getters.cardIsValid(store.getters.getPrimaryCard)).toBeTruthy()
  },

  'nestedcloud-1c': async (store, patch) => {
    await store.dispatch('deleteNode', {name: 'cachetapp', action: 'delete', dependentName: 'the_app', dependentRequirment: 'nested'})

    for(const template of ['dns-for-cachetapp', 'dockerhost-for-cachetapp', 'floating-ip-for-cachetapp', 'compute-for-cachetapp', 'database-instance-for-cachetapp']) {
      expect(store.state.templateResources.resourceTemplates).not.toHaveProperty(template)
    }

  }
}
