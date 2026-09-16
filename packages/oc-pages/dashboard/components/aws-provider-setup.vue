<script>
import {GlAlert, GlButton, GlDropdown, GlDropdownItem, GlFormInput, GlIcon, GlLink} from '@gitlab/ui'
import FakePassword from '../../project_overview/components/shared/oc_inputs/fake-password.vue'
import {mapGetters} from 'vuex'
import {__} from '~/locale'
import {patchEnv} from 'oc_vue_shared/client_utils/envvars'
import {fetchAwsRole, saveProvider} from 'oc_vue_shared/client_utils/environment-providers'
import CreateStackImage from '../assets/eks-create-stack.png'
import SelectDeployRoleImage from '../assets/eks-select-deploy-role.png'

const DEFAULT_REGION = 'us-east-2'

const VALID_ROLE_ARN = /^\s*arn:aws:iam::\w{12}:role\/[a-zA-Z0-9\-]+\s*$/
const VALID_ROLE_NAME = /^[a-zA-Z0-9\-]+$/

const AWS_REGIONS = [
    'us-east-1',
    'us-east-2',
    'us-west-1',
    'us-west-2',
    'af-south-1',
    'ap-east-1',
    'ap-south-1',
    'ap-southeast-1',
    'ap-northeast-2',
    'ap-northeast-3',
    'ap-northeast-1',
    'ap-southeast-2',
    'ap-southeast-3',
    'ca-central-1',
    'eu-central-1',
    'eu-west-1',
    'eu-west-2',
    'eu-west-3',
    'eu-south-1',
    'eu-north-1',
    'me-south-1',
    'sa-east-1',
]

const ACCESS_KEY = 'access-key'
const ARN_STACK = 'arn-stack'
const ARN_MANUAL = 'arn-manual'

const AUTHENTICATION_OPTIONS = {
    '': __('Select'),
    [ACCESS_KEY]: 'Enter your AWS Access Key',
    [ARN_STACK]: 'Create a Role ARN using AWS stack',
    [ARN_MANUAL]: 'Create a Role ARN manually',
}

const CLOUDFORMATION_TEMPLATE_URL = 'https://s3.amazonaws.com/unfurl.run-root/assets/provision-role.cloudformation.template'

