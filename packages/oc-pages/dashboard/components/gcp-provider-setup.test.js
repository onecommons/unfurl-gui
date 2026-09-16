import {shallowMount} from '@vue/test-utils'
import Vuex from 'vuex'
import GcpProviderSetup from './gcp-provider-setup.vue'
import {patchEnv} from 'oc_vue_shared/client_utils/envvars'
import {initUnfurlEnvironment} from 'oc_vue_shared/client_utils/environments'
import {fetchGcpProjects, saveProvider} from 'oc_vue_shared/client_utils/environment-providers'

// @gitlab/ui ships untransformed esm that jest does not transpile out of
// node_modules; shallowMount stubs all of these anyway
jest.mock('@gitlab/ui', () => {
    const stub = name => ({name, render: () => null})
    return {
        GlAlert: stub('GlAlert'),
        GlButton: stub('GlButton'),
        GlCollapsibleListbox: stub('GlCollapsibleListbox'),
        GlIcon: stub('GlIcon'),
        GlLink: stub('GlLink'),
    }
})
jest.mock('oc_vue_shared/client_utils/envvars', () => ({patchEnv: jest.fn()}))
jest.mock('oc_vue_shared/client_utils/environments', () => ({initUnfurlEnvironment: jest.fn()}))
jest.mock('oc_vue_shared/client_utils/environment-providers', () => ({
    fetchGcpProjects: jest.fn(),
    saveProvider: jest.fn(),
    gcpAuthorizeUrl: (projectPath, environment, returnTo) =>
        `/${projectPath}/-/environments/${environment}/provider/gcp/authorize?return_to=${encodeURIComponent(returnTo)}`,
}))

const HOME_PROJECT_PATH = 'jest/dashboard'
const ENVIRONMENT_NAME = 'gcp-env'
const ZONE = 'us-central1-a'

const deployInto = jest.fn()

const store = new Vuex.Store({
    getters: {
        getHomeProjectPath: () => HOME_PROJECT_PATH,
    },
    actions: {deployInto},
})

function mountPanel(props = {}) {
    return shallowMount(GcpProviderSetup, {
        global: {plugins: [store], mocks: {__: s => s}},
        props: {environmentName: ENVIRONMENT_NAME, ...props},
    })
}

function chooseFile(wrapper, name, contents) {
    return wrapper.vm.onFileChanged({target: {files: [{name, text: () => Promise.resolve(contents)}]}})
}

const settle = () => new Promise(resolve => setTimeout(resolve))

