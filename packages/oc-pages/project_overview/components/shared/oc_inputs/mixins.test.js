import {connectedRepo} from './mixins'

const {isKnownProject} = connectedRepo.methods

function withProjects(promise) {
    return {userProjectSuggestionsPromise: promise}
}

const PROJECTS = [
    {path_with_namespace: 'onecommons/unfurl-types'},
    {path_with_namespace: 'onecommons/support'},
]

describe('isKnownProject', () => {
    it('accepts a path a project actually has', async () => {
        const vm = withProjects(Promise.resolve(PROJECTS))

        await expect(isKnownProject.call(vm, 'onecommons/unfurl-types')).resolves.toBe(true)
    })

    // the combobox emits per keystroke, so this is what the watcher mostly sees
    it('rejects the partial paths typing produces', async () => {
        const vm = withProjects(Promise.resolve(PROJECTS))

        await expect(isKnownProject.call(vm, 'one')).resolves.toBe(false)
        await expect(isKnownProject.call(vm, 'onecommons/unfurl-type')).resolves.toBe(false)
    })

    it('treats a failed project fetch as no match rather than rejecting', async () => {
        const vm = withProjects(Promise.reject(new Error('boom')))

        await expect(isKnownProject.call(vm, 'onecommons/support')).resolves.toBe(false)
    })

    // async, like updateValue above it, so the dependency check rejects
    it('says so when the caller has no project list', async () => {
        await expect(isKnownProject.call({}, 'onecommons/support'))
            .rejects.toThrow('userProjectSuggestionsPromise')
    })
})
