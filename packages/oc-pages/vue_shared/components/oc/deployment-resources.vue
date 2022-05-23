<script>
import { GlModal, GlModalDirective, GlFormGroup, GlFormInput, GlFormCheckbox, GlTabs} from '@gitlab/ui';
import { cloneDeep } from 'lodash';
import { mapGetters, mapActions, mapMutations } from 'vuex';
import createFlash, { FLASH_TYPES } from '~/flash';
import axios from '~/lib/utils/axios_utils';
import { redirectTo } from '~/lib/utils/url_utility';
import { __ } from '~/locale';
import OcCard from '../../../project_overview/components/shared/oc_card.vue';
import OcList from '../../../project_overview/components/shared/oc_list.vue';
import OcListResource from '../../../project_overview/components/shared/oc_list_resource.vue';
import OcTemplateHeader from '../../../project_overview/components/shared/oc_template_header.vue';
import TemplateButtons from '../../../project_overview/components/template/template_buttons.vue';
import OcTab from '../../../vue_shared/components/oc/oc-tab.vue'
import { slugify } from '../../util.mjs'
import { deleteDeploymentTemplate } from '../../../project_overview/store/modules/deployment_template_updates'
import {bus} from 'oc_vue_shared/bus'

console.assert(OcTab)

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
        //GlFormCheckbox,
        OcCard,
        OcList,
        OcListResource,
        OcTemplateHeader,
        TemplateButtons,
        GlTabs, OcTab
    },

    props: {
        target: {
            type: String,
            default: () => 'Environment'
        },
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
        },
        readonly: {
            type: Boolean,
            default: false
        },
        renderInputs: {
            type: Boolean,
            default: true
        },
        customTitle: {
            type: String,
            default: () => ''
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
            selectingTopLevel: false,
            topLevelSelection: {}
        };
    },

    computed: {
        ...mapGetters([
            'availableResourceTypesForRequirement',
            'getPrimaryCard',
            'primaryCardProperties',
            'getCardProperties',
            'getCardsStacked',
            'getDeploymentTemplate',
            'getDependencies',
            'hasPreparedMutations',
            'requirementMatchIsValid',
            'resolveRequirementMatchTitle',
            'cardIsValid',
            'getUsername',
            'getHomeProjectPath',
            'getCurrentEnvironment',
            'getValidConnections',
            'getHomeProjectPath',
            'getApplicationBlueprint',
            'currentAvailableResourceTypes',
            'resolveResourceTypeFromAny',
            'getCurrentEnvironment'
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

        ocTopLevelPrimary() {
            return {
                text: __("Next"),
                attributes: [{ category: 'primary' }, { variant: 'info' }, { disabled: (!Object.keys(this.topLevelSelection).length || !this.resourceName.length || this.alertNameExists) }]
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
        targetName() {
            if(this.target == 'Environment') {
                return this.getCurrentEnvironment.name
            } else {
                return this.getDeploymentTemplate.title
            }

        },
        selectedRequirement() {
            return this.createNodeResourceData?.requirement
        },

        checkAllRequirements() {
            return this.completedRequirements && this.completedMainInputs;
        },

        primaryCardStatus() {
            if(this.displayStatus && this.getDeploymentTemplate.status == 1) {
                return 1
            }
            return null

        },

        mappedAvailableTypes() {
            const mapping = {}
            for(const type of this.currentAvailableResourceTypes) {
                const directSuperClass = type.extends[1]
                const children = mapping[directSuperClass] || []
                children.push(type)
                mapping[directSuperClass] = children
            }
            for(const key in mapping) {
                const typeTitle = this.resolveResourceTypeFromAny(key)?.title
                if(typeTitle) {
                    mapping[typeTitle] = mapping[key]
                    delete mapping[key]
                }
            }

            return mapping
        }

    },

    watch: {
        selected: function(val) {
            if(Object.keys(val).length > 0) {
                if(!this.userEditedResourceName) {
                    this.resourceName = this.resolveResourceTypeFromAny(val.name)?.title || val.name;
                }
            }
        },
        topLevelSelection: function(val) {
            if(Object.keys(val).length > 0) {
                if(!this.userEditedResourceName) {
                    this.resourceName = val.name;
                }
            }
        },


        resourceName: function(val) {
            this.alertNameExists = this.requirementMatchIsValid(slugify(val));
        }
    },
    created() {

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

        bus.$on('deleteNode', (obj) => { this.onDeleteNode(obj) });
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
        ]),

        promptAddExternalResource() {
            this.selectingTopLevel = true
        },

        unloadHandler(e) {
            if(this.hasPreparedMutations) {
                // NOTE most users will not see this message because browsers can override it
                e.returnValue = "You have unsaved changes.";
            }
        },

        scrollDown(elId, timeOut=500) {
            clearTimeout(this.uiTimeout);  
            const anchorId = btoa(elId).replace(/=/g, '');
            this.uiTimeout = setTimeout(
                () => {
                    const anchor = document.querySelector(`#${anchorId}`);
                    anchor?.scrollIntoView({behavior: "smooth", block: "center", inline: "start"});
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
                this.$emit('saveTemplate')
                createFlash({
                    message: __(`${this.target || 'Template'} was saved successfully!`),
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
            this.topLevelSelection = {}
        },

        async onSubmitDeleteTemplateModal() {
            try {
                this.clearPreparedMutations();
                this.resetStagedChanges();
                // TODO this is ugly
                if(this.target != 'Environment') {
                    this.pushPreparedMutation(deleteDeploymentTemplate({name: this.$route.params.slug}))
                    await this.commitPreparedMutations()
                }
                this.$emit('deleteResource');
                if (this.target == 'Environment') return
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
                const deleted = await this.deleteNode(this.deleteNodeData);
            } catch (e) {
                console.error(e);
                createFlash({ message: e.message, type: FLASH_TYPES.ALERT });
            }
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
            return `Are you sure you want to ${this.nodeAction.toLowerCase()} <b>${this.nodeTitle}</b>? <span style="text-transform: capitalize;">${gerundize(this.nodeAction)}</span> <b>${this.nodeTitle}</b> might affect other resources that are linked to it.`;
        },

        legendDeleteTemplate() {
            return `Are you sure you want to delete <b>${this.targetName}</b>?`;
        },

        replaceSpaceWithDash(str){
            return str.replace(/ /g, '-');
        },
        onDeleteNode(obj) {
            this.deleteNodeData = obj;
            this.nodeAction = obj.action? obj.action : __('Delete');
            this.nodeTitle = this.resolveRequirementMatchTitle(obj.name);
            this.launchModal('oc-delete-node', 500);

        }
    },
};
</script>
<template>
    <div>
        <!-- Header of templates -->
        <oc-template-header v-if="target != 'Environment'" :header-info="{ title: getDeploymentTemplate.title, cloud: getDeploymentTemplate.cloud, environment: $route.params.environment}"/>
            <!-- Content -->
        <div class="row-fluid gl-mt-6 gl-mb-6">
            <oc-card
                :display-validation="displayValidation"
                :display-status="displayStatus"
                :main-card-class="'primary-card'"
                :use-status="primaryCardStatus"
                :custom-title="customTitle"
                :readonly="readonly"
                :card="getPrimaryCard"
                :is-primary="true"
                @deleteNode="onDeleteNode"
                >
                <template v-if="this.$slots.header" #header>
                    <slot name="header"></slot>
                </template>
                <template #controls>
                    <slot name="primary-controls"></slot>
                </template>
                <template #footer-controls>
                    <slot name="primary-controls-footer"></slot>
                </template>
                <template #content>
                    <!-- Inputs -->
                    <!--oc-inputs :card="getPrimaryCard" :main-inputs="primaryCardProperties" :component-key="1" /-->

                    <!-- Requirements List -->
                    <oc-list v-if="Object.keys(getPrimaryCard).length > 0"
                        tabs-title="Dependencies"
                        :display-validation="displayValidation"
                        :render-inputs="renderInputs"
                        :display-status="displayStatus"
                        :title-key="getPrimaryCard.title"
                        :cloud="getDeploymentTemplate.cloud"
                        :deployment-template="getDeploymentTemplate"
                        :template-dependencies="getDependencies(getPrimaryCard.name)"
                        :level="1"
                        :show-type-first="true"
                        :readonly="readonly"
                        :card="getPrimaryCard"
                        />
                    <div v-if="getCardsStacked.length > 0">
                        <oc-card
                            v-for="(card, idx) in getCardsStacked"
                            :key="__('levelOne-') + card.title"
                            :display-validation="displayValidation"
                            :display-status="displayStatus"
                            :readonly="readonly"
                            :card="card"
                            :actions="true"
                            :level="idx"
                            class="gl-mt-6"
                            @deleteNode="onDeleteNode"
                            >
                            <template #controls>
                                <slot name="controls"></slot>
                            </template>
                            <template #content>
                                <!--oc-inputs :card="card" :main-inputs="getCardProperties(card.name)" :component-key="2" /-->
                                <slot name="card-content-pre"></slot>

                                <oc-list
                                    tabs-title="Dependencies"
                                    :display-validation="displayValidation"
                                    :render-inputs="renderInputs"
                                    :display-status="displayStatus"
                                    :template-dependencies="getDependencies(card.name)"
                                    :deployment-template="getDeploymentTemplate"
                                    :level="idx"
                                    :title-key="card.title"
                                    :show-type-first="true" 
                                    :readonly="readonly"
                                    :card="card"
                                    />

                            </template>
                        </oc-card>
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
            :target="target"
            @saveTemplate="triggerSave()"
            @triggerDeploy="triggerDeployment()"
            @launchModalDeleteTemplate="openModalDeleteTemplate()"
            />


        <gl-modal
            modal-id="oc-template-resource-2"
            size="lg"
            title="Add an external resource"
            :action-primary="ocTopLevelPrimary"
            :action-cancel="cancelProps"
            @primary="$emit('addTopLevelResource', {selection: topLevelSelection, title: resourceName})"
            @cancel="cleanModalResource"
            v-model="selectingTopLevel"
        >

            <gl-tabs>
                <oc-tab :title="baseType" :key="baseType" :title-testid="'external-resource-tab-' + mappedAvailableTypes[baseType][0].extends[1]" :title-count="mappedAvailableTypes[baseType].length" v-for="baseType in Object.keys(mappedAvailableTypes || {})">
                    <oc-list-resource v-model="topLevelSelection" :filtered-resource-by-type="[]" :deployment-template="getDeploymentTemplate" :valid-resource-types="mappedAvailableTypes[baseType]"/>
                </oc-tab>

            </gl-tabs>

            <gl-form-group label="Name" class="col-md-4 align_left gl-pl-0 gl-mt-4">
                <gl-form-input id="input2" @input="_ => userEditedResourceName = true" v-model="resourceName" type="text"  /><small v-if="alertNameExists" class="alert-input">{{ __("The name can't be replicated. please edit the name!") }}</small>
            </gl-form-group>


            <!--gl-form-group label="Name" class="col-md-4 align_left gl-pl-0 gl-mt-4">
                <gl-form-input id="input1" @input="_ => userEditedResourceName = true" v-model="resourceName" type="text"  /><small v-if="alertNameExists" class="alert-input">{{ __("The name can't be replicated. please edit the name!") }}</small>
            </gl-form-group-->
        </gl-modal>

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

          <oc-list-resource @input="e => selected = e" v-model="selected" :name-of-resource="getNameResourceModal" :filtered-resource-by-type="[]" :deployment-template="getDeploymentTemplate" :cloud="getDeploymentTemplate.cloud" :valid-resource-types="availableResourceTypesForRequirement(selectedRequirement)" :resourceType="selectedRequirement && selectedRequirement.type"/>

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
            <!--gl-form-checkbox v-model="checkedNode">
                <b>{{ nodeTitle }}</b>
            </gl-form-checkbox-->
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

            :title="`Delete ${target}: ${targetName}`"
            :action-primary="primaryPropsDelete"
            :action-cancel="cancelProps"
            @primary="onSubmitDeleteTemplateModal"
            >
            <p v-html="legendDeleteTemplate()"></p>
        </gl-modal>
    </div>
</template>
