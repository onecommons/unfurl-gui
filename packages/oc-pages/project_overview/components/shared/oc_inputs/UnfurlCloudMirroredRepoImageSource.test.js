jest.mock('@gitlab/ui', () => new Proxy({}, {
    get(_target, name) {
        if(typeof name != 'string') return undefined
        if(name == '__esModule') return true
        if(name.endsWith('Directive')) return {}
        const props = new Proxy({}, {get: () => ({validator: () => true})})
        return {name, props, render: () => null}
    },
}))

const Source = require('./UnfurlCloudMirroredRepoImageSource.vue').default

// The branch input shows for any project typed in, but branches are only
// fetched for a project the user can see.
it('offers no branches for a project it could not fetch them for', async () => {
    const callback = jest.fn()
    await Source.methods.getBranchSuggestions.call({repositoryBranchesPromise: null}, 'ma', callback)
    expect(callback).toHaveBeenCalledWith([])
})
