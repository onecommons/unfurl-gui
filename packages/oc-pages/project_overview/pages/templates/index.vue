<script>
import { GlModal, GlModalDirective, GlSkeletonLoader, GlFormGroup, GlFormInput } from '@gitlab/ui';
import { cloneDeep } from 'lodash';
import { mapState, mapGetters, mapActions, mapMutations } from 'vuex';
import createFlash, { FLASH_TYPES } from 'oc_vue_shared/client_utils/oc-flash';
import axios from '~/lib/utils/axios_utils';
import { redirectTo } from '~/lib/utils/url_utility';
import _ from 'lodash'
import { __ } from '~/locale';
import OcCard from '../../components/shared/oc_card.vue';
import OcList from '../../components/shared/oc_list.vue';
import OcInputs from '../../components/shared/oc_inputs.vue'
import OcListResource from '../../components/shared/oc_list_resource.vue';
import OcTemplateHeader from '../../components/shared/oc_template_header.vue';
import TemplateButtons from '../../components/template/template_buttons.vue';
import {DeploymentScheduler} from 'oc_vue_shared/oc-components'
import { bus } from 'oc_vue_shared/bus';
import { slugify, USER_HOME_PROJECT } from 'oc_vue_shared/util.mjs'
import { deleteDeploymentTemplate } from '../../store/modules/deployment_template_updates'
import {getJobsData, redirectToJobConsole} from 'oc_vue_shared/client_utils/pipelines'
import ConsoleWrapper from 'oc_vue_shared/components/console-wrapper.vue'