export default {
    name: 'AwsProviderSetup',
    compatConfig: {MODE: 3},
    components: {
        GlAlert,
        GlButton,
        GlDropdown,
        GlDropdownItem,
        GlFormInput,
        GlIcon,
        GlLink,
        FakePassword,
    },
    AWS_REGIONS,
    AUTHENTICATION_OPTIONS,
    ACCESS_KEY,
    ARN_STACK,
    ARN_MANUAL,
    CreateStackImage,
    SelectDeployRoleImage,
    REGIONS_HELP_URL: 'https://aws.amazon.com/about-aws/global-infrastructure/regions_az/',
    // 15.11 pointed at /help/user/project/clusters/add_eks_clusters.md, which
    // went with certificate-based clusters; AWS's own external-id page is what
    // the instructions above actually describe
    ROLE_ARN_HELP_URL: 'https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_create_for-user_externalid.html',
    props: {
        environmentName: {
            type: String,
            required: true,
        },
        // Reopened on an environment that already has a provider, rather than
        // collecting one for the first time.
        editing: {
            type: Boolean,
            default: false,
        },
        // Environment variables as already stored, so an edit shows what is set.
        // The secret key is masked and never comes back; patchEnv skips empty
        // values, so leaving it blank keeps the stored one.
        initialValues: {
            type: Object,
            default: () => ({}),
        },
    },
    emits: ['saved', 'cancel'],
    data() {
        return {
            selectedRegion: this.initialValues?.AWS_DEFAULT_REGION || DEFAULT_REGION,
            // an access key on file is the only method that leaves a readable
            // trace, so it is the only one that can be preselected
            selectedMethod: this.initialValues?.AWS_ACCESS_KEY_ID? ACCESS_KEY: '',
            accessKey: this.initialValues?.AWS_ACCESS_KEY_ID || '',
            secretKey: '',
            roleName: 'UnfurlDeployRole',
            roleArn: '',
            accountId: '',
            externalId: '',
            saving: false,
            errorMessage: '',
        }
    },
    computed: {
        ...mapGetters(['getHomeProjectPath']),
        methodText() {
            return AUTHENTICATION_OPTIONS[this.selectedMethod]
        },
        methodOptions() {
            return Object.entries(AUTHENTICATION_OPTIONS)
                .filter(([value]) => value)
                .map(([value, text]) => ({value, text}))
        },
        trimmedArn() {
            return this.roleArn?.trim()
        },
        arnIsValid() {
            return VALID_ROLE_ARN.test(this.roleArn || '')
        },
        usingRoleArn() {
            return [ARN_STACK, ARN_MANUAL].includes(this.selectedMethod)
        },
        // The quick-create link carries the external id AWS will require in the
        // role's trust policy, so it cannot be built before fetchAwsRole answers.
        awsCloudFormationLink() {
            const region = this.selectedRegion
            return `https://${region}.console.aws.amazon.com/cloudformation/home?region=${region}#/stacks/quickcreate` +
                `?templateURL=${encodeURIComponent(CLOUDFORMATION_TEMPLATE_URL)}` +
                `&stackName=${encodeURIComponent(this.roleName)}` +
                `&param_ExternalId=${encodeURIComponent(this.externalId)}` +
                `&param_RoleName=${encodeURIComponent(this.roleName)}`
        },
        secretPlaceholder() {
            // a stored access key id implies a stored secret beside it
            if(!this.editing || !this.initialValues?.AWS_ACCESS_KEY_ID) return ''
            return __('Leave blank to keep the current secret')
        },
        saveDisabled() {
            if(this.saving) return true
            if(this.usingRoleArn) return !this.arnIsValid
            if(this.selectedMethod == ACCESS_KEY) {
                if(!this.accessKey) return true
                // Editing keeps whatever secret is stored unless a new one is
                // typed -- patchEnv skips blank values. Requiring it again to
                // change a region, or because the id was edited, is busywork.
                return !(this.secretKey || this.editing)
            }
            return true
        },
    },
    watch: {
        async selectedMethod(method) {
            this.errorMessage = ''
            if([ARN_STACK, ARN_MANUAL].includes(method) && !this.externalId) {
                await this.loadAwsRole()
            }
        },
        roleName(value) {
            if(!VALID_ROLE_NAME.test(value)) {
                this.$nextTick(() => {
                    this.roleName = value.replace(/[^a-zA-Z0-9\-]/g, '')
                })
            }
        },
    },
    methods: {
        async loadAwsRole() {
            try {
                const {account_id, external_id, role_arn} = await fetchAwsRole(this.getHomeProjectPath, this.environmentName)
                this.accountId = account_id
                this.externalId = external_id
                if(role_arn && !this.roleArn) this.roleArn = role_arn
            } catch(e) {
                this.errorMessage = e.message
            }
        },
        async copy(value) {
            try {
                await navigator.clipboard.writeText(value)
            } catch(e) {
                console.error(e)
            }
        },
        async onSave() {
            this.errorMessage = ''
            this.saving = true
            try {
                if(this.selectedMethod == ACCESS_KEY) {
                    // Never leaves the browser for our server: the keys are
                    // environment-scoped CI variables the deployment job reads.
                    await patchEnv(
                        {
                            AWS_ACCESS_KEY_ID: this.accessKey,
                            AWS_SECRET_ACCESS_KEY: this.secretKey,
                            AWS_DEFAULT_REGION: this.selectedRegion,
                        },
                        this.environmentName,
                        this.getHomeProjectPath,
                    )
                } else {
                    await saveProvider(this.getHomeProjectPath, this.environmentName, {
                        provider: 'aws',
                        region: this.selectedRegion,
                        role_arn: this.trimmedArn,
                    })
                }
                this.$emit('saved', 'aws')
            } catch(e) {
                // The environment already exists; a refused role is something the
                // user fixes in AWS and retries, so nothing is torn down here.
                this.errorMessage = e.message
            } finally {
                this.saving = false
            }
        },
    },
}
</script>
<template>
    <div class="aws-provider-setup" data-testid="aws-provider-setup">
        <h3>{{__('Authenticate your AWS Account')}}</h3>

        <gl-alert
            v-if="errorMessage"
            class="gl-mb-5"
            variant="danger"
            data-testid="aws-provider-error"
            @dismiss="errorMessage = ''"
        >
            {{errorMessage}}
        </gl-alert>

        <aside>
            <h4>Select your Region:</h4>
            <gl-dropdown data-testid="aws-region-dropdown" :text="selectedRegion">
                <gl-dropdown-item
                    v-for="region in $options.AWS_REGIONS"
                    :key="region"
                    @click="selectedRegion = region"
                >
                    {{region}}
                </gl-dropdown-item>
            </gl-dropdown>
            <p class="gl-mt-3 gl-mb-0 gl-text-subtle">
                Select the default region you want to use. Make sure you have access to this region
                for your role to be able to authenticate.
                Learn more about
                <gl-link :href="$options.REGIONS_HELP_URL" target="_blank">Regions <gl-icon name="external-link"/></gl-link>.
            </p>
        </aside>

        <section>
            <h4>Select an authentication method:</h4>
            <gl-dropdown data-testid="aws-method-dropdown" :text="methodText">
                <gl-dropdown-item
                    v-for="option in methodOptions"
                    :key="option.value"
                    @click="selectedMethod = option.value"
                >
                    {{option.text}}
                </gl-dropdown-item>
            </gl-dropdown>
        </section>

        <section v-if="selectedMethod == $options.ACCESS_KEY">
            <h4>1. AWS Access key ID:</h4>
            <gl-form-input v-model="accessKey" data-testid="aws-access-key-id"/>
            <h4 class="gl-mt-5">2. AWS Secret access key:</h4>
            <fake-password
                :value="secretKey"
                :placeholder="secretPlaceholder"
                data-testid="aws-secret-access-key"
                @input="secretKey = $event"
            />
        </section>

        <section v-if="selectedMethod == $options.ARN_MANUAL">
            <h4>Account ID:</h4>
            <div class="gl-flex gl-items-center gl-gap-2">
                <gl-form-input readonly :value="accountId" data-testid="aws-account-id"/>
                <gl-button icon="copy-to-clipboard" :aria-label="__('Copy Account ID to clipboard')" @click="copy(accountId)"/>
            </div>
            <h4 class="gl-mt-5">External ID:</h4>
            <div class="gl-flex gl-items-center gl-gap-2">
                <gl-form-input readonly :value="externalId" data-testid="aws-external-id"/>
                <gl-button icon="copy-to-clipboard" :aria-label="__('Copy External ID to clipboard')" @click="copy(externalId)"/>
            </div>
            <p class="gl-mt-5">
                Use your Account ID and External ID above to create a Role ARN manually in AWS.
                Then copy/paste your Role ARN below.
                <gl-link :href="$options.ROLE_ARN_HELP_URL" target="_blank">Learn More</gl-link>.
            </p>
            <h4>Enter your Role ARN:</h4>
            <gl-form-input
                v-model="roleArn"
                class="role-arn"
                data-testid="aws-role-arn"
                placeholder="arn:aws:iam::xxxxxxxxxxxx:role/UnfurlDeployRole"
            />
        </section>

        <section v-if="selectedMethod == $options.ARN_STACK">
            <h4>1. Create a Role ARN using AWS stack:</h4>
            <h4 class="gl-mt-5">Role Name:</h4>
            <gl-form-input v-model="roleName" data-testid="aws-role-name"/>
            <div class="gl-mt-4 gl-flex gl-justify-end">
                <gl-button
                    variant="confirm"
                    data-testid="aws-create-stack"
                    :disabled="!selectedRegion || !roleName || !externalId"
                    :href="awsCloudFormationLink"
                    target="_blank"
                    rel="noopener noreferrer"
                >Create Stack</gl-button>
            </div>
            <p class="gl-mt-4">
                Click the blue “Create Stack” button above. This will take you to your AWS console.
                In AWS, scroll down and click the acknowledgement check box in the blue area at the
                bottom, and then click the orange button “Create Stack”.
            </p>
            <img :src="$options.CreateStackImage" alt="">

            <h4 class="gl-mt-6">2. Paste your Role ARN from AWS:</h4>
            <gl-form-input
                v-model="roleArn"
                class="role-arn"
                data-testid="aws-role-arn"
                placeholder="arn:aws:iam::xxxxxxxxxxxx:role/UnfurlDeployRole"
            />
            <p class="gl-mt-4">
                Once your stack has been created in AWS, click on the “Outputs” tab and copy/paste
                the value of your Role ARN (outlined in red below).
            </p>
            <img :src="$options.SelectDeployRoleImage" alt="">
        </section>

        <div class="gl-mt-5 gl-flex gl-justify-end gl-gap-3" :class="{'form-actions': !editing}">
            <gl-button
                variant="confirm"
                :disabled="saveDisabled"
                :loading="saving"
                data-testid="aws-provider-save"
                @click="onSave"
            >
                <gl-icon name="disk"/>
                {{__('Save')}}
            </gl-button>
            <gl-button v-if="!editing" data-testid="aws-provider-cancel" @click="$emit('cancel')">{{__('Cancel')}}</gl-button>
        </div>
    </div>
</template>
<style scoped>
.aws-provider-setup aside,
.aws-provider-setup section,
.aws-provider-setup .form-actions {
    max-width: 700px;
}

.aws-provider-setup aside,
.aws-provider-setup section {
    padding: 1.5em;
    border-width: 1px;
}

/* 15.11 hardcoded #FAF9FA / #2F3030 and switched on .gl-dark; the tokens carry
   both themes, so the dark rule is gone rather than ported */
.aws-provider-setup aside {
    background-color: var(--gl-background-color-subtle);
    border-style: solid;
    border-color: var(--gl-border-color-default);
}

.aws-provider-setup h4 {
    font-size: 1.15rem;
    margin-bottom: 0.25rem;
}

.aws-provider-setup .role-arn {
    width: 30em;
    max-width: 100%;
}

.aws-provider-setup img {
    max-width: 100%;
}

/* the region and method lists size themselves to their toggle otherwise */
.aws-provider-setup :deep(.dropdown-menu) {
    width: unset !important;
}
</style>
