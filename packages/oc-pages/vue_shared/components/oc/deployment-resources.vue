<script>
import { GlModal, GlModalDirective, GlFormGroup, GlFormInput, GlFormCheckbox} from '@gitlab/ui';
import { cloneDeep } from 'lodash';
import { mapGetters, mapActions, mapMutations } from 'vuex';
import createFlash, { FLASH_TYPES } from '~/flash';
import axios from '~/lib/utils/axios_utils';
import { redirectTo } from '~/lib/utils/url_utility';
import { __ } from '~/locale';
import OcCard from '../../../project_overview/components/shared/oc_card.vue';
import OcInputs from '../../../project_overview/components/shared/oc_inputs.vue';
import OcList from '../../../project_overview/components/shared/oc_list.vue';
import OcListResource from '../../../project_overview/components/shared/oc_list_resource.vue';
import OcTemplateHeader from '../../../project_overview/components/shared/oc_template_header.vue';
import TemplateButtons from '../../../project_overview/components/template/template_buttons.vue';
import { slugify } from '../../util.mjs'
import { deleteDeploymentTemplate } from '../../../project_overview/store/modules/deployment_template_updates'



const statusPropDefinition = {
    type: String,
    default: () => 'hidden'
}

export default {
    name: 'DeploymentResources',
    components: {
        GlModal,
        GlFormGroup,
        GlFormInput,
        GlFormCheckbox,
        OcCard,
        OcInputs,
        OcList,
        OcListResource,
        OcTemplateHeader,
        TemplateButtons
    },

    props: {
        bus: Object,
        saveStatus: statusPropDefinition,
        deleteStatus: statusPropDefinition,
        mergeStatus: statusPropDefinition,
        deployStatus: statusPropDefinition,
        cancelStatus: statusPropDefinition,
        displayValidation: {
            type: Boolean,
            default: false,
        },
        displayStatus: {
            type: Boolean,
            default: false,
        }
    },

    directives: {
        GlModal: GlModalDirective
    },

    data() {
        return {
            uiTimeout: null,
            createNodeResourceData: {},
            deleteNodeData: {},
            loadingDeployment: false,
            deployButton: false,
            requirementTemp: {},
            resourceName: '',
            userEditedResourceName: false,
            alertNameExists: null,
            titleKey: '',
            dataUnsaved: false,
            selectedRequirement: {},
            selectedTemplate: {},
            completedRequirements: false,
            completedMainInputs: false,
            failedToLoad: false,
            selected: {},
            autoSaveTime: 2000,
            nodeTitle: '',
            nodeLevel: null,
            nodeAction: '',
            durationOfAlerts: 5000,
            checkedNode: true,
            selectedServiceToConnect: '',
        };
    },

    computed: {
        ...mapGetters([
            'getPrimaryCard',
            'primaryCardProperties',
            'getCardProperties',
            'getCardsStacked',
            'getDeploymentTemplate',
            'getDependencies',
            'hasPreparedMutations',
            'matchIsValid',
            'resolveMatchTitle',
            'cardIsValid',
            'getUsername',
            'getHomeProjectPath',
            'getValidResourceTypes',
            'getValidConnections',
            'getHomeProjectPath',
            'getApplicationBlueprint'
        ]),

        pipelinesPath(){
            return `/${this.getHomeProjectPath}/-/pipelines`
        },
        deploymentDir() {
            const environment = this.$route.params.environment
            // this.getDeploymentTemplate.name not loaded yet
            return `environments/${environment}/${this.getProjectInfo.name}/${this.$route.params.slug}`
        },

        // TODO remove this
        shouldRenderTemplates() {
            return true
        },
        getMainInputs() {
            return cloneDeep(this.$store.getters.getProjectInfo.inputs);
        },

        primaryPropsDelete() {
            return {
                text: this.nodeAction || __('Delete'),
                attributes: [{ category: 'primary' }, { variant: 'danger' }],
            };
        },

        getNameResourceModal() {
            return this.selectedRequirement?.name || __('Resource')
        },

        ocTemplateResourcePrimary() {
            return {
                text: __("Next"),
                attributes: [{ category: 'primary' }, { variant: 'info' }, { disabled: (this.resourceName.length === 0 || this.alertNameExists || Object.keys(this.selected).length === 0) }]
            };
        },

        ocResourceToConnectPrimary() {
            return {
                text: __("Next"),
                attributes: [{ category: 'primary' }, { variant: 'info' }, { disabled: Object.keys(this.selectedServiceToConnect).length === 0 }]
            };
        },

        cancelProps() {
            return {
                text: __('Cancel'),
            };
        },
    },

    watch: {
        selected: function(val) {
            if(Object.keys(val).length > 0) {
                if(!this.userEditedResourceName) {
                    this.resourceName = val.name;
                }
            }
        },

        resourceName: function(val) {
            this.alertNameExists = this.matchIsValid(slugify(val));
        }
    },
    created() {
        //this.syncGlobalVars(this.$projectGlobal);
        if (this.$props.bus) {

            const {bus} = this.$props
            bus.$on('moveToElement', (obj) => {
                const { elId } = obj;
                this.scrollDown(elId, 500);
            });

            bus.$on('placeTempRequirement', (obj) => {
                const ref = this.$refs['oc-template-resource'];
                setTimeout(() => {
                    this.createNodeResourceData = obj;
                    ref.show();
                }, 100);
            });

            bus.$on('launchModalToConnect', (obj) => {
                this.connectNodeResourceData = obj;
                this.launchModal('oc-connect-resource', 250);
            });

            bus.$on('deleteNode', (obj) => {
                this.deleteNodeData = obj;
                this.nodeAction = obj.action? obj.action : __('Delete');

                this.nodeTitle = this.resolveMatchTitle(obj.name);
                this.launchModal('oc-delete-node', 500);
            });
        }
    },

    beforeMount() {
        // NOTE this doesn't work without https
        window.addEventListener('beforeunload', this.unloadHandler);
        this.setRouterHook((to, from, next) => {
            if(this.hasPreparedMutations) {
                const result = confirm(__('You have unsaved changes.  Press OK to continue'));
                if(!result) { next(false); return; } // never call next twice
                this.clearPreparedMutations();
            }
            next();
        });
        this.selectedRequirement = cloneDeep(this.getApplicationBlueprint?.primary)
    },

    beforeDestroy() {
        window.removeEventListener('beforeunload', this.unloadHandler);
        this.resetTemplateResourceState();
        this.setRouterHook();
    },

    methods: {
        ...mapMutations([
            'resetTemplateResourceState',
            'setRouterHook',
            'clearPreparedMutations',
            'resetStagedChanges',
            'onApplicationBlueprintLoaded',
            'setUpdateObjectPath',
            'setUpdateObjectProjectPath',
            'pushPreparedMutation'
        ]),
        ...mapActions([
            'syncGlobalVars',
            'createNodeResource',
            'savePrimaryCard',
            'saveCards',
            'saveTemplateResources',
            'deleteNode',
            'saveResourceInState',
            'connectNodeResource',
            'deleteDeploymentTemplate',
            'commitPreparedMutations',
            'populateTemplateResources',
        ]),

        unloadHandler(e) {
            if(this.hasPreparedMutations) {
                // NOTE most users will not see this message because browsers can override it
                e.returnValue = "You have unsaved changes.";
            }
        },

        scrollDown(elId, timeOut=0) {
            clearTimeout(this.uiTimeout);  
            const anchorId = btoa(elId).replace(/=/g, '');
            const anchor = document.querySelector(`#${anchorId}`);
            this.uiTimeout = setTimeout(
                () => {
                    anchor.scrollIntoView({behavior: "smooth", block: "center", inline: "start"});
                },
                timeOut,
            );
        },

        launchModal(refId, timeToWait) {
            const ref = this.$refs[refId];
            setTimeout(() => {
                ref.show();
            }, timeToWait);
        },

        async createDeploymentPathPointer() {
            this.setUpdateObjectPath('environments.json')
            this.setUpdateObjectProjectPath(this.getHomeProjectPath)
            const environment = this.$route.params.environment
            this.pushPreparedMutation(() => {
                return [{
                    typename: 'DeploymentPath',
                    patch: {__typename: 'DeploymentPath', environment},
                    target: this.deploymentDir
                }]
            })
            await this.commitPreparedMutations()
        },

        async triggerSave() {
            try {
                await this.commitPreparedMutations();
                createFlash({
                    message: __('Template was saved successfully!'),
                    type: FLASH_TYPES.SUCCESS,
                    duration: this.durationOfAlerts,
                });
                return true;
            } catch (e) {
                console.error(e);
                createFlash({ message: e.message, type: FLASH_TYPES.ALERT });
                return false;
            }
        },

        async triggerDeployment() {
            try {
                this.deployButton = false;
                this.loadingDeployment = true;
                await this.triggerSave();
                await this.createDeploymentPathPointer()
                const { data } = await axios.post(this.pipelinesPath, { ref: this.refValue.fullName });
                createFlash({ message: __('The pipeline was triggered successfully'), type: FLASH_TYPES.SUCCESS, duration: this.durationOfAlerts });
                return redirectTo(`${this.pipelinesPath}/${data.id}`);
            } catch (err) {
                const { errors = [] } = err?.response?.data;
                const [error] = errors;
                this.deployButton = true;
                this.loadingDeployment = false;
                return createFlash({ message: error, type: FLASH_TYPES.ALERT, duration: this.durationOfAlerts });
            }
        },

        cleanModalResource() {
            this.resourceName = '';
            this.selected = {};
            this.userEditedResourceName = false;
        },

        async onSubmitDeleteTemplateModal() {
            try {
                this.clearPreparedMutations();
                this.resetStagedChanges();
                this.pushPreparedMutation(deleteDeploymentTemplate({name: this.$route.params.slug}))

                await this.commitPreparedMutations()
                //if (isOk) { deleteDeploymentTemplate should throw errors
                this.$router.push({ name: 'projectHome' }); // NOTE can we do this on failure too?
                //}
            }catch (e) {
                console.error(e);
                createFlash({ message: e.message, type: FLASH_TYPES.ALERT });
            }
        },

        openModalDeleteTemplate() {
            this.launchModal('oc-delete-template', 500);
        },


        // NOTE this kicks off instantiation of a ResourceTemplate from a ResourceType
        async onSubmitTemplateResourceModal() {
            try {
                const { name } = this.selected;
                const titleCard = this.resourceName || name;
                this.createNodeResourceData.name = slugify(this.resourceName);
                this.createNodeResourceData.title = this.resourceName;
                const created = await this.createNodeResource({...this.createNodeResourceData, selection: this.selected});
                if(created){
                    this.cleanModalResource();
                    this.scrollDown(this.createNodeResourceData.name, 500);
                    this.dataUnsaved = true;
                }
            }catch (e) {
                console.error(e);
                createFlash({ message: e.message, type: FLASH_TYPES.ALERT });
            }
        },

        async onSubmitModalConnect() {
            //throw new Error('connectNodeResource needs to be reimplemented')
            try { 
                const { name } = this.selectedServiceToConnect;
                await this.connectNodeResource({ nodeResource: name, ...this.connectNodeResourceData });
            }catch(e) {
                console.error(e);
                createFlash({ message: e.message, type: FLASH_TYPES.ALERT });
            }
        },

        async handleDeleteNode() {
            try {
                //this.clearPreparedMutations()
                const deleted = await this.deleteNode(this.deleteNodeData);

                if(deleted) this.dataUnsaved = true;
            } catch (e) {
                console.error(e);
                createFlash({ message: e.message, type: FLASH_TYPES.ALERT });
            }
        },

        checkAllRequirements() {
            return this.completedRequirements && this.completedMainInputs;
        },

        getLegendOfModal() {
            const gerundize = (word) => {
                let nword = word.toLowerCase();
                if ( nword.match( /[^aeiou]e$/i ) ) {
                    nword = nword.slice(0, nword.length-1);
                } else if ( nword.match( /[^aeiou][aeiou][^aeiou]$/i ) ) {
                    nword = nword + nword.slice(nword.length-1, nword.length);
                }
                return nword + 'ing';
            };
            return `Are you sure you want to ${this.nodeAction.toLowerCase()} <b>${this.nodeTitle}</b> ? ${gerundize(this.nodeAction)} <b>${this.nodeTitle}</b> might affect other (nodes ?) which are linked to it.`;
        },

        legendDeleteTemplate() {
            return `Are you sure you want to delete <b>${this.getDeploymentTemplate.title}</b> template ?`;
        },

        replaceSpaceWithDash(str){
            return str.replace(/ /g, '-');
        }
    },
};
</script>
<template>
    <div>
        <!-- Header of templates -->
        <oc-template-header :header-info="{ title: getDeploymentTemplate.title, cloud: getDeploymentTemplate.cloud, environment: $route.params.environment}"/>
            <!-- Content -->
        <div class="row-fluid gl-mt-6 gl-mb-6">
            <oc-card
                :display-validation="displayValidation"
                :display-status="displayStatus"
                :main-card-class="'primary-card'"
                :card="getPrimaryCard"
                :icon-title="true"
                :icon-color="checkAllRequirements() ? 'icon-green' : 'icon-red'"
                :icon-name="checkAllRequirements() ? 'check-circle-filled' : 'warning-solid'"
                >
                <template #content>
                    <!-- Inputs -->
                    <oc-inputs :card="getPrimaryCard" :main-inputs="primaryCardProperties" :component-key="1" />

                    <!-- Requirements List -->
                    <oc-list
                        tabs-title="Requirements"
                        :display-validation="displayValidation"
                        :display-status="displayStatus"
                        :title-key="getPrimaryCard.title"
                        :cloud="getDeploymentTemplate.cloud"
                        :deployment-template="getDeploymentTemplate"
                        :template-dependencies="getDependencies(getPrimaryCard.name)"
                        :level="1"
                        :show-type-first="true"
                        :card="getPrimaryCard"
                        />
                    <div v-if="getCardsStacked.length > 0">
                        <div class="gl-pl-6 gl-pr-6">
                            <oc-card
                                v-for="(card, idx) in getCardsStacked"
                                :key="__('levelOne-') + card.title"
                                :display-validation="displayValidation"
                                :display-status="displayStatus"
                                :card="card"
                                :icon-title="true"
                                :icon-color="card.status ? 'icon-green' : 'icon-red'"
                                :icon-name="card.status ? 'check-circle-filled' : 'warning-solid'"
                                :actions="true"
                                :level="idx"
                                class="gl-mt-6">
                                <template #content>
                                    <oc-inputs :card="card" :main-inputs="getCardProperties(card.name)" :component-key="2" />

                                    <oc-list
                                        tabs-title="Requirements"
                                        :display-validation="displayValidation"
                                        :display-status="displayStatus"
                                        :template-dependencies="getDependencies(card.name)"
                                        :deployment-template="getDeploymentTemplate"
                                        :level="idx"
                                        :title-key="card.title"
                                        :show-type-first="true" 
                                        :card="card"
                                        />

                                </template>
                            </oc-card>
                        </div>
                    </div>
                </template>
            </oc-card>
        </div>
        <!-- End Content -->

        <!-- Buttons -->
        <template-buttons 
            :loading-deployment="loadingDeployment"
            :deploy-button="deployButton"
            :save-status="saveStatus"
            :delete-status="deleteStatus"
            :merge-status="mergeStatus"
            :cancel-status="cancelStatus"
            :deploy-status="deployStatus"
            @saveTemplate="triggerSave()"
            @triggerDeploy="triggerDeployment()"
            @launchModalDeleteTemplate="openModalDeleteTemplate()"
            />


            <!-- Modal Resource Template -->
        <gl-modal
            ref="oc-template-resource"
            modal-id="oc-template-resource"
            size="lg"
            :title="`Choose a ${getNameResourceModal} template`"
            :action-primary="ocTemplateResourcePrimary"
            :action-cancel="cancelProps"
            @primary="onSubmitTemplateResourceModal"
            @cancel="cleanModalResource"
            >

            <oc-list-resource @input="e => selected = e" v-model="selected" :name-of-resource="getNameResourceModal" :filtered-resource-by-type="[]" :deployment-template="getDeploymentTemplate" :cloud="getDeploymentTemplate.cloud" :valid-resource-types="getValidResourceTypes(getNameResourceModal, getDeploymentTemplate)"/>

            <gl-form-group label="Name" class="col-md-4 align_left gl-pl-0 gl-mt-4">
                <gl-form-input id="input1" @input="_ => userEditedResourceName = true" v-model="resourceName" type="text"  /><small v-if="alertNameExists" class="alert-input">{{ __("The name can't be replicated. please edit the name!") }}</small>
            </gl-form-group>
        </gl-modal>

            <!-- Modal to delete -->
        <gl-modal
            ref="oc-delete-node"
            :modal-id="__('oc-delete-node')"
            size="md"
            :title="`${nodeAction} ${nodeTitle}`"
            :action-primary="primaryPropsDelete"
            :action-cancel="cancelProps"
            @primary="handleDeleteNode"
            >
            <p v-html="getLegendOfModal()"></p>
            <gl-form-checkbox v-model="checkedNode">
                <b>{{ nodeTitle }}</b>
            </gl-form-checkbox>
        </gl-modal>

        <!-- Modal Connect -->
        <gl-modal
            ref="oc-connect-resource"
            :modal-id="__('oc-connect-resource')"
            size="lg"
            :title="`Connect to  ${getNameResourceModal} resource`" :action-primary="ocResourceToConnectPrimary"
            :action-cancel="cancelProps"
            @primary="onSubmitModalConnect"
            >
            <oc-list-resource v-model="selectedServiceToConnect" :name-of-resource="getNameResourceModal" :filtered-resource-by-type="[]" :cloud="getDeploymentTemplate.cloud" :valid-resource-types="getValidConnections($route.params.environment, selectedRequirement)"/>
        </gl-modal>
        <gl-modal
            :ref="__('oc-delete-template')"
            :modal-id="__('oc-delete-template')"
            size="md"

            :title="`Delete Template ${selectedTemplate.title}`"
            :action-primary="primaryPropsDelete"
            :action-cancel="cancelProps"
            @primary="onSubmitDeleteTemplateModal"
            >
            <p v-html="legendDeleteTemplate()"></p>
        </gl-modal>
    </div>
</template>