describe('gcp-provider-setup', () => {
    beforeEach(() => {
        fetchGcpProjects.mockResolvedValue([{project_id: 'my-project-1234', name: 'My Project'}])
        saveProvider.mockResolvedValue({provider: 'gcp'})
        initUnfurlEnvironment.mockResolvedValue({})
        patchEnv.mockResolvedValue({})
        deployInto.mockResolvedValue({pipelineData: {id: 1}})
    })

    describe('service account key', () => {
        it('leaves everything alone when the picker is dismissed', async () => {
            const wrapper = mountPanel()

            await wrapper.vm.onFileChanged({target: {files: []}})

            expect(wrapper.vm.fileName).toBe('')
            expect(wrapper.vm.errorMessage).toBe('')
        })

        it('reports invalid JSON and keeps save disabled', async () => {
            const wrapper = mountPanel()

            await chooseFile(wrapper, 'malformed.json', 'not json')

            expect(wrapper.vm.errorMessage).toBe('Your service credentials key is invalid JSON.')
            // the rejected file stays on screen so it can be swapped for another
            expect(wrapper.vm.hasKey).toBe(true)
            expect(wrapper.vm.saveDisabled).toBe(true)

            // and picking a zone does not make it saveable
            wrapper.vm.zone = ZONE
            await settle()
            expect(wrapper.vm.saveDisabled).toBe(true)
        })

        it('stays disabled until a zone is chosen', async () => {
            const wrapper = mountPanel()
            await chooseFile(wrapper, 'key.json', '{"project_id": "my-project-1234"}')
            expect(wrapper.vm.saveDisabled).toBe(true)

            wrapper.vm.zone = ZONE
            await settle()

            expect(wrapper.vm.saveDisabled).toBe(false)
        })

        it('writes the credentials as environment variables, not a provider row', async () => {
            const wrapper = mountPanel()
            await chooseFile(wrapper, 'key.json', '{"project_id": "my-project-1234"}')
            wrapper.vm.zone = ZONE

            await wrapper.vm.onSave()

            expect(saveProvider).not.toHaveBeenCalled()
            const [variables, environmentScope, projectPath] = patchEnv.mock.calls[0]
            expect(environmentScope).toBe(ENVIRONMENT_NAME)
            expect(projectPath).toBe(HOME_PROJECT_PATH)
            expect(variables.GOOGLE_APPLICATION_CREDENTIALS).toMatchObject({variable_type: 'file'})
            expect(JSON.parse(variables.GOOGLE_APPLICATION_CREDENTIALS.value)).toEqual({project_id: 'my-project-1234'})
            expect(variables.CLOUDSDK_CORE_PROJECT.value).toBe('my-project-1234')
            expect(variables.CLOUDSDK_COMPUTE_ZONE.value).toBe(ZONE)
            expect(wrapper.emitted('saved')).toEqual([['gcp']])
        })
    })

    describe('editing an environment whose key is already stored', () => {
        const editing = {
            editing: true,
            initialValues: {
                CLOUDSDK_CORE_PROJECT: 'my-project-1234',
                CLOUDSDK_COMPUTE_ZONE: 'us-central1-a',
            },
        }

        // The key is write-only: nothing can read it back to re-send it. Saving
        // a zone change used to write JSON.stringify(fileContents) regardless,
        // which replaced a real service account key with the string "null" --
        // and patchEnv does not skip it, because "null" is not empty.
        it('does not touch the stored credentials when no new file was picked', async () => {
            const wrapper = mountPanel(editing)
            wrapper.vm.zone = 'europe-west8-a'
            await settle()

            await wrapper.vm.onSave()

            const [variables] = patchEnv.mock.calls[0]
            expect(variables).not.toHaveProperty('GOOGLE_APPLICATION_CREDENTIALS')
            expect(variables.CLOUDSDK_COMPUTE_ZONE.value).toBe('europe-west8-a')
        })

        it('never writes the string "null" as a credential', async () => {
            const wrapper = mountPanel(editing)
            wrapper.vm.zone = 'europe-west8-a'
            await settle()

            await wrapper.vm.onSave()

            const [variables] = patchEnv.mock.calls[0]
            const written = variables.GOOGLE_APPLICATION_CREDENTIALS?.value
            expect(written === 'null' || written === null || written === undefined).toBe(true)
            expect(written).not.toBe('null')
        })

        it('writes the credentials when a new file is picked', async () => {
            const wrapper = mountPanel(editing)
            await chooseFile(wrapper, 'new-key.json', '{"project_id": "replacement-5678"}')
            wrapper.vm.zone = 'europe-west8-a'
            await settle()

            await wrapper.vm.onSave()

            const [variables] = patchEnv.mock.calls[0]
            expect(JSON.parse(variables.GOOGLE_APPLICATION_CREDENTIALS.value))
                .toEqual({project_id: 'replacement-5678'})
            expect(variables.CLOUDSDK_CORE_PROJECT.value).toBe('replacement-5678')
        })
    })

    describe('google sign-in', () => {
        it('returns to a path on this origin', () => {
            const wrapper = mountPanel()

            expect(wrapper.vm.signInHref).toBe(
                `/${HOME_PROJECT_PATH}/-/environments/${ENVIRONMENT_NAME}/provider/gcp/authorize?return_to=` +
                encodeURIComponent(`/${HOME_PROJECT_PATH}/-/environments/${ENVIRONMENT_NAME}?provider=gcp&signed_in=1`)
            )
        })

        it('lists the signed-in account\'s projects by name', async () => {
            const wrapper = mountPanel({signedIn: true})
            await settle()

            expect(fetchGcpProjects).toHaveBeenCalledWith(HOME_PROJECT_PATH, ENVIRONMENT_NAME)
            expect(wrapper.vm.projectItems).toEqual([{value: 'my-project-1234', text: 'My Project'}])
            expect(wrapper.vm.usingGoogleSignIn).toBe(true)
        })

        it('falls back to the sign-in button when the token is gone', async () => {
            fetchGcpProjects.mockRejectedValue(new Error('Google authorizations required'))
            const wrapper = mountPanel({signedIn: true})
            await settle()

            expect(wrapper.vm.usingGoogleSignIn).toBe(false)
            expect(wrapper.vm.errorMessage).toBe('Google authorizations required')
        })

        it('cannot save before a project and zone are picked', async () => {
            const wrapper = mountPanel({signedIn: true})
            await settle()
            expect(wrapper.vm.saveDisabled).toBe(true)

            wrapper.vm.gcpProjectId = 'my-project-1234'
            wrapper.vm.zone = ZONE
            await settle()

            expect(wrapper.vm.saveDisabled).toBe(false)
        })

        it('triggers the bootstrap deployment in the same page session as the save', async () => {
            const wrapper = mountPanel({signedIn: true})
            await settle()
            wrapper.vm.gcpProjectId = 'my-project-1234'
            wrapper.vm.zone = ZONE

            await wrapper.vm.onSave()

            expect(saveProvider).toHaveBeenCalledWith(HOME_PROJECT_PATH, ENVIRONMENT_NAME, {
                provider: 'gcp',
                gcp_project_id: 'my-project-1234',
                zone: ZONE,
            })

            const deployPath = `environments/${ENVIRONMENT_NAME}/primary_provider`
            expect(initUnfurlEnvironment).toHaveBeenCalledWith(
                HOME_PROJECT_PATH,
                expect.objectContaining({name: ENVIRONMENT_NAME}),
                {environment: ENVIRONMENT_NAME, deployment_blueprint: null, deployment_path: deployPath},
            )
            expect(deployInto.mock.calls[0][1]).toEqual({
                workflow: 'deploy',
                environmentName: ENVIRONMENT_NAME,
                deployPath,
                deploymentName: 'primary_provider',
                SYSTEM_DEPLOYMENT: '1',
            })
            expect(wrapper.emitted('saved')).toEqual([['gcp']])
        })

        // environmentTriggerPipeline reports its failures through the store and
        // returns nothing rather than throwing
        it('does not claim success when the bootstrap deployment never started', async () => {
            deployInto.mockResolvedValue(undefined)
            const wrapper = mountPanel({signedIn: true})
            await settle()
            wrapper.vm.gcpProjectId = 'my-project-1234'
            wrapper.vm.zone = ZONE

            await wrapper.vm.onSave()

            expect(deployInto).toHaveBeenCalled()
            expect(wrapper.vm.errorMessage).toContain('service account')
            expect(wrapper.emitted('saved')).toBeUndefined()
            // the token was fine; the panel keeps the project and zone for a retry
            expect(wrapper.vm.usingGoogleSignIn).toBe(true)
        })

        it('does not claim success when the token expired between sign-in and save', async () => {
            saveProvider.mockRejectedValue(new Error('Google authorizations required'))
            const wrapper = mountPanel({signedIn: true})
            await settle()
            wrapper.vm.gcpProjectId = 'my-project-1234'
            wrapper.vm.zone = ZONE

            await wrapper.vm.onSave()

            expect(initUnfurlEnvironment).not.toHaveBeenCalled()
            expect(deployInto).not.toHaveBeenCalled()
            expect(wrapper.vm.errorMessage).toBe('Google authorizations required')
            expect(wrapper.emitted('saved')).toBeUndefined()
            // back to the sign-in button: the token is what has to be replaced
            expect(wrapper.vm.usingGoogleSignIn).toBe(false)
        })
    })
})
