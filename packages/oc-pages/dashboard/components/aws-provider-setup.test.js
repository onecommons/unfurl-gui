import {shallowMount} from '@vue/test-utils'
import Vuex from 'vuex'
import AwsProviderSetup from './aws-provider-setup.vue'
import {patchEnv} from 'oc_vue_shared/client_utils/envvars'
import {fetchAwsRole, saveProvider} from 'oc_vue_shared/client_utils/environment-providers'

// @gitlab/ui ships untransformed esm that jest does not transpile out of
// node_modules; shallowMount stubs all of these anyway
jest.mock('@gitlab/ui', () => {
    const stub = name => ({name, render: () => null})
    return {
        GlAlert: stub('GlAlert'),
        GlButton: stub('GlButton'),
        GlDropdown: stub('GlDropdown'),
        GlDropdownItem: stub('GlDropdownItem'),
        GlFormInput: stub('GlFormInput'),
        GlIcon: stub('GlIcon'),
        GlLink: stub('GlLink'),
    }
})
jest.mock('oc_vue_shared/client_utils/envvars', () => ({patchEnv: jest.fn()}))
jest.mock('oc_vue_shared/client_utils/environment-providers', () => ({
    fetchAwsRole: jest.fn(),
    saveProvider: jest.fn(),
}))

const HOME_PROJECT_PATH = 'jest/dashboard'
const ENVIRONMENT_NAME = 'aws-env'
const ROLE_ARN = 'arn:aws:iam::123456789012:role/UnfurlDeployRole'

const store = new Vuex.Store({
    getters: {
        getHomeProjectPath: () => HOME_PROJECT_PATH,
    },
})

function mountPanel() {
    return shallowMount(AwsProviderSetup, {
        global: {plugins: [store], mocks: {__: s => s}},
        props: {environmentName: ENVIRONMENT_NAME},
    })
}

// let the watcher and whatever it awaits settle
const settle = () => new Promise(resolve => setTimeout(resolve))

describe('aws-provider-setup', () => {
    beforeEach(() => {
        fetchAwsRole.mockResolvedValue({account_id: '284355325122', external_id: 'ext-1', role_arn: null})
        saveProvider.mockResolvedValue({provider: 'aws'})
        patchEnv.mockResolvedValue({})
    })

    it.each(['arn-manual', 'arn-stack'])('fetches the account and external ids for %s', async method => {
        const wrapper = mountPanel()
        expect(fetchAwsRole).not.toHaveBeenCalled()

        wrapper.vm.selectedMethod = method
        await settle()

        expect(fetchAwsRole).toHaveBeenCalledWith(HOME_PROJECT_PATH, ENVIRONMENT_NAME)
        expect(wrapper.vm.accountId).toBe('284355325122')
        expect(wrapper.vm.externalId).toBe('ext-1')
    })

    it('does not fetch a role for the access key method', async () => {
        const wrapper = mountPanel()

        wrapper.vm.selectedMethod = 'access-key'
        await settle()

        expect(fetchAwsRole).not.toHaveBeenCalled()
    })

    it('carries the external id into the CloudFormation quick-create link', async () => {
        const wrapper = mountPanel()
        wrapper.vm.selectedMethod = 'arn-stack'
        await settle()

        expect(wrapper.vm.awsCloudFormationLink).toContain('param_ExternalId=ext-1')
        expect(wrapper.vm.awsCloudFormationLink).toContain('param_RoleName=UnfurlDeployRole')
        expect(wrapper.vm.awsCloudFormationLink).toContain('us-east-2.console.aws.amazon.com')
    })

    it('strips characters AWS will not take in a role name', async () => {
        const wrapper = mountPanel()

        wrapper.vm.roleName = 'Unfurl Deploy_Role!'
        await settle()

        expect(wrapper.vm.roleName).toBe('UnfurlDeployRole')
    })

    describe('save', () => {
        it('stays disabled until the ARN looks like one', async () => {
            const wrapper = mountPanel()
            wrapper.vm.selectedMethod = 'arn-manual'
            await settle()
            expect(wrapper.vm.saveDisabled).toBe(true)

            wrapper.vm.roleArn = 'arn:aws:iam::123:role/Nope'
            await settle()
            expect(wrapper.vm.saveDisabled).toBe(true)

            wrapper.vm.roleArn = ROLE_ARN
            await settle()
            expect(wrapper.vm.saveDisabled).toBe(false)
        })

        it('records the role against the environment', async () => {
            const wrapper = mountPanel()
            wrapper.vm.selectedMethod = 'arn-manual'
            wrapper.vm.selectedRegion = 'eu-west-1'
            wrapper.vm.roleArn = `  ${ROLE_ARN}  `
            await settle()

            await wrapper.vm.onSave()

            expect(saveProvider).toHaveBeenCalledWith(HOME_PROJECT_PATH, ENVIRONMENT_NAME, {
                provider: 'aws',
                region: 'eu-west-1',
                role_arn: ROLE_ARN,
            })
            expect(wrapper.emitted('saved')).toEqual([['aws']])
        })

        it('shows what the provider said and does not claim success', async () => {
            saveProvider.mockRejectedValue(new Error('User is not authorized to perform: sts:AssumeRole'))
            const wrapper = mountPanel()
            wrapper.vm.selectedMethod = 'arn-manual'
            wrapper.vm.roleArn = ROLE_ARN
            await settle()

            await wrapper.vm.onSave()

            expect(wrapper.vm.errorMessage).toBe('User is not authorized to perform: sts:AssumeRole')
            expect(wrapper.emitted('saved')).toBeUndefined()
            expect(wrapper.vm.saving).toBe(false)
        })

        it('keeps access keys out of the server endpoint', async () => {
            const wrapper = mountPanel()
            wrapper.vm.selectedMethod = 'access-key'
            wrapper.vm.accessKey = 'AKIAIOSFODNN7EXAMPLE'
            wrapper.vm.secretKey = 'secret'
            await settle()

            await wrapper.vm.onSave()

            expect(saveProvider).not.toHaveBeenCalled()
            expect(patchEnv).toHaveBeenCalledWith(
                {
                    AWS_ACCESS_KEY_ID: 'AKIAIOSFODNN7EXAMPLE',
                    AWS_SECRET_ACCESS_KEY: 'secret',
                    AWS_DEFAULT_REGION: 'us-east-2',
                },
                ENVIRONMENT_NAME,
                HOME_PROJECT_PATH,
            )
            expect(wrapper.emitted('saved')).toEqual([['aws']])
        })
    })
})
