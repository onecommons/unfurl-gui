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
// Parsing is not the same as being a key: Save needs project_id, so a JSON file
// that is not a service account key left the button dead with nothing said.
const NOT_A_KEY_MESSAGE = 'That file is valid JSON but not a service account key: it has no "project_id".'

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
        // Reopened on an environment that already has a provider, rather than
        // collecting one for the first time.
        editing: {
            type: Boolean,
            default: false,
        },
        // Environment variables as already stored, so an edit shows what is set.
        // The key itself is write-only and never comes back.
        initialValues: {
            type: Object,
            default: () => ({}),
        },
    },
    emits: ['saved', 'cancel'],
    data() {
        return {
            fileName: '',
            fileContents: null,
            zone: this.initialValues?.CLOUDSDK_COMPUTE_ZONE || '',
            gcpProjectId: this.initialValues?.CLOUDSDK_CORE_PROJECT || '',
            gcpProjects: [],
            projectSearchTerm: '',
            loadingProjects: false,
            saving: false,
            errorMessage: '',
            signInExpired: false,
            dragging: false,
        }
    },
    computed: {
        ...mapGetters(['getHomeProjectPath']),
        // The consent screen has to come back to a full page load, so this is a
        // path on this origin rather than a router route.
        signInHref() {
            // editProvider has to survive the round-trip: without it the user
            // comes back from Google to a page that suppresses this panel.
            const edit = this.editing? '&editProvider': ''
            const returnTo = `${projectPathToHomeRoute(this.getHomeProjectPath)}/-/environments/${this.environmentName}?provider=gcp&signed_in=1${edit}`
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
        // `searchable` only renders the box and emits the term -- filtering the
        // list is the consumer's job
        filteredProjectItems() {
            const term = this.projectSearchTerm.trim().toLowerCase()
            if(!term) return this.projectItems
            return this.projectItems.filter(({value, text}) =>
                value.toLowerCase().includes(term) || text.toLowerCase().includes(term))
        },
        projectToggleText() {
            if(!this.gcpProjectId) return 'Select project'
            return this.projectItems.find(item => item.value == this.gcpProjectId)?.text || this.gcpProjectId
        },
        zonePlaceholder() {
            if(this.usingGoogleSignIn && !this.gcpProjectId) return 'Select project to choose zone'
            return 'Select zone'
        },
        // What to call the credential in the panel: the file just picked, or the
        // one already stored, which has a project id but no filename.
        keyLabel() {
            if(this.hasKey) return this.fileName
            return this.initialValues?.CLOUDSDK_CORE_PROJECT?
                `Current key on file (${this.initialValues.CLOUDSDK_CORE_PROJECT})`:
                'Current key on file'
        },
        keyOnFile() {
            return !!(this.editing && this.initialValues?.CLOUDSDK_CORE_PROJECT)
        },
        saveDisabled() {
            if(this.saving) return true
            if(this.usingGoogleSignIn) return !(this.gcpProjectId && this.zone)
            // no project id means the key was rejected or is not a service
            // account key, whatever the zone says -- unless one is already on
            // file, in which case a zone change alone is a legitimate edit
            if(!VALID_ZONE.test(this.zone)) return true
            return !(this.keyProjectId || this.keyOnFile)
        },
        // Say why Save is dead. Without this the zone requirement is invisible:
        // the key uploads cleanly and the button simply never enables.
        saveHint() {
            if(this.saving || !this.saveDisabled) return ''
            if(this.usingGoogleSignIn) {
                if(!this.gcpProjectId) return __('Choose a project to continue.')
                return this.zone? '': __('Choose a zone to continue.')
            }
            if(!this.keyProjectId && !this.keyOnFile) {
                // a rejected file is already explained by the alert above;
                // having picked nothing at all is not
                return this.hasKey? '': __('Upload a service account key or sign in with Google to continue.')
            }
            return VALID_ZONE.test(this.zone)? '': __('Choose a zone to continue.')
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
                this.gcpProjects = (await fetchGcpProjects(this.getHomeProjectPath, this.environmentName)) || []
            } catch(e) {
                // No usable token: the only way forward is to sign in again.
                this.signInExpired = true
                this.errorMessage = e.message
            } finally {
                this.loadingProjects = false
            }
        },
        async readKeyFile(file) {
            if(!file) return // the picker was dismissed, or a drop carried no file
            this.fileName = file.name
            try {
                this.fileContents = JSON.parse(await file.text())
                this.errorMessage = this.keyProjectId? '': NOT_A_KEY_MESSAGE
            } catch(e) {
                // an empty object rather than nothing, so the panel keeps naming
                // the rejected file -- which says which one failed, while the
                // Upload button above is how another gets picked
                this.fileContents = {}
                this.errorMessage = INVALID_KEY_MESSAGE
            }
        },
        onFileChanged(event) {
            return this.readKeyFile(event?.target?.files?.[0])
        },
        onFileDropped(event) {
            this.dragging = false
            return this.readKeyFile(event?.dataTransfer?.files?.[0])
        },
        async saveServiceAccountKey() {
            const patch = {
                CLOUDSDK_COMPUTE_ZONE: {value: this.zone, masked: false, protected: true},
            }

            // Only when a file was actually picked. Editing an environment to
            // change nothing but the zone leaves fileContents null, and writing
            // JSON.stringify(null) here replaced a real service account key with
            // the four-character string "null" -- silently, since patchEnv skips
            // empty values but "null" is not empty. The stored key is unreadable
            // from here, so there is nothing to round-trip and re-send: the only
            // safe move is to leave it alone.
            if(this.hasKey) {
                patch.GOOGLE_APPLICATION_CREDENTIALS = {
                    value: JSON.stringify(this.fileContents),
                    variable_type: 'file',
                    masked: false,
                    protected: true,
                }
                patch.CLOUDSDK_CORE_PROJECT = {value: this.keyProjectId, masked: false, protected: true}
            }

            await patchEnv(patch, this.environmentName, this.getHomeProjectPath)
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
    <div
        class="gcp-provider-setup"
        data-testid="gcp-provider-setup"
        @dragover.prevent
        @dragenter.prevent="dragging = true"
        @dragleave.self="dragging = false"
        @drop.prevent="onFileDropped"
    >
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
                    :items="filteredProjectItems"
                    :selected="gcpProjectId"
                    :toggle-text="projectToggleText"
                    @search="projectSearchTerm = $event"
                    @select="gcpProjectId = $event"
                />
                <p class="gl-mt-2 gl-text-subtle">
                    To use a new project, first create one on
                    <gl-link :href="$options.NEW_PROJECT_URL" target="_blank">Google Cloud Platform <gl-icon name="external-link"/></gl-link>.
                </p>

                <h4 class="gl-mt-5">Zone</h4>
                <gcp-zone-dropdown
                    :model-value="zone"
                    :disabled="!gcpProjectId"
                    :placeholder="zonePlaceholder"
                    @update:modelValue="zone = $event"
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
                    <!-- dragover must be prevented as well as drop, or the browser
                         navigates to the file instead of handing it over -->
                    <div
                        class="gcp-key-dropzone gl-rounded-base gl-p-4"
                        :class="{'is-dragging': dragging}"
                        data-testid="gcp-key-dropzone"
                    >
                        <gl-button data-testid="gcp-upload-key" icon="upload" @click="$refs.fileInput.click()">Upload Service Account Key</gl-button>
                        <div class="gl-mt-2">
                            Drop the credentials for <code>GOOGLE_APPLICATION_CREDENTIALS</code> here, or upload them.
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

                <!-- keyOnFile as well as hasKey: editing an environment whose
                     key is already stored has no fileName, and gating on that
                     alone left the zone with nowhere to render. -->
                <template v-if="hasKey || keyOnFile">
                    <hr>
                    <div class="gl-mb-4">
                        <span class="gl-font-bold" data-testid="gcp-key-filename">{{keyLabel}}</span>
                    </div>
                    <div class="gl-flex gl-items-center gl-gap-3">
                        <label class="gl-mb-0">Zone</label>
                        <gcp-zone-dropdown :model-value="zone" @update:modelValue="zone = $event"/>
                    </div>
                    <p class="gl-mt-2 gl-text-subtle">
                        Learn more about
                        <gl-link :href="$options.ZONES_HELP_URL" target="_blank">zones <gl-icon name="external-link"/></gl-link>.
                    </p>
                </template>
            </template>
        </div>

        <div class="gl-mt-5 gl-flex gl-justify-end gl-items-center gl-gap-3" :class="{'form-actions': !editing}">
            <span v-if="saveHint" class="gl-text-subtle" data-testid="gcp-save-hint">{{saveHint}}</span>
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
            <gl-button v-if="!editing" data-testid="gcp-provider-cancel" @click="$emit('cancel')">{{__('Cancel')}}</gl-button>
        </div>
    </div>
</template>
<style scoped>
.gcp-key-dropzone {
    border: 1px dashed var(--gl-border-color-default, #dcdcde);
    transition: background-color 0.1s ease-in-out, border-color 0.1s ease-in-out;
}
.gcp-key-dropzone.is-dragging {
    border-color: var(--gl-color-blue-500, #1f75cb);
    background-color: var(--gl-background-color-strong, rgba(31, 117, 203, 0.08));
}

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
