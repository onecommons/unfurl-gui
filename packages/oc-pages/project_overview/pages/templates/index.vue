<script>
import { GlModal, GlModalDirective, GlSkeletonLoader, GlFormGroup, GlFormInput } from '@gitlab/ui';
import { mapState, mapGetters, mapActions, mapMutations } from 'vuex';
import { FLASH_TYPES } from 'oc_vue_shared/client_utils/oc-flash';
import _ from 'lodash'
import { __ } from '~/locale';
import OcCard from '../../components/shared/oc_card.vue';
import OcList from '../../components/shared/oc_list.vue';
import OcInputs from '../../components/shared/oc_inputs.vue'
import OcListResource from '../../components/shared/oc_list_resource.vue';
import OcTemplateHeader from '../../components/shared/oc_template_header.vue';
import TemplateButtons from '../../components/template/template_buttons.vue';
import { bus } from 'oc_vue_shared/bus';
import { slugify } from 'oc_vue_shared/util'
import { deleteDeploymentTemplate } from '../../store/modules/deployment_template_updates'
import {fetchUserHasWritePermissions, setMergeRequestReadyStatus, createMergeRequest, listMergeRequests} from 'oc_vue_shared/client_utils/projects'
import * as routes from '../../router/constants'


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
  },


  directives: {
    GlModal: GlModalDirective
  },

  data() {
    return {
      selfBranch: null,
      uiTimeout: null,
      createNodeResourceData: {},
      connectNodeResourceData: {},
      deleteNodeData: {},
      componentKey: 0,
      startedTriggeringDeployment: false,
      dataWritten: false,
      requirementTemp: {},
      resourceName: '',
      userEditedResourceName: false,
      alertNameExists: null,
      titleKey: '',
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
      mergeRequest: null
    };
  },

  computed: {
    ...mapState(['project']),
    ...mapGetters([
      'pipelinesPath',
      'resolveResourceTypeFromAny',
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
      'dependenciesRemovableWith',
      'cardIsValid',
      'getUsername',
      'getHomeProjectPath',
      'getCurrentNamespace',
      'getCurrentEnvironment',
      'availableResourceTypesForRequirement',
      'getValidConnections',
      'lookupConfigurableTypes',
      'lookupEnvironment',
      'getParentDependency',
      'getPrimary',
      'environmentsAreReady',
      'editingDeployed',
      'deployTooltip',
      'hasCriticalErrors',
      'userCanEdit',
      'getApplicationBlueprint',
      'isAcknowledged',
      'getGlobalVars',
      'providerTypesForEnvironment',
      'blueprintRepositories',
      'environmentTypeRepositories',
      'infallibleGetCardTitle',
      'getDeploymentDictionaries',
    ]),

    deploymentDir() {
        const environment = this.$route.params.environment
        // this.getDeploymentTemplate.name not loaded yet

        // params.slug is the blueprint unfortunately
        const deploymentSlug = this.$route.params.slug //slugify(this.$route.query.fn)
        return `environments/${environment}/${this.project.globalVars.projectPath}/${deploymentSlug}`
    },
    saveStatus() {
      switch(this.$route.name) {
        case routes.OC_PROJECT_VIEW_DRAFT_DEPLOYMENT:
          if(!this.mergeRequest) break
        default:
          return this.hasPreparedMutations? 'enabled': 'disabled';
      }
      return 'hidden'
    },
    saveDraftStatus() {
      return this.$route.name == routes.OC_PROJECT_VIEW_DRAFT_DEPLOYMENT?
        (
         (this.mergeRequest)? 'hidden':
           (this.hasPreparedMutations? 'enabled': 'disabled')
        ) : 'hidden'
    },
    // TODO support me
    deleteStatus() {
      switch(this.$route.name) {
        case routes.OC_PROJECT_VIEW_DRAFT_DEPLOYMENT:
          return 'hidden';
        default:
          return 'hidden'
      }
    },
    // TODO support me
    // not sure what this is supposed to do?
    mergeStatus() {
      switch(this.$route.name) {
        case routes.OC_PROJECT_VIEW_DRAFT_DEPLOYMENT:
          return 'hidden';
        default:
          return 'hidden';
      }
    },
    deployStatus() {
      if(this.startedTriggeringDeployment) return 'disabled'
      if(this.$route.name != routes.OC_PROJECT_VIEW_DRAFT_DEPLOYMENT) return 'hidden'
      return this.cardIsValid(this.getPrimaryCard)? 'enabled': 'disabled';
    },
    cancelStatus() {
      if(this.$route.name != routes.OC_PROJECT_VIEW_DRAFT_DEPLOYMENT) {
        return 'hidden'
      }

      if(this.startedTriggeringDeployment) {
        return 'disabled'
      }

      return 'enabled'
    },

    shouldRenderTemplates() {
        return !this.activeSkeleton && !this.failedToLoad;
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

    saveTooltip() {
      if(this.saveDraftStatus == 'enabled' && this.branch && this.branch != 'main') {
        return 'Save a draft of the edits on this deployment blueprint and open a merge request.'
      }
      return null
    },

    branch: {
      get() {
        return this.selfBranch || this.$route.query.branch || 'main'
      },

      set(branch) {
        this.selfBranch = branch
      }
    },

    validConnections() {
      const cardName = this.connectNodeResourceData?.dependentName
      const requirement = this.connectNodeResourceData?.requirement
      return this.getValidConnections( cardName, requirement ) || []
    },

    validResourceTypesForSelectedRequirement() {
      return this.availableResourceTypesForRequirement(this.getRequirementSelected.requirement)
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

    environmentsAreReady: {
      immediate: true,
      handler(val) {
        if(val) {
          this.fetchItems()
        }
      }
    },


    resourceName: function(val) {
      this.alertNameExists = this.requirementMatchIsValid(slugify(val));
    },

    validResourceTypesForSelectedRequirement: _.debounce(function(val) {
      if(!val.length && this.createNodeResourceData.requirement) {
        const environmentName = this.$route.params.environment
        this.createError({
          message: `No types found for '${this.createNodeResourceData.requirement.constraint?.title || this.createNodeResourceData.requirement.name}' for the cloud providers in this environment`,
          context: {
            blueprintRepositories: this.blueprintRepositories,
            environmentRepositories: environmentName && this.environmentTypeRepositories(environmentName),
            needed: this.createNodeResourceData.requirement.constraint.resourceType
          },
          severity: 'major'
        })
        const ref = this.$refs['oc-template-resource']
        ref.hide()
      }
    }, 100)
  },

  serverPrefetch() {
    return this.fetchItems();
  },

  beforeCreate() {
    const banner = document.querySelector('.js-uf-welcome-banner')
    if(banner) {banner.style.display = 'none'}
  },

  created() {
    bus.$on('moveToElement', (obj) => {
      const { elId } = obj;
      this.scrollDown(elId, 500);
    });

    bus.$on('placeTempRequirement', async (obj) => {
      const environmentName = this.$route.params.environment
      const environment = this.lookupEnvironment(environmentName)

      const requiredType = obj.requirement.constraint.resourceType
      const implementation_requirements = environment && this.providerTypesForEnvironment(environmentName)
      const params = {'extends': requiredType, implementation_requirements}

      await this.fetchTypesForParams({params})

      const ref = this.$refs['oc-template-resource'];
      this.createNodeResourceData = obj;
      ref.show();
    });

    bus.$on('launchModalToConnect', (obj) => {
      this.connectNodeResourceData = obj;
      this.launchModal('oc-connect-resource', 250);
    });

    bus.$on('deleteNode', (obj) => {
      this.deleteNodeData = obj;
      this.nodeAction = obj.action? obj.action : __('Delete');

      this.nodeTitle = this.resolveRequirementMatchTitle(obj.name);
      this.nodeChildren = this.dependenciesRemovableWith(obj.name)
      this.launchModal('oc-delete-node', 500);
    });
  },

  beforeMount() {
    // NOTE this doesn't work without https
    window.addEventListener('beforeunload', this.unloadHandler);
    this.setRouterHook((to, from, next) => {
      if(!this.safeToNavigateAway || (this.startedTriggeringDeployment && !this.dataWritten)) {
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
      'pushPreparedMutation',
      'setCommitMessage',
      'setUpdateType',
      'createError',
      'setCommitBranch'
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
      'createDeploymentPathPointer',
      'createFlash',
      'acknowledge',
      'fetchTypesForParams',
      'useProjectState'
    ]),

    unloadHandler(e) {
      if(!(this.safeToNavigateAway && !(this.startedTriggeringDeployment && !this.dataWritten))){
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

    async fetchItems() {
      try {
        // NOTE not sure if we should keep using this this.project.globalVars or this.$projectGlobal
        // we are currently populating the image in this.project.globalVars in a mutation

        const projectPath = this.project.globalVars.projectPath

        // call API instread of relying on environment when we're editing a blueprint
        const userCanEdit = this.$route.name == routes.OC_PROJECT_VIEW_CREATE_TEMPLATE?
          await fetchUserHasWritePermissions(projectPath):
          this.userCanEdit

        if(this.branch == 'main') {
          if(!userCanEdit) {
            // computed setter
            const branch = this.branch = `${this.getUsername}/${this.$route.params.slug}`
            this.setCommitBranch(this.branch)

            const target = 'main'
            const labels = [ this.$route.params.slug, 'unfurl-gui-mr' ]

            const [openedMR] = await listMergeRequests(encodeURIComponent(this.getHomeProjectPath), {branch, target, labels, state: 'opened'})

            if(openedMR) {
              this.mergeRequest = openedMR
            } else {
              const key = `branch ${branch}`
              if(!this.isAcknowledged(key)) {
                this.createFlash(`You are working on a new branch "${branch}". After your changes are saved, a merge request will be created automatically so they can be merged back into main and deployed by a maintainer.`)
              }
              this.acknowledge(key)

            }
          }
        } else {
          const key = `branch ${this.branch}`
          if(!this.isAcknowledged(key)) {
            this.createFlash(`You are working on an alternate branch "${this.branch}".`)
          }
          this.acknowledge(key)
        }

        if(!projectPath) throw new Error('projectGlobal.projectPath is not defined')
        const templateSlug =  this.$route.query.ts || this.$route.params.slug;
        const renamePrimary = this.$route.query.rtn;
        const renameDeploymentTemplate = this.$route.query.fn;
        const environmentName = this.$route.params.environment
        if(this.$route.name != routes.OC_PROJECT_VIEW_CREATE_TEMPLATE) {
          this.setUpdateObjectPath(this.deploymentDir);
          this.setUpdateObjectProjectPath(this.getHomeProjectPath);
          this.setEnvironmentScope(environmentName)
        }

        let syncState = this.$route.name == routes.OC_PROJECT_VIEW_DRAFT_DEPLOYMENT
        let deployRoot

        for(const dict of this.getDeploymentDictionaries) {
          if(dict._environment != environmentName) continue

          let dt
          try {dt = Object.values(dict.DeploymentTemplate)[0]} catch(e) {}
          if(dt?.slug != templateSlug && dt?.name != templateSlug) continue

          deployRoot = _.cloneDeep(dict)

          // add deployment to the dictionary immediately so it can be used to look up repository information
          await this.useProjectState({root: {Deployment: deployRoot.Deployment}, shouldMerge: false, projectPath})
          syncState = false // override sync state if we just loaded this
          break
        }

        if(this.hasCriticalErrors) return

        await this.fetchProject({projectPath, projectGlobal: this.project.globalVars, shouldMerge: true}); // NOTE this.project.globalVars
        if(this.hasCriticalErrors) return

        if(deployRoot) {
          await this.useProjectState({root: deployRoot, shouldMerge: true, projectPath})
        }

        const populateTemplateResult = await this.populateTemplateResources({
          projectPath,
          templateSlug,
          renamePrimary,
          renameDeploymentTemplate,
          environmentName: this.$route.params.environment,
          syncState
        })

        this.fetchTypesForParams()

      } catch (e) {
        console.error(e);
        this.createFlash({ message: e.message, type: FLASH_TYPES.ALERT});
        this.failedToLoad = true;
      } finally {
        this.activeSkeleton = false;
      }
    },
    debouncedTriggerSave: _.debounce(function(...args) {this.triggerSave(...args)}, 250),
    async triggerSave(type, redirect=true) {
      try {
        if(!this.$route.params.environment) {
          // we're editing a blueprint directly - TODO find a better way to determine this
          const name = this.$route.params.slug
          this.setCommitMessage(`Save changes to ${name}`)
          this.setUpdateType('blueprint')
          this.setUpdateObjectPath('ensemble-template.yaml')
          this.setUpdateObjectProjectPath(this.getGlobalVars.projectPath)

          await this.commitPreparedMutations();
          if(!this.hasCriticalErrors) {
            window.location.reload()
          }
        }
        else if(type == 'draft' || this.mergeRequest) {
          const name = this.$route.query.fn;
          this.setCommitMessage(`Save draft of ${name}`)
          this.setUpdateType('deployment')
          await this.commitPreparedMutations();

          if(this.hasCriticalErrors) return

          // will be handled by unfurl server
          // await this.createDeploymentPathPointer({deploymentDir: this.deploymentDir, projectPath: this.getHomeProjectPath, environmentName: this.$route.params.environment})

          sessionStorage['oc_flash'] = JSON.stringify({
            message: this.editingDeployed? __('Deployment saved!'): __('Draft saved!'),
            type: FLASH_TYPES.SUCCESS,
            duration: this.durationOfAlerts,
            linkText: 'Return to overview',
            linkTo: `/${this.project.globalVars.projectPath}#${this.$route.params.slug}` // TODO
          });

          const query = {...this.$route.query}
          delete query.ts

          if(this.branch != 'main') {
            query.branch = this.branch

            if(!this.mergeRequest) {
              const projectPath = this.project.globalVars.projectPath
              const branch = this.branch
              const target = 'main'
              const title = `[Draft] ${this.getDeploymentTemplate.title}`
              const labels = [
                this.$route.params.slug,
                `environment:${this.$route.params.environment}`,
                `application-blueprint-title:${this.getApplicationBlueprint.title}`,
                `application-blueprint-project-path:${projectPath}`,
                'unfurl-gui-mr'
              ]
              const dest = window.location.origin + this.$router.resolve({...this.$route, query}).href
              const description = [
                  `[Edit Deployment Draft 🖊](${dest})`,
                  '\n',
                  `Your Deployment Template will be available as [${this.$route.params.slug}](${window.location.origin}${this.$router.resolve({...this.$route, query: {...query, branch: undefined}}).href}) when it's been merged.`
              ].join('\n')

              try {
                this.mergeRequest = await createMergeRequest(encodeURIComponent(this.getHomeProjectPath), {branch, target, title, labels, description})
                if(redirect) {
                  window.location.href = this.mergeRequest.web_url
                }
                // only return if this succeeds, otherwise we're kicking them off the draft
                return
              } catch(e) {
                if(e.response) {
                  this.createError({
                    message: `Unable to create merge request`,
                    context: e.response,
                    severity: 'critical'
                  })

                }
              }
            }
          }

          if(this.editingDeployed) {
              this.returnToReferrer()
              return
          }

          if(redirect) {
            window.location.href = this.$router.resolve({...this.$route, query}).href
          }
          //window.location.href = `/${this.project.globalVars.projectPath}#${slugify(this.$route.query.fn)}`
        } else {
          await this.commitPreparedMutations();
          return !this.hasCriticalErrors;
        }
      } catch (e) {
        console.error(e)
        this.createError({
            message: `An unexpected error occurred while saving (${e.message})`,
            context: e.message,
            severity: 'major'
        })
        return false;
      }
    },

    triggerLocalDeploy: _.debounce(async function({forceCheck, dryRun}) {
      // TODO consolodate implementation with triggerDeployment

      this.createFlash({
        message: __('Preparing deployment...'),
        type: FLASH_TYPES.SUCCESS,
        duration: this.durationOfAlerts,
      });

      this.startedTriggeringDeployment = true;
      const name = this.$route.query.fn;
      this.setUpdateType('deployment')
      this.setCommitMessage(`Trigger deployment of ${name}`)

      await this.triggerSave();
      if(this.hasCriticalErrors) return

      const result = await this.deployInto({
        environmentName: this.$route.params.environment,
        projectUrl: `${window.gon.gitlab_url}/${this.project.globalVars.projectPath}.git`,
        deployPath: this.deploymentDir,
        deploymentName: this.$route.params.slug,
        deploymentBlueprint: this.$route.query.ts || this.getDeploymentTemplate?.source,
        deployOptions: {
            schedule: 'defer'
        },
        forceCheck,
        dryRun,
      })

      if(this.hasCriticalErrors) return

      if(result === false) return

      const {pipelineData} = result

      if(pipelineData) this.createFlash({ message: __('The pipeline was triggered successfully'), type: FLASH_TYPES.SUCCESS, duration: this.durationOfAlerts });

      const router = this.$router

      const {href} = router.resolve({name: routes.OC_PROJECT_VIEW_HOME , query: {}})
      window.history.replaceState({}, null, href)

      this.dataWritten = true
      window.location.href = `/${this.getHomeProjectPath}/-/deployments/${this.$route.params.environment}/${this.$route.params.slug}?show=local-deploy`
    }, 250),

    triggerDeployment: _.debounce(async function({forceCheck, dryRun}) {
      this.createFlash({
        message: __('Starting deployment...'),
        type: FLASH_TYPES.SUCCESS,
        duration: this.durationOfAlerts,
      });

      this.startedTriggeringDeployment = true;
      const name = this.$route.query.fn;
      this.setUpdateType('deployment')
      this.setCommitMessage(`Trigger deployment of ${name}`)

      await this.triggerSave();
      if(this.hasCriticalErrors) return

      const result = await this.deployInto({
        environmentName: this.$route.params.environment,
        projectUrl: `${window.gon.gitlab_url}/${this.project.globalVars.projectPath}.git`,
        deployPath: this.deploymentDir,
        deploymentName: this.$route.params.slug,
        deploymentBlueprint: this.$route.query.ts || this.getDeploymentTemplate?.source,
        forceCheck,
        dryRun,
      })

      if(this.hasCriticalErrors) return

      const {pipelineData} = result

      if(pipelineData) this.createFlash({ message: __('The pipeline was triggered successfully'), type: FLASH_TYPES.SUCCESS, duration: this.durationOfAlerts });

      const router = this.$router

      const {href} = router.resolve({name: routes.OC_PROJECT_VIEW_HOME , query: {}})
      window.history.replaceState({}, null, href)

      this.dataWritten = true
      window.location.href = `/${this.getHomeProjectPath}/-/deployments/${this.$route.params.environment}/${this.$route.params.slug}?show=console`
    }, 250),

    mergeRequestReady: _.debounce(async function({status}) {
      this.startedTriggeringDeployment = true;
      await this.triggerSave('draft', false);
      this.dataWritten = true

      if(this.hasCriticalErrors) return

      const branch = this.branch
      const target = 'main'
      const labels = [this.$route.params.slug, 'unfurl-gui-mr']

      await setMergeRequestReadyStatus(encodeURIComponent(this.getHomeProjectPath), {branch, target, labels, state: 'opened', status})

      window.location.href = this.mergeRequest.web_url

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
        this.$router.push({ name: routes.OC_PROJECT_VIEW_HOME }); // NOTE can we do this on failure too?
      }catch (e) {
        this.activeSkeleton = false;
        console.error(e);
        this.createFlash({ message: e.message, type: FLASH_TYPES.ALERT });
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
        }
      }catch (e) {
        console.error(e);
        this.createFlash({ message: e.message, type: FLASH_TYPES.ALERT });
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
        this.createFlash({ message: e.message, type: FLASH_TYPES.ALERT });
      }
    },

    async handleDeleteNode() {
      try {
        //this.clearPreparedMutations()
        const deleted = await this.deleteNode(this.deleteNodeData);
      } catch (e) {
        console.error(e);
        this.createFlash({ message: e.message, type: FLASH_TYPES.ALERT });
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

    returnToReferrer() {
        const editingTarget = sessionStorage['editing-target']
        const editingDraftFrom = sessionStorage['editing-draft-from']
        // these don't need to be deleted because they will be overwritten by all current methods of editing a deployment
        //delete sessionStorage['editing-target']
        //delete sessionStorage['editing-draft-from']

        if(window.location.pathname + decodeURIComponent(window.location.search) == editingTarget) {
            window.location.href = editingDraftFrom
        } else {
            // TODO re-enable this when we're able to update the current namespace
            // https://github.com/onecommons/gitlab-oc/issues/867
            // this.$router.push({name: 'projectHome', slug: this.$route.params.slug})
            window.location.href = this.$router.resolve({name: 'projectHome', slug: this.$route.params.slug}).href
        }
    }

  },
};
</script>
<template>
  <div>
    <div v-if="shouldRenderTemplates" :key="componentKey">

      <!-- Header of templates -->
      <oc-template-header />

      <!-- Content -->
      <div class="row-fluid gl-mt-6 gl-mb-6">
        <div>

        </div>
        <oc-card
          :custom-title="getDeploymentTemplate.title"
          :main-card-class="'primary-card'"
          :card="getPrimaryCard"
          :tooltip="deployTooltip"
          :icon-title="true"
          :icon-color="checkAllRequirements() ? 'icon-green' : 'icon-red'"
          :icon-name="checkAllRequirements() ? 'check-circle-filled' : 'warning-solid'"
          :children="[]"
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
                  :card="card"
                  :icon-title="true"
                  :icon-color="card._valid ? 'icon-green' : 'icon-red'"
                  :icon-name="card._valid ? 'check-circle-filled' : 'warning-solid'"
                  :actions="true"
                  :level="idx"
                  :children="[]"
                  removable
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

      <!-- Buttons -->
      <template-buttons
            :loading-deployment="startedTriggeringDeployment"
            :save-status="saveStatus"
            :save-draft-status="saveDraftStatus"
            :delete-status="deleteStatus"
            :merge-status="mergeStatus"
            :cancel-status="cancelStatus"
            :deploy-status="deployStatus"
            :save-tooltip="saveTooltip"
            :mergeRequest="mergeRequest"
            @saveDraft="debouncedTriggerSave('draft', true)"
            @saveTemplate="debouncedTriggerSave"
            @triggerDeploy="triggerDeployment"
            @mergeRequestReady="mergeRequestReady"
            @triggerLocalDeploy="triggerLocalDeploy"
            @cancelDeployment="returnToReferrer"
            @launchModalDeleteTemplate="openModalDeleteTemplate"
            />


      <!-- Modal Resource Template -->
      <gl-modal
            ref="oc-template-resource"
            modal-id="oc-template-resource"
            size="lg"
            :title="`Choose a ${getRequirementResourceType} template for ${getRequirementSelected.requirement && (getRequirementSelected.requirement.constraint.title)}`"
            :action-primary="ocTemplateResourcePrimary"
            :action-cancel="cancelProps"
            @primary="onSubmitTemplateResourceModal"
            @cancel="cleanModalResource"
            >

          <oc-list-resource @input="e => selected = e" v-model="selected" :name-of-resource="getNameResourceModal" :filtered-resource-by-type="[]" :deployment-template="getDeploymentTemplate" :cloud="getDeploymentTemplate.cloud" :valid-resource-types="validResourceTypesForSelectedRequirement" :resourceType="getRequirementResourceType"/>

            <gl-form-group label="Name" class="col-md-4 align_left gl-pl-0 gl-mt-4">
              <gl-form-input id="input1" data-testid="create-resource-template-title" @input="_ => userEditedResourceName = true" v-model="resourceName" type="text"  /><small v-if="alertNameExists" class="alert-input">{{ __("The name can't be replicated. please edit the name!") }}</small>
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
        <ul>
          <li v-for="child in this.nodeChildren" :key="child">
            {{ infallibleGetCardTitle(child) }}
          </li>
        </ul>
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
        <oc-list-resource v-model="selectedServiceToConnect" :name-of-resource="getNameResourceModal" :filtered-resource-by-type="[]" :cloud="getDeploymentTemplate.cloud" :valid-resource-types="validConnections"/>
      </gl-modal>

      <!-- Modal to confirm the action to delete template -->
      <!-- Modal to delete -->
      <gl-modal
        ref="oc-delete-template"
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

