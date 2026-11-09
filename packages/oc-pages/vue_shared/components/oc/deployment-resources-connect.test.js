jest.mock('@gitlab/ui', () => new Proxy({}, {
    get(_target, name) {
        if(typeof name != 'string') return undefined
        if(name == '__esModule') return true
        if(name.endsWith('Directive')) return {}
        const props = new Proxy({}, {get: () => ({validator: () => true})})
        return {name, props, render: () => null}
    },
}))

const DeploymentResources = require('./deployment-resources.vue').default

// connectNodeResource reads a live Resource as `resource` and anything else by
// name as `externalResource`.
it.each([
    [{__typename: 'ResourceTemplate', name: 'shared-db'}, {externalResource: 'shared-db'}],
    [{__typename: 'Resource', name: 'live-db'}, {resource: {__typename: 'Resource', name: 'live-db'}}],
])('connects the chosen %o', async (selection, expected) => {
    const connectNodeResource = jest.fn()
    await DeploymentResources.methods.onSubmitModalConnect.call({
        selectedServiceToConnect: selection,
        connectNodeResourceData: {dependentName: 'app', dependentRequirement: 'db'},
        connectNodeResource,
    })
    expect(connectNodeResource).toHaveBeenCalledWith(expect.objectContaining({dependentName: 'app', dependentRequirement: 'db', ...expected}))
})
