<script>
import { GlModal, GlModalDirective, GlSkeletonLoader, GlFormGroup, GlFormInput, GlFormCheckbox} from '@gitlab/ui';
import { cloneDeep } from 'lodash';
import { mapGetters, mapActions } from 'vuex';
import createFlash, { FLASH_TYPES } from '~/flash';
import axios from '~/lib/utils/axios_utils';
import { redirectTo } from '~/lib/utils/url_utility';
import { __ } from '~/locale';
import OcCard from '../../components/shared/oc_card.vue';
import OcInputs from '../../components/shared/oc_inputs.vue';
import OcList from '../../components/shared/oc_list.vue';
import OcListResource from '../../components/shared/oc_list_resource.vue';
import  OcTemplateHeader from '../../components/shared/oc_template_header.vue';
import TemplateButtons from '../../components/template/template_buttons.vue';
import { bus } from '../../bus';

export default {
  name: 'TemplatesPage',
  components: {
    GlModal,
    GlSkeletonLoader,
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


  directives: {
    GlModal: GlModalDirective
  },

  data() {
    return {
      componentKey: 0,
      loadingDeployment: false,
      deployButton: false,
      requirementTemp: {},
      resourceName: '',
      alertNameExists: null,
      titleKey: '',
      dataUnsaved: false,
      completedRequirements: false,
      completedMainInputs: false,
      activeSkeleton: false,
      selected: {},
      autoSaveTime: 2000,
      nodeTitle: '',
      nodeLevel: null,
      nodeAction: '',
      durationOfAlerts: 5000,
      checkedNode: true,
      selectedServiceToConnect: '',
      refValue: {
        shortName: this.$projectGlobal.ref,
        fullName: `refs/heads/${this.$projectGlobal.ref}`,
      },
      pipelinesPath: `/${this.$projectGlobal.projectPath}/-/pipelines`,
    }
  },

  computed: {
    ...mapGetters({
      resources: 'getResources',
      projectInfo: 'getProjectInfo',
      getRequirementSelected: 'getRequirementSelected',
      getTemplate: 'getTemplate',
      servicesToConnect: 'getServicesToConnect',
      getPrimaryCard: 'getPrimaryCard',
      getCardsStacked: 'getCardsStacked',
      getResourcesOfTemplate: 'getResourcesOfTemplate'
    }),

    getMainInputs() {
      return cloneDeep(this.$store.getters.getProjectInfo.inputs);
    },

    getServicesToConnect() {
      return this.fetchServices(this.servicesToConnect);
    },

    filteredResourceByType() {
      return this.fetchServices(this.resources);
    },

    primaryPropsDelete() {
      return {
        text: this.nodeAction || __('Delete'),
        attributes: [{ category: 'primary' }, { variant: 'danger' }],
      };
    },

    getNameResourceModal() {
      return this.getRequirementSelected.requirement
              ? this.getRequirementSelected.requirement.title 
              : __('Resource');
    },

    ocTemplateResourcePrimary() {
        return {
            text: __("Next"),
            attributes: [{ category: 'primary' }, { variant: 'info' }, { disabled: (this.resourceName.length === 0 || this.alertNameExists) }]
        }
    },

    ocResourceToConnectPrimary() {
      return {
            text: __("Next"),
            attributes: [{ category: 'primary' }, { variant: 'info' }, { disabled: Object.keys(this.selectedServiceToConnect).length === 0 }]
        }
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
        this.resourceName = val.name;
      }
    },

    resourceName: function(val) {
      if(this.getResourcesOfTemplate[val] !== undefined) {
        this.alertNameExists = true;
      }else {
        this.alertNameExists = false;
      }
    }
  },

  serverPrefetch() {
    return this.fetchItems();
  },

  mounted() {
    this.fetchItems();
  },

  created() {
    this.syncGlobalVars(this.$projectGlobal);
    bus.$on('completeRequirements', (level, flag) => {
      if(level === 1) {
        this.deployButton = flag;
        this.completedRequirements = flag;
        this.checkAllRequirements();
      }
    });

    bus.$on('completeMainInputs', (flag) => {
      this.completedMainInputs = flag;
      this.checkAllRequirements();
    });
    bus.$on('triggerAutoSave', () => {

      this.dataUnsaved = true;
    });

    bus.$on('moveToElement', (obj) => {
      const { elId } = obj;
      this.scrollDown(this.replaceSpaceWithDash(elId), 500);
    });

    bus.$on('placeTempRequirement', () => {
      setTimeout(() => {
        this.$refs['oc-template-resource'].show();
      }, 100);
    });

    bus.$on('launchModalToConnect', (obj) => {
      this.launchModal('oc-connect-resource', 250);
    });

    bus.$on('deleteNode', (obj) => {
      this.nodeTitle = obj.title;
      this.nodeLevel = obj.level;
      this.titleKey = obj.titleKey;
      this.nodeAction = obj.action? obj.action : __('Delete');
      this.launchModal('oc-delete-node', 500);
    });
  },

  async beforeMount() {
        window.addEventListener("beforeunload", await this.preventLeave)
  },

  methods: {
    ...mapActions([
      'syncGlobalVars',
      'createNodeResource',
      'updateTemplate',
      'savePrimaryCard',
      'saveCards',
      'saveTemplateResources',
      'deleteNode',
      'saveResourceInState',
      'connectNodeResource',
      'deleteTemplate'
    ]),

    async preventLeave(event) {
        event.preventDefault()
        // eslint-disable-next-line no-param-reassign
        // event.returnValue = ""
        if(this.dataUnsaved) {
          // eslint-disable-next-line no-console
          console.log(__("Saving changes before leave...."))
          await this.triggerSave();
          // eslint-disable-next-line no-console
          console.log(__("Saved content"));
        }
    },

    forceRerender() {
      this.componentKey += 1;
    },

    fetchServices(array) {
        return array.filter(resource => {
          // eslint-disable-next-line no-prototype-builtins
            if(this.getRequirementSelected.requirement){
                if (this.getRequirementSelected.requirement.hasOwnProperty('title')) {
                const { type } = this.getRequirementSelected.requirement;
                if (resource.type.toLowerCase().includes(type.toLowerCase())){
                    return resource;
                }
                }
            }
        });
    },

    scrollDown(elId, timeOut=0) {
      setTimeout(
        () => {
          const anchor = document.querySelector(`#${elId}`);
          anchor.scrollIntoView({behavior: "smooth", block: "center", inline: "start"});
        },
        timeOut,
      );
    },

    

    launchModal(refId, timeToWait) {
      setTimeout(() => {
        this.$refs[refId].show();
      }, timeToWait);
    },

    async fetchItems() {
        try {
          const { overview } = await this.$store.dispatch('fetchTemplateBySlug', {
            projectPath: this.$projectGlobal.projectPath,
            templateSlug: this.$route.params.slug,
          });
          if (overview.templates.length === 0) {
            this.$router.push({ name: 'projectHome' });
          }
        } catch (e) {
          createFlash({ message: e.message, type: FLASH_TYPES.ALERT });
        }
    },

    async autoSaveTemplate() {
      await this.savePrimaryCard({primaryObject: this.getPrimaryCard});
      await this.saveResourceInState({arrayOfCards: this.getCardsStacked});
    },

    async triggerSave() {
        try {
            this.autoSaveTemplate();
            const { updateTemplateResource } = await this.saveTemplateResources();
            createFlash({
              message: updateTemplateResource.isOk
                ? __('Template was saved successfully!')
                : updateTemplateResource.errors.map((e) => e).join(', '),
              type: updateTemplateResource.isOk ? FLASH_TYPES.SUCCESS : FLASH_TYPES.ALERT,
              duration: this.durationOfAlerts,
            });
            return true;
        } catch (e) {
          createFlash({ message: e.message, type: FLASH_TYPES.ALERT });
          return false;
        }
    },

    async triggerDeployment() {
      try {
          this.deployButton = false;
          this.loadingDeployment = true;
          await this.triggerSave();
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
    },

    async onSubmitDeleteTemplateModal() {
      try {
        this.activeSkeleton = true;
        const {isOk} = await this.deleteTemplate({projectTitle: this.getTemplate.title});
        if (isOk) {
          this.activeSkeleton = false;
          this.$router.push({ name: 'projectHome' });
        }
      }catch (e) {
        this.activeSkeleton = false;
        createFlash({ message: e.message, type: FLASH_TYPES.ALERT });
      }
    },

    openModalDeleteTemplate() {
      this.launchModal('oc-delete-template', 500);
    },

    async onSubmitTemplateResourceModal() {
      try {
        const { name } = this.selected;
        const titleCard = this.resourceName || name;
        await this.autoSaveTemplate();
        const created = await this.createNodeResource({titleCard, selection: this.selected, action: "create"});
        if(created){
          this.cleanModalResource();
          this.scrollDown(this.replaceSpaceWithDash(titleCard), 500);
          this.dataUnsaved = true;
        }
      }catch (e) {
        createFlash({ message: e.message, type: FLASH_TYPES.ALERT });
      }
    },

    async onSubmitModalConnect() {
      try { 
        const { name } = this.selectedServiceToConnect;
        await this.autoSaveTemplate();
        const connected = await this.connectNodeResource({ nodeTitle: name});
        if(connected) {
          this.selectedServiceToConnect = '';
          this.dataUnsaved = true;
        }
      }catch(e) {
        createFlash({ message: e.message, type: FLASH_TYPES.ALERT });
      }
    },

    async handleDeleteNode() {
      try {
        const deleted = await this.deleteNode({ nodeTitle: this.nodeTitle, action: this.nodeAction, titleKey: this.titleKey});
        if(deleted) this.dataUnsaved = true;
      } catch (e) {
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
      }
      
      return `Are you sure you want to ${this.nodeAction.toLowerCase()} <b>${this.nodeTitle}</b> ? ${gerundize(this.nodeAction)} <b>${this.nodeTitle}</b> might affect other (nodes ?) which are linked to it.`;
    },

    legendDeleteTemplate() {
      return `Are you sure you want to delete <b>${this.getTemplate.title}</b> template ?`;
    },

    replaceSpaceWithDash(str){
      return str.replace(/ /g, '-');
    }
  },
}
</script>
<template>
  <div>
    <div v-if="Object.keys(getTemplate).length > 0 && getPrimaryCard !== undefined && !activeSkeleton" :key="componentKey">

      <!-- Header of templates -->
      <oc-template-header
        :header-info="{ title: getTemplate.title, cloud: getTemplate.cloud, environment: getTemplate.environment}"/>
      <!-- Content -->
      <div class="row-fluid gl-mt-6 gl-mb-6">
        <oc-card
          :custom-title="getPrimaryCard.title"
          :main-card-class="'primary-card'"
          :icon-title="true"
          :icon-color="checkAllRequirements() ? 'icon-green' : 'icon-red'"
          :icon-name="checkAllRequirements() ? 'check-circle-filled' : 'warning-solid'"
          >
          <template #content>
            <!-- Inputs -->
            <oc-inputs :main-inputs="getPrimaryCard.inputs" :component-key="1" />

            <!-- Requirements List -->
            <oc-list
              tabs-title="Requirements"
              title-key="primary"
              :template-requirements="getPrimaryCard.requirements"
              :level="1"
              :show-type-first="true"
              />
            <div v-if="getCardsStacked.length > 0">
              <div class="gl-pl-6 gl-pr-6">
                <oc-card
                  v-for="(card, idx) in getCardsStacked"
                  :id="replaceSpaceWithDash(card.title)"
                  :key="__('levelOne-') + card.title"
                  :custom-title="card.title"
                  :badge-header="{ isActive: true, text: card.type }"
                  :icon-title="true"
                  :icon-color="card.status ? 'icon-green' : 'icon-red'"
                  :icon-name="card.status ? 'check-circle-filled' : 'warning-solid'"
                  :actions="true"
                  :level="idx"
                  class="gl-mt-6">
                  <template #content>
                    <oc-inputs :main-inputs="card.inputs" :component-key="2" />

                    <oc-list
                      tabs-title="Requirements"
                      :template-requirements="card.requirements"
                      :level="idx"
                      :title-key="card.title"
                      :show-type-first="true" />

                  </template>
                </oc-card>
              </div>
            </div>
          </template>
        </oc-card>

      </div>
      <!-- End Content -->

      <!-- Buttons -->
      <template-buttons :loading-deployment="loadingDeployment" :deploy-button="deployButton" @saveTemplate="triggerSave()" @triggerDeploy="triggerDeployment()" @launchModalDeleteTemplate="openModalDeleteTemplate()" />


      <!-- Modal Resource Template -->
      <gl-modal
            :ref="__('oc-template-resource')"
            modal-id="oc-template-resource"
            size="lg"
            :title="`Choose a ${getNameResourceModal} template`"
            :action-primary="ocTemplateResourcePrimary"
            :action-cancel="cancelProps"
            @primary="onSubmitTemplateResourceModal"
            @cancel="cleanModalResource"
            >

            <oc-list-resource v-model="selected" :name-of-resource="getNameResourceModal" :filtered-resource-by-type="filteredResourceByType" :cloud="getTemplate.cloud" />

            <gl-form-group label="Name" class="col-md-4 align_left gl-pl-0 gl-mt-4">
              <gl-form-input id="input1" v-model="resourceName" type="text"  /><small v-if="alertNameExists" class="alert-input">{{ __("The name can't be replicated. please edit the name!") }}</small>
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
        <gl-form-checkbox v-model="checkedNode"
          ><b>{{ nodeTitle }}</b></gl-form-checkbox
        >
      </gl-modal>

      <!-- Modal Connect -->
      <gl-modal
        :ref="__('oc-connect-resource')"
        :modal-id="__('oc-connect-resource')"
        size="lg"
        :title="`Connect to  ${getNameResourceModal} resource`"
        :action-primary="ocResourceToConnectPrimary"
        :action-cancel="cancelProps"
        @primary="onSubmitModalConnect"
      >
        <!-- <p v-if="getServicesToConnect.length > 0">{{ `Select a ${getNameResourceModal} instance to connect.`}}</p>
        <p v-else class="gl-mb-4">{{ `Not resources availabe for  ${getNameResourceModal} .`}}</p> -->
        <oc-list-resource v-model="selectedServiceToConnect" :name-of-resource="getNameResourceModal" :filtered-resource-by-type="getServicesToConnect" :cloud="getTemplate.cloud" />
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
    <div v-else class="gl-mt-6">
      <gl-skeleton-loader />
    </div>
  </div>
</template>
<style scoped src="./style.css">
</style>
