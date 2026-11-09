jest.mock('@gitlab/ui', () => new Proxy({}, {
    get(_target, name) {
        if(typeof name != 'string') return undefined
        if(name == '__esModule') return true
        if(name.endsWith('Directive')) return {}
        const props = new Proxy({}, {get: () => ({validator: () => true})})
        return {name, props, render: () => null}
    },
}))
jest.mock('oc_vue_shared/client_utils/projects', () => ({
    fetchContainerRepositories: () => Promise.resolve([]),
    fetchRepositoryBranches: () => Promise.resolve([]),
    fetchProjectInfo: () => Promise.resolve({id: 5}),
}))

const Source = require('./GithubMirroredRepoImageSource.vue').default

// updateProjectInfo sets up the credentials once it has the project; a second
// call made before then has no projectInfo, and the mixin rejects it.
it('sets up registry credentials once the imported project is known', async () => {
    const self = {
        repoImport: {id: 5}, projectInfo: null,
        setupRegistryCredentials: jest.fn(function() {
            return self.projectInfo? Promise.resolve(): Promise.reject(new Error('requires "this.projectInfo"'))
        }),
    }
    self.updateProjectInfo = Source.methods.updateProjectInfo.bind(self)
    const rejections = []
    const onRejection = e => rejections.push(e)
    process.on('unhandledRejection', onRejection)

    Source.methods.onImportFinished.call(self)
    await new Promise(resolve => setTimeout(resolve, 0))
    process.off('unhandledRejection', onRejection)

    expect(self.setupRegistryCredentials).toHaveBeenCalledTimes(1)
    expect(rejections).toEqual([])
})
