<script>
import {GlAlert, GlButton, GlCollapsibleListbox, GlIcon, GlLink} from '@gitlab/ui'
import {mapActions, mapGetters} from 'vuex'
import {__} from '~/locale'
import {patchEnv} from 'oc_vue_shared/client_utils/envvars'
import {initUnfurlEnvironment} from 'oc_vue_shared/client_utils/environments'
import {fetchGcpProjects, gcpAuthorizeUrl, saveProvider} from 'oc_vue_shared/client_utils/environment-providers'
import {projectPathToHomeRoute} from 'oc_vue_shared/client_utils/dashboard'
import {lookupCloudProviderAlias} from 'oc_vue_shared/util'
import GoogleAuthButton from './google-auth-button.vue'
import GcpZoneDropdown from './gcp-zone-dropdown.vue'

const VALID_ZONE = /\w+-\w+\d-\w/
const INVALID_KEY_MESSAGE = 'Your service credentials key is invalid JSON.'

export default {
    name: 'GcpProviderSetup',
    compatConfig: {MODE: 3},
    components: {
        GlAlert,
        GlButton,
        GlCollapsibleListbox,
        GlIcon,
        GlLink,
        GoogleAuthButton,
        GcpZoneDropdown,
    },
    SERVICE_ACCOUNT_HELP_URL: 'https://cloud.google.com/docs/authentication/getting-started',
    ZONES_HELP_URL: 'https://cloud.google.com/compute/docs/regions-zones/regions-zones',
    NEW_PROJECT_URL: 'https://console.cloud.google.com/projectcreate',
    props: {
        environmentName: {
            type: String,
            required: true,
        },
        // Set once the user is back from Google's consent screen; the token it
        // left is in the Rails session, not here.
        signedIn: {
            type: Boolean,
            default: false,
        },
    },
    emits: ['saved', 'cancel'],
    data() {
        return {
            fileName: '',
            fileContents: null,
            zone: '',
            gcpProjectId: '',
            gcpProjects: [],
            loadingProjects: false,
            saving: false,
            errorMessage: '',
            signInExpired: false,
        }
    },
    computed: {
        ...mapGetters(['getHomeProjectPath']),
        // The consent screen has to come back to a full page load, so this is a
        // path on this origin rather than a router route.
        signInHref() {
            const returnTo = `${projectPathToHomeRoute(this.getHomeProjectPath)}/-/environments/${this.environmentName}?provider=gcp&signed_in=1`
            return gcpAuthorizeUrl(this.getHomeProjectPath, this.environmentName, returnTo)
        },
        usingGoogleSignIn() {
            return this.signedIn && !this.signInExpired
        },
        keyProjectId() {
            return this.fileContents?.project_id
        },
        hasKey() {
            return !!(this.fileContents && this.fileName)
        },
        projectItems() {
            return this.gcpProjects.map(({project_id, name}) => ({value: project_id, text: name || project_id}))
        },
        projectToggleText() {
            if(!this.gcpProjectId) return 'Select project'
            return this.projectItems.find(item => item.value == this.gcpProjectId)?.text || this.gcpProjectId
        },
        zonePlaceholder() {
            if(this.usingGoogleSignIn && !this.gcpProjectId) return 'Select project to choose zone'
            return 'Select zone'
        },
        showFooter() {
            return this.hasKey || this.usingGoogleSignIn
        },
        saveDisabled() {
            if(this.saving) return true
            if(this.usingGoogleSignIn) return !(this.gcpProjectId && this.zone)
            // no project id means the key was rejected or is not a service
            // account key, whatever the zone says
            return !(this.keyProjectId && VALID_ZONE.test(this.zone))
        },
    },
    methods: {
        ...mapActions(['deployInto']),
        googleAuthFlow() {
            window.location.href = this.signInHref
        },
        async loadProjects() {
            this.loadingProjects = true
            try {
                this.gcpProjects = await fetchGcpProjects(this.getHomeProjectPath, this.environmentName)
            } catch(e) {
                // No usable token: the only way forward is to sign in again.
                this.signInExpired = true
                this.errorMessage = e.message
            } finally {
                this.loadingProjects = false
            }
        },
        async onFileChanged(event) {
            const file = event?.target?.files?.[0]
            if(!file) return // the picker was dismissed
            this.fileName = file.name
            try {
                this.fileContents = JSON.parse(await file.text())
                this.errorMessage = ''
            } catch(e) {
                // an empty object rather than nothing, so the panel keeps showing
                // the rejected file with "(Select a different file)" beside it
                this.fileContents = {}
                this.errorMessage = INVALID_KEY_MESSAGE
            }
        },
        async saveServiceAccountKey() {
            await patchEnv(
                {
                    GOOGLE_APPLICATION_CREDENTIALS: {
                        value: JSON.stringify(this.fileContents),
                        variable_type: 'file',
                        masked: false,
                        protected: true,
                    },
                    CLOUDSDK_CORE_PROJECT: {value: this.keyProjectId, masked: false, protected: true},
                    CLOUDSDK_COMPUTE_ZONE: {value: this.zone, masked: false, protected: true},
                },
                this.environmentName,
                this.getHomeProjectPath,
            )
        },
        async saveGoogleSignIn() {
            try {
                await saveProvider(this.getHomeProjectPath, this.environmentName, {
                    provider: 'gcp',
                    gcp_project_id: this.gcpProjectId,
                    zone: this.zone,
                })
            } catch(e) {
                // The server wants more than ten minutes left on the Google token,
                // so a save this long after the consent screen is refused the same
                // way a project listing is: the way out is to sign in again.
                this.signInExpired = true
                throw e
            }

            // The bootstrap deployment creates the service account the environment
            // will use from here on, and the Google token it needs is an hour old at
            // most -- so it runs now, in this page session, not after a reload.
            const environmentName = this.environmentName
            const deployPath = `environments/${environmentName}/primary_provider`

            await initUnfurlEnvironment(
                this.getHomeProjectPath,
                {
                    name: environmentName,
                    primary_provider: {
                        name: 'primary_provider',
                        type: lookupCloudProviderAlias('gcp'),
                        __typename: 'ResourceTemplate',
                    },
                },
                {environment: environmentName, deployment_blueprint: null, deployment_path: deployPath},
            )

            // environmentTriggerPipeline never throws -- it reports through the
            // store and returns nothing. Left unchecked, a bootstrap that never
            // started would look like a successful save, and the page load that
            // follows would discard the store and its error with it.
            const triggered = await this.deployInto({
                workflow: 'deploy',
                environmentName,
                deployPath,
                deploymentName: 'primary_provider',
                SYSTEM_DEPLOYMENT: '1',
            })

            if(!triggered) {
                throw new Error('Could not start the deployment that creates the service account')
            }
        },
        async onSave() {
            this.errorMessage = ''
            this.saving = true
            try {
                if(this.usingGoogleSignIn) {
                    await this.saveGoogleSignIn()
                } else {
                    await this.saveServiceAccountKey()
                }
                this.$emit('saved', 'gcp')
            } catch(e) {
                this.errorMessage = e.message
            } finally {
                this.saving = false
            }
        },
    },
    created() {
        if(this.signedIn) this.loadProjects()
    },
}
</script>
<template>
    <div class="gcp-provider-setup" data-testid="gcp-provider-setup">
        <h3>Authenticate your Google Cloud Platform Account</h3>

        <gl-alert
            v-if="errorMessage"
            class="gl-mb-5"
            variant="danger"
            data-testid="gcp-provider-error"
            @dismiss="errorMessage = ''"
        >
            {{errorMessage}}
        </gl-alert>

        <div class="setup-container">
            <template v-if="usingGoogleSignIn">
                <h4>Google Cloud Platform project</h4>
                <gl-collapsible-listbox
                    data-testid="gcp-project-dropdown"
                    searchable
                    search-placeholder="Search projects"
                    :loading="loadingProjects"
                    :items="projectItems"
                    :selected="gcpProjectId"
                    :toggle-text="projectToggleText"
                    @select="gcpProjectId = $event"
                />
                <p class="gl-mt-2 gl-text-subtle">
                    To use a new project, first create one on
                    <gl-link :href="$options.NEW_PROJECT_URL" target="_blank">Google Cloud Platform <gl-icon name="external-link"/></gl-link>.
                </p>

                <h4 class="gl-mt-5">Zone</h4>
                <gcp-zone-dropdown
                    v-model="zone"
                    :disabled="!gcpProjectId"
                    :placeholder="zonePlaceholder"
                />
                <p class="gl-mt-2 gl-text-subtle">
                    Learn more about
                    <gl-link :href="$options.ZONES_HELP_URL" target="_blank">zones <gl-icon name="external-link"/></gl-link>.
                </p>
            </template>

            <template v-else>
                <h4>Select an authentication method:</h4>
                <div class="gl-mt-4 gl-flex gl-flex-col gl-gap-5">
                    <div>
                        <google-auth-button @click="googleAuthFlow"/>
                        <div class="gl-mt-2">Sign-in to Google to connect unfurl.cloud with your Google Cloud project.</div>
                    </div>
                    <div>
                        <gl-button data-testid="gcp-upload-key" icon="upload" @click="$refs.fileInput.click()">Upload Service Account Key</gl-button>
                        <div class="gl-mt-2">
                            Upload credentials for <code>GOOGLE_APPLICATION_CREDENTIALS</code>.
                            <br>
                            <gl-link :href="$options.SERVICE_ACCOUNT_HELP_URL" target="_blank">Learn more about service account authentication</gl-link>.
                        </div>
                    </div>
                </div>

                <input
                    ref="fileInput"
                    class="gl-hidden"
                    type="file"
                    accept="application/json,.json"
                    @change="onFileChanged"
                >

                <template v-if="hasKey">
                    <hr>
                    <div class="gl-mb-4">
                        <span class="gl-font-bold" data-testid="gcp-key-filename">{{fileName}}</span>
                        <gl-button variant="link" @click="$refs.fileInput.click()">(Select a different file)</gl-button>
                    </div>
                    <div class="gl-flex gl-items-center gl-gap-3">
                        <label class="gl-mb-0">Zone</label>
                        <gcp-zone-dropdown v-model="zone"/>
                    </div>
                    <p class="gl-mt-2 gl-text-subtle">
                        Learn more about
                        <gl-link :href="$options.ZONES_HELP_URL" target="_blank">zones <gl-icon name="external-link"/></gl-link>.
                    </p>
                </template>
            </template>
        </div>

        <div v-if="showFooter" class="form-actions gl-mt-5 gl-flex gl-justify-end gl-gap-3">
            <gl-button
                variant="confirm"
                :disabled="saveDisabled"
                :loading="saving"
                data-testid="gcp-provider-save"
                @click="onSave"
            >
                <gl-icon name="disk"/>
                {{__('Save')}}
            </gl-button>
            <gl-button data-testid="gcp-provider-cancel" @click="$emit('cancel')">{{__('Cancel')}}</gl-button>
        </div>
    </div>
</template>
<style scoped>
.gcp-provider-setup .setup-container,
.gcp-provider-setup .form-actions {
    /* 700px matches the AWS panel */
    max-width: 700px;
}

.gcp-provider-setup .setup-container {
    display: inline-block;
    padding: 0.75em 2em 1.5em;
    margin-top: 0.5em;
    border-top: 1px solid var(--gl-border-color-default);
}

.gcp-provider-setup h4 {
    font-size: 1.15rem;
}
</style>