export default {
  name: 'TemplatesPage',
  components: {
    GlModal,
    GlSkeletonLoader,
    GlFormGroup,
    GlFormInput,
    OcCard,
    OcList,
    OcInputs,
    OcListResource,
    OcTemplateHeader,
    TemplateButtons,
    ConsoleWrapper,
    DeploymentScheduler
  },


  directives: {
    GlModal: GlModalDirective
  },

  data() {
    return {
      uiTimeout: null,
      triedFetching: false,
      createNodeResourceData: {},
      deleteNodeData: {},
      componentKey: 0,
      triggeredDeployment: false,
      requirementTemp: {},
      resourceName: '',
      userEditedResourceName: false,
      alertNameExists: null,
      titleKey: '',
      dataUnsaved: false,
      completedRequirements: false,
      completedMainInputs: false,
      activeSkeleton: true,
      failedToLoad: false,
      selected: {},
      autoSaveTime: 2000,
      nodeTitle: '',
      nodeChildren: [],
      nodeLevel: null,
      nodeAction: '',
      durationOfAlerts: 5000,
      checkedNode: true,
      selectedServiceToConnect: '',
      jobsData: null,
      refValue: {
        shortName: 'main',
        fullName: 'refs/heads/main',
      },
    };
  },

  computed: {
    ...mapState(['project']),
    ...mapGetters([
      'pipelinesPath',
      'resolveResourceTypeFromAny',
      'getProjectInfo',
      'getRequirementSelected',
      'getTemplate',
      'getPrimaryCard',
      'getCardsStacked',
      'getDeploymentTemplate',
      'getDependencies',
      'hasPreparedMutations',
      'safeToNavigateAway',
      'requirementMatchIsValid',
      'resolveRequirementMatchTitle',
      'resolveRequirementMatchChildren',
      'cardIsValid',
      'getUsername',
      'getHomeProjectPath',
      'getCurrentNamespace',
      'getCurrentEnvironment',
      'availableResourceTypesForRequirement',
      'getValidConnections',
      'getProjectInfo',
      'lookupConfigurableTypes',
      'lookupEnvironment',
      'getParentDependency',
      'getPrimary',
      'environmentsAreReady',
    ]),
    
    deploymentDir() {
        const environment = this.$route.params.environment
        // this.getDeploymentTemplate.name not loaded yet

        // params.slug is the blueprint unfortunately
        const deploymentSlug = this.$route.params.slug //slugify(this.$route.query.fn)
        return `environments/${environment}/${this.getProjectInfo.fullPath}/${deploymentSlug}`
    },
    saveStatus() {
      switch(this.$route.name) {
        case 'deploymentDraftPage':
          return 'hidden';
        default: 
          return this.hasPreparedMutations? 'enabled': 'disabled';
      }
    },
    saveDraftStatus() {
      return this.$route.name == 'deploymentDraftPage'?
        (this.hasPreparedMutations? 'enabled': 'disabled') : 'hidden'
    },
    deleteStatus() {
      switch(this.$route.name) {
        case 'deploymentDraftPage':
          return 'hidden';
        default: 
          return 'enabled';
      }
    },
    mergeStatus() {
      switch(this.$route.name) {
        case 'deploymentDraftPage':
          return 'hidden';
        default: 
          return 'enabled';
      }
    },
    deployStatus() {
      if(this.triggeredDeployment) return 'disabled'
      if(this.$route.name != 'deploymentDraftPage') return 'hidden'
      return this.cardIsValid(this.getPrimaryCard)? 'enabled': 'disabled';
    },
    cancelStatus() {
      return this.$route.name == 'deploymentDraftPage'? 'enabled': 'hidden';
    },

    shouldRenderTemplates() {
        return !this.activeSkeleton && !this.failedToLoad;
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
      return this.getRequirementSelected.requirement
              ? this.getRequirementSelected.requirement.name 
              : __('Resource');
    },
    getRequirementResourceType() {
      const resourceTypeName = this.getRequirementSelected?.requirement?.constraint?.resourceType
      const resourceType =  this.resolveResourceTypeFromAny(resourceTypeName)
      return resourceType?.title || resourceTypeName
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
          let dependentName = this.createNodeResourceData.dependentName
          let dependent = this.getParentDependency(dependentName)

          // check if dependent visible 
          let primaryDependencies = this.getPrimary.dependencies
          let resourceParentName = ''
          for (const pd of primaryDependencies) {
            if (
              dependent &&
              dependent.dependentRequirement === pd.name &&
              pd.constraint.visibility === 'visible'
            ) {
              resourceParentName = dependent.title
            }
          }
          
          this.resourceName = resourceParentName ?
            this.getRequirementSelected.requirement.constraint.title + ' for ' + resourceParentName :
            this.resolveResourceTypeFromAny(val.name)?.title || val.name
        }
      }
    },

    resourceName: function(val) {
      this.alertNameExists = this.requirementMatchIsValid(slugify(val));
    },

    environmentsAreReady(newState, _oldState) {
      if (newState) {
        this.fetchItems()
      }
    }
  },

  serverPrefetch() {
    return this.fetchItems();
  },

  beforeCreate() {
    const banner = document.querySelector('.js-uf-welcome-banner')
    if(banner) {banner.style.display = 'none'}
  },

  created() {
    if(this.environmentsAreReady && !this.triedFetching) {
      this.fetchItems()
    }
    this.syncGlobalVars(this.$projectGlobal);
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
        
      this.nodeTitle = this.resolveRequirementMatchTitle(obj.name);
      this.nodeChildren = this.resolveRequirementMatchChildren(obj.name)
      this.launchModal('oc-delete-node', 500);
    });
  },

  beforeMount() {
    // NOTE this doesn't work without https
    window.addEventListener('beforeunload', this.unloadHandler);
    this.setRouterHook((to, from, next) => {
      if(!this.safeToNavigateAway) {
        const result = confirm(__('You have unsaved changes.  Press OK to continue'));
        if(!result) { next(false); return; } // never call next twice
      }
      const banner = document.querySelector('.js-uf-welcome-banner')
      if(banner) {banner.style.display = ''}
      this.clearPreparedMutations();
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
      'setAvailableResourceTypes',
      'resetTemplateResourceState',
      'setRouterHook',
      'clearPreparedMutations',
      'resetStagedChanges',
      'onApplicationBlueprintLoaded',
      'setUpdateObjectPath',
      'setUpdateObjectProjectPath',
      'setEnvironmentScope',
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
      'fetchProject',
      'deployInto',
      'createDeploymentPathPointer'
    ]),

    unloadHandler(e) {
      if(this.hasPreparedMutations) {
        // NOTE most users will not see this message because browsers can override it
        e.returnValue = "You have unsaved changes.";
      }
    },

    forceRerender() {
      this.componentKey += 1;
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

    async fetchItems(n=1) {
      try {
        this.triedFetching = true
        const projectGlobal = this.project.globalVars
        const projectPath = projectGlobal?.projectPath
        const templateSlug =  this.$route.query.ts || this.$route.params.slug;
        const renamePrimary = this.$route.query.rtn;
        const renameDeploymentTemplate = this.$route.query.fn;
        const environmentName = this.$route.params.environment
        if(this.$route.name != 'templatePage') {
          this.setUpdateObjectPath(`${this.deploymentDir}/deployment.json`);
          this.setUpdateObjectProjectPath(`${this.getUsername}/${USER_HOME_PROJECT}`);
          this.setEnvironmentScope(environmentName)
        }
        // TODO see if we can get rid of this, since it's probably already loaded
        await this.fetchProject({projectPath, fetchPolicy: 'network-only', n, projectGlobal});
        const populateTemplateResult = await this.populateTemplateResources({
          projectPath, 
          templateSlug, 
          renamePrimary, 
          renameDeploymentTemplate,
          environmentName: this.$route.params.environment,
          syncState: this.$route.name == 'deploymentDraftPage'
        })
        const environment = this.lookupEnvironment(environmentName)
        this.setAvailableResourceTypes(this.lookupConfigurableTypes(environment))


      } catch (e) {
        console.error(e);
        createFlash({ message: e.message, type: FLASH_TYPES.ALERT});
        this.failedToLoad = true;
      } finally {
        this.activeSkeleton = false;
      }
    },
    debouncedTriggerSave: _.debounce(function(...args) {this.triggerSave(...args)}, 250),
    async triggerSave(type) {
      try {
        await this.commitPreparedMutations();
        if(type == 'draft'){
          await this.createDeploymentPathPointer({deploymentDir: this.deploymentDir, projectPath: this.getHomeProjectPath, environmentName: this.$route.params.environment})
          sessionStorage['oc_flash'] = JSON.stringify({
            message: __('Draft saved!'),
            type: FLASH_TYPES.SUCCESS,
            duration: this.durationOfAlerts,
            linkText: 'Return to overview',
            linkTo: `/${this.project.globalVars.projectPath}#${this.$route.params.slug}` // TODO 
          });
          const query = {...this.$route.query}
          delete query.ts
          window.location.href = this.$router.resolve({...this.$route, query}).href
          //window.location.href = `/${this.project.globalVars.projectPath}#${slugify(this.$route.query.fn)}`
        } else {
          createFlash({
            // TODO this doesn't make sense if it's a template
            message: __('Starting deployment...'),
            type: FLASH_TYPES.SUCCESS,
            duration: this.durationOfAlerts,
          });
          return true;
        }
      } catch (e) {
        console.error(e);
        createFlash({ message: e.message, type: FLASH_TYPES.ALERT });
        return false;
      }
    },

    triggerDeployment: _.debounce(async function() {
      try {
        this.triggeredDeployment = true;
        await this.triggerSave();
        const result = await this.deployInto({
          environmentName: this.$route.params.environment,
          projectUrl: `${window.gon.gitlab_url}/${this.getProjectInfo.fullPath}.git`,
          deployPath: this.deploymentDir,
          deploymentName: this.$route.params.slug,
          deploymentBlueprint: this.$route.query.ts
        })
        if(result === false) return

        const {pipelineData, error} = result

        if(error) {
          throw new Error(error)
        }

        if(pipelineData) createFlash({ message: __('The pipeline was triggered successfully'), type: FLASH_TYPES.SUCCESS, duration: this.durationOfAlerts });

        const router = this.$router
        function beforeRedirect() {
          const {href} = router.resolve({name: 'projectHome', query: {}})
          window.history.replaceState({}, null, href)
        }

        beforeRedirect() // this is weird, the logic around here has just changed a lot recently
        window.location.href = `/home/${this.getCurrentNamespace}/-/deployments/${this.$route.params.environment}/${this.$route.params.slug}?show=console`
      } catch (err) {
        console.error(err)
        const errors = err?.response?.data?.errors || [];
        const [error] = errors;
        return createFlash({ message: `Pipeline ${error || err}`, type: FLASH_TYPES.ALERT, duration: this.durationOfAlerts, projectPath: this.getHomeProjectPath, issue: 'Failed to trigger deployment pipeline'});
      }
    }, 250),

    cleanModalResource() {
      this.resourceName = '';
      this.selected = {};
      this.userEditedResourceName = false;
    },

    async onSubmitDeleteTemplateModal() {
      try {
        this.activeSkeleton = true;
        this.clearPreparedMutations();
        this.resetStagedChanges();
        this.pushPreparedMutation(deleteDeploymentTemplate({name: this.$route.params.slug}))

        await this.commitPreparedMutations()
        this.activeSkeleton = false;
        this.$router.push({ name: 'projectHome' }); // NOTE can we do this on failure too?
      }catch (e) {
        this.activeSkeleton = false;
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
        if(this.selectedServiceToConnect?.__typename == 'Resource') {
            await this.connectNodeResource({ resource: this.selectedServiceToConnect, ...this.connectNodeResourceData });
        } else {
            const { name } = this.selectedServiceToConnect;
            await this.connectNodeResource({ externalResource: name, ...this.connectNodeResourceData });
        }
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
        return `Are you sure you want to ${this.nodeAction.toLowerCase()} <b>${this.nodeTitle}</b>? 
        ${this.nodeChildren.length > 0 ? `<span style="text-transform: capitalize;">${gerundize(this.nodeAction)}</span> <b>${this.nodeTitle}</b> might affect other resources that are linked to it.` : ''}`;
    },

    legendDeleteTemplate() {
      return `Are you sure you want to delete <b>${this.getDeploymentTemplate.title}</b> template ?`;
    },

  },
};
</script>
<template>
  <div>
    <div v-if="shouldRenderTemplates" :key="componentKey">

      <!-- Header of templates -->
      <oc-template-header
        :header-info="{ title: getDeploymentTemplate.title, cloud: getDeploymentTemplate.cloud, environment: $route.params.environment}"/>

      <console-wrapper v-if="jobsData" :jobs-data="jobsData" />

      <!-- Content -->
      <div class="row-fluid gl-mt-6 gl-mb-6">
        <div>

        </div>
        <oc-card
          :custom-title="getDeploymentTemplate.title"
          :main-card-class="'primary-card'"
          :card="getPrimaryCard"
          :icon-title="true"
          :icon-color="checkAllRequirements() ? 'icon-green' : 'icon-red'"
          :icon-name="checkAllRequirements() ? 'check-circle-filled' : 'warning-solid'"
          is-primary
          >
          <template #content>
            <!-- Inputs -->
            <div class="m-2">
              <oc-inputs :data-testid="`oc-inputs-${getPrimaryCard.name}`" :card="getPrimaryCard" :main-inputs="getPrimaryCard.properties" :component-key="1"  />
            </div>

            <!-- Requirements List -->
            <oc-list
              tabs-title="Components"
              :title-key="getPrimaryCard.title"
              :cloud="getDeploymentTemplate.cloud"
              :deployment-template="getDeploymentTemplate"
              :template-dependencies="getDependencies(getPrimaryCard.name)"
              :level="1"
              :show-type-first="true"
              :render-inputs="false"
              :render-input-tabs="true"
              :card="getPrimaryCard"
              />
            <div v-if="getCardsStacked.length > 0">
              <div>
                <oc-card
                  v-for="(card, idx) in getCardsStacked"
                  :key="__('levelOne-') + card.title"
                  :custom-title="card.title"
                  :card="card"
                  :icon-title="true"
                  :icon-color="card.valid ? 'icon-green' : 'icon-red'"
                  :icon-name="card.valid ? 'check-circle-filled' : 'warning-solid'"
                  :actions="true"
                  :level="idx"
                  class="gl-mt-6">
                  <template #content>
                    <!--oc-inputs :card="card" :main-inputs="card.properties" :component-key="2" /-->

                    <oc-list
                      tabs-title="Components"
                      :template-dependencies="getDependencies(card.name)"
                      :deployment-template="getDeploymentTemplate"
                      :level="idx"
                      :title-key="card.title"
                      :show-type-first="true" 
                      :render-inputs="true"
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
      <deployment-scheduler />

      <!-- Buttons -->
      <template-buttons 
            :loading-deployment="triggeredDeployment"
            :save-status="saveStatus"
            :save-draft-status="saveDraftStatus"
            :delete-status="deleteStatus"
            :merge-status="mergeStatus"
            :cancel-status="cancelStatus"
            :deploy-status="deployStatus"
            @saveDraft="debouncedTriggerSave('draft')"
            @saveTemplate="debouncedTriggerSave()"
            @triggerDeploy="triggerDeployment()"
            @launchModalDeleteTemplate="openModalDeleteTemplate()"
            />


      <!-- Modal Resource Template -->
      <gl-modal
            :ref="__('oc-template-resource')"
            modal-id="oc-template-resource"
            size="lg"
            :title="`Choose a ${getRequirementResourceType} template for ${getRequirementSelected.requirement && (getRequirementSelected.requirement.constraint.title)}`"
            :action-primary="ocTemplateResourcePrimary"
            :action-cancel="cancelProps"
            @primary="onSubmitTemplateResourceModal"
            @cancel="cleanModalResource"
            >

          <oc-list-resource @input="e => selected = e" v-model="selected" :name-of-resource="getNameResourceModal" :filtered-resource-by-type="[]" :deployment-template="getDeploymentTemplate" :cloud="getDeploymentTemplate.cloud" :valid-resource-types="availableResourceTypesForRequirement(getRequirementSelected.requirement)" :resourceType="getRequirementResourceType"/>

            <gl-form-group label="Name" class="col-md-4 align_left gl-pl-0 gl-mt-4">
              <gl-form-input id="input1" data-testid="create-resource-template-title" @input="_ => userEditedResourceName = true" v-model="resourceName" type="text"  /><small v-if="alertNameExists" class="alert-input">{{ __("The name can't be replicated. please edit the name!") }}</small>
            </gl-form-group>
      </gl-modal>

      <!-- Modal to delete -->
      <gl-modal
        :ref="__('oc-delete-node')"
        :modal-id="__('oc-delete-node')"
        size="md"
        :title="`${nodeAction} ${nodeTitle}`"
        :action-primary="primaryPropsDelete"
        :action-cancel="cancelProps"
        @primary="handleDeleteNode"
      >
        <p v-html="getLegendOfModal()"></p>
        <ul>
          <li v-for="(child, idx) in this.nodeChildren" :key="idx">
            {{ child }}
          </li>
        </ul>
      </gl-modal> 

      <!-- Modal Connect -->
      <gl-modal
        :ref="__('oc-connect-resource')"
        :modal-id="__('oc-connect-resource')"
        size="lg"
        :title="`Connect to  ${getNameResourceModal} resource`" :action-primary="ocResourceToConnectPrimary"
        :action-cancel="cancelProps"
        @primary="onSubmitModalConnect"
      >
        <oc-list-resource v-model="selectedServiceToConnect" :name-of-resource="getNameResourceModal" :filtered-resource-by-type="[]" :cloud="getDeploymentTemplate.cloud" :valid-resource-types="getValidConnections($route.params.environment, getRequirementSelected.requirement)"/>
      </gl-modal>

      <!-- Modal to confirm the action to delete template -->
      <!-- Modal to delete -->
      <gl-modal
        :ref="__('oc-delete-template')"
        :modal-id="__('oc-delete-template')"
        size="md"
        :title="`Delete Template ${getTemplate.title}`"
        :action-primary="primaryPropsDelete"
        :action-cancel="cancelProps"
        @primary="onSubmitDeleteTemplateModal"
      >
        <p v-html="legendDeleteTemplate()"></p>
      </gl-modal>

    </div>
    <div v-else-if="activeSkeleton" class="gl-mt-6">
      <gl-skeleton-loader />
    </div>
  </div>
</template>
<style scoped src="./style.css">
</style>

