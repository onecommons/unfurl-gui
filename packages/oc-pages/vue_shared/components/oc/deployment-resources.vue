<script>
import { GlModal, GlModalDirective, GlFormGroup, GlFormInput, GlFormCheckbox, GlTabs} from '@gitlab/ui';
import _ from 'lodash';
import { mapGetters, mapActions, mapMutations } from 'vuex';
import createFlash, { FLASH_TYPES } from 'oc_vue_shared/client_utils/oc-flash';
import axios from '~/lib/utils/axios_utils';
import { redirectTo } from '~/lib/utils/url_utility';
import { __ } from '~/locale';
import OcCard from '../../../project_overview/components/shared/oc_card.vue';
import OcList from '../../../project_overview/components/shared/oc_list.vue';
import OcListResource from '../../../project_overview/components/shared/oc_list_resource.vue';
import OcTemplateHeader from '../../../project_overview/components/shared/oc_template_header.vue';
import TemplateButtons from '../../../project_overview/components/template/template_buttons.vue';
import OcTab from 'oc_vue_shared/components/oc/oc-tab.vue'
import { cloudProviderFriendlyName, slugify } from '../../util.mjs'
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
        },
        filter: Function
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
            topLevelSelection: {},
            providerSelection: {}
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
            'getValidEnvironmentConnections',
            'getHomeProjectPath',
            'getApplicationBlueprint',
            'instantiableResourceTypes',
            'resolveResourceTypeFromAny',
            'getCurrentEnvironment'
        ]),

        pipelinesPath(){
            return `/${this.getHomeProjectPath}/-/pipelines`
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

        alertProviderExists() {
            if(!this.providerSelection) return false
            const env = this.getCurrentEnvironment
            if(!env) return false
            const connections = Array.isArray(env.connections)? env.connections: Object.values(env.connections)

            return connections.some(conn => conn.type == this.providerSelection.name)
        },

        ocProviderPrimary() {

            const nameIssue = !Object.keys(this.providerSelection).length || !this.resourceName.length || this.alertNameExists
            const disabled = nameIssue || this.alertProviderExists
            return {
                text: __("Next"),
                attributes: [{ category: 'primary' }, { variant: 'info' }, { disabled }]
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
                return this.getCurrentEnvironment?.name
            } else {
                return this.getDeploymentTemplate?.title
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
            for(const type of this.instantiableResourceTypes) {
                const badge = type.badge || 'Other'
                const children = mapping[badge] || []
                children.push(type)
                mapping[badge] = children
            }

            return mapping
        },

        baseTypeExtends() {
            const result = {...this.mappedAvailableTypes}
            Object.keys(result).forEach(key => {
                try {
                    result[key] = this.mappedAvailableTypes[key][0].extends[1]
                } catch(e) {
                    delete result[key]
                }
            })
            return result
        },

        baseTypes() {
            // ensure Other is last
            return _.uniq(['Other', ...Object.keys(this.mappedAvailableTypes || {})]).reverse()
        },

        availableProviderTypes() {
            if(this.selectingProvider) { // force recompute when modal opens
                return ['unfurl.relationships.ConnectsTo.K8sCluster', 'unfurl.relationships.ConnectsTo.DigitalOcean'].map(this.resolveResourceTypeFromAny)
            }
            return []
        },

        presentableCards() {
            if(typeof this.filter != 'function') {
                return this.getCardsStacked
            } else {
                return this.getCardsStacked.filter(this.filter)
            }
        },

        selectingProvider: {
            get() { return this.$route.query.hasOwnProperty('newProvider') },
            set(val) {
                const query = {...this.$route.query}
                if(val) { query.newProvider = null }
                else { delete query.newProvider }

                if(! _.isEqual(query, this.$route.query)) {
                    this.$router.push({...this.$route, query})
                }
            }
        },

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

        providerSelection: function(val) {
            if(Object.keys(val).length > 0) {
                if(!this.userEditedResourceName) {
                    this.resourceName = cloudProviderFriendlyName(val.name) || val.name;
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

    mounted() {
        if(window.location.hash) {
            try {
                this.scrollDown(window.location.hash)
            } catch(e) {}
        }
    },

    beforeDestroy() {
        window.removeEventListener('beforeunload', this.unloadHandler);
        this.setRouterHook(null);
    },

    methods: {
        ...mapMutations([
            'setRouterHook',
            'clearPreparedMutations',
            'resetStagedChanges',
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
            'runEnvironmentSaveHooks',
        ]),

        promptAddExternalResource() {
            this.selectingTopLevel = true
        },

        promptAddProvider() {
            this.selectingProvider = true
        },

        unloadHandler(e) {
            if(this.hasPreparedMutations) {
                // NOTE most users will not see this message because browsers can override it
                e.returnValue = "You have unsaved changes.";
            }
        },

        scrollDown(elId, timeOut=500) {
            clearTimeout(this.uiTimeout);
            const anchorId = btoa(elId.replace('#', '')).replace(/=/g, '');
            this.uiTimeout = setTimeout(
                () => {
                    let anchor = document.querySelector(`#${anchorId}`);
                    anchor = anchor || document.querySelector(elId.startsWith('#') ? elId  : `#${elId}`)
                    anchor?.scrollIntoView({behavior: "smooth", block: "start", inline: "start"});
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

        async triggerSave(reason) {
            try {
                if(reason != 'deploy') { await this.runEnvironmentSaveHooks() }
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
                await this.triggerSave('deploy');
                await this.createDeploymentPathPointer({projectPath: this.getHomeProjectPath, environmentName: this.$route.params.environment})
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
            this.providerSelection = {}
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
        <div class="row-fluid">
            <oc-card
                :display-validation="displayValidation"
                :display-status="displayStatus"
                :main-card-class="'primary-card'"
                :use-status="primaryCardStatus"
                :custom-title="customTitle"
                :readonly="readonly"
                :card="(typeof filter == 'function' ? filter(getPrimaryCard) && getPrimaryCard: getPrimaryCard) || null"
                :is-primary="true"
                class="gl-mb-6"
                @deleteNode="onDeleteNode"
                >
                <template v-if="this.$slots.header" #header>
                    <slot name="header"></slot>
                </template>
                <template v-if="this.$slots.status" #status>
                    <slot name="status"></slot>
                </template>
                <template #controls="card">
                    <slot name="primary-controls" v-bind="card"></slot>
                </template>
                <template #footer-controls>
                    <slot name="primary-controls-footer"></slot>
                </template>
                <template #content>
                    <!-- Inputs -->
                    <!--oc-inputs :card="getPrimaryCard" :main-inputs="primaryCardProperties" :component-key="1" /-->

                    <slot name="primary-pre"/>
                    <!-- Requirements List -->
                    <oc-list v-if="Object.keys(getPrimaryCard).length > 0 && (typeof filter == 'function' ? filter(getPrimaryCard) && getPrimaryCard: getPrimaryCard)"
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
                    <div v-if="presentableCards.length > 0">
                        <oc-card
                            v-for="(card, idx) in presentableCards"
                            :key="__('levelOne-') + card.title"
                            :display-validation="displayValidation"
                            :display-status="displayStatus"
                            :readonly="readonly"
                            :card="card"
                            :actions="true"
                            :level="idx"
                            class="gl-mb-6"
                            @deleteNode="onDeleteNode"
                            >
                            <template #controls="card">
                                <slot name="controls" v-bind="card"></slot>
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
            modal-id="toplevel-selection"
            size="lg"
            title="Add an external resource"
            :action-primary="ocTopLevelPrimary"
            :action-cancel="cancelProps"
            @primary="$emit('addTopLevelResource', {selection: topLevelSelection, title: resourceName})"
            @cancel="cleanModalResource"
            v-model="selectingTopLevel"
        >
            <div style="min-height: 500px">
                <gl-tabs>
                    <oc-tab
                        v-for="baseType in baseTypes"
                        :title="baseType"
                        :key="baseType"
                        :title-testid="'external-resource-tab-' + baseTypeExtends[baseType]"
                        :title-count="mappedAvailableTypes[baseType] && mappedAvailableTypes[baseType].length"
                    >
                        <oc-list-resource v-model="topLevelSelection" :filtered-resource-by-type="[]" :deployment-template="getDeploymentTemplate" :valid-resource-types="mappedAvailableTypes[baseType]"/>
                    </oc-tab>

                </gl-tabs>

                <gl-form-group label="Name" class="col-md-4 align_left gl-pl-0 gl-mt-4">
                    <gl-form-input id="input2" @input="_ => userEditedResourceName = true" v-model="resourceName" type="text"  />
                    <small v-if="alertNameExists" class="alert-input">{{ __("The name can't be replicated. please edit the name!") }}</small>
                </gl-form-group>
            </div>

        </gl-modal>

        <gl-modal
            modal-id="provider-selection"
            size="lg"
            title="Add a provider connection"
            :action-primary="ocProviderPrimary"
            :action-cancel="cancelProps"
            @primary="$emit('addProvider', {selection: providerSelection, title: resourceName})"
            @cancel="cleanModalResource"
            v-model="selectingProvider"
        >
            <oc-list-resource v-model="providerSelection" :filtered-resource-by-type="[]" :deployment-template="getDeploymentTemplate" :valid-resource-types="availableProviderTypes"/>

            <gl-form-group label="Name" class="col-md-4 align_left gl-pl-0 gl-mt-4">
                <gl-form-input id="input2" @input="_ => userEditedResourceName = true" v-model="resourceName" type="text"  />
                <small v-if="alertProviderExists" class="alert-input">{{ __("Your environment already has this type of provider.") }}</small>
                <small v-else-if="alertNameExists" class="alert-input">{{ __("The name can't be replicated. please edit the name!") }}</small>
            </gl-form-group>

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
            :modal-id="`delete-modal-${_uid}`"
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
            <oc-list-resource v-model="selectedServiceToConnect" :name-of-resource="getNameResourceModal" :filtered-resource-by-type="[]" :cloud="getDeploymentTemplate.cloud" :valid-resource-types="getValidEnvironmentConnections($route.params.environment, selectedRequirement)"/>
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
