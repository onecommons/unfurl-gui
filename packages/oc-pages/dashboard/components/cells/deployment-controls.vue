<script>
import {GlIcon, GlDropdown, /*GlDropdownItem*/} from '@gitlab/ui'
import {mapGetters} from 'vuex'
import ControlButtons from './deployment-controls/control-buttons.vue'
import PipelineDropdownItem from './deployment-controls/pipeline-dropdown-item.vue'
import * as routes from '../../router/constants'
export default {
    props: {
        resumeEditingLink: [Object, String],
        viewDeploymentLink: [Object, String],
        scope: Object,
    },
    data() {
        return {
            job: null
        }
    },
    components: {
        GlIcon,
        GlDropdown,
        //GlDropdownItem,
        ControlButtons,
        //PipelineDropdownItem
    },
    computed: {
        ...mapGetters([
            'lookupDeployPath',
            'getHomeProjectPath',
            'deploymentItemDirect',
            'jobByPipelineId',
            'userCanEdit'
        ]),
        deployment() {return this.scope.item.context?.deployment},
        application() {return this.scope.item.context?.application},
        environment() {return this.scope.item.context?.environment},
        deploymentItem() {
            return this.deploymentItemDirect({environment: this.environment, deployment: this.deployment})
        },
        deployPath() { return this.lookupDeployPath(this.deployment?.name, this.environment?.name) },
        pipeline() {
            return this.deployPath?.pipeline
        },
        pipelines() {
            return this.deployPath?.pipelines || []
        },
        createdAt() {
            const date = this.pipeline?.commit?.created_at
            return date && new Date(date)
        },
        pipelineWorkflow() {
            return this.pipeline?.variables?.WORKFLOW
        },
        createdAtDate() { return this.createdAt?.toLocaleDateString() },
        createdAtTime() { return this.createdAt?.toLocaleTimeString() },
        createdAtText() {
            const today = (new Date(Date.now())).getDate() 
            if(this.createdAt.getDate() != today) {
                return 'on ' + this.createdAtDate
            }
            return 'at ' + this.createdAtTime
        },
        controlButtons() {
            const result = []
            if(this.deploymentItem?.isJobCancelable) result.push('cancel-job')
            if(this.deploymentItem?.isDeployed && this.deployment?.url) result.push('open')
            if(this.deploymentItem?.isDraft) {
                if(this.userCanEdit) result.push('edit-draft')
            }
            else {
                if(this.userCanEdit) result.push('edit-deployment')
                if(this.$route.name != routes.OC_DASHBOARD_DEPLOYMENTS) result.push('view-deployment')
            }
            result.push('clone-deployment')
            if(!this.deploymentItem?.isDraft && this.userCanEdit) result.push('teardown')

            //if(this.deploymentItem?.pipelines?.length > 0) result.push('job-history')
            result.push('job-history')

            const pipeline = this.deploymentItem?.pipeline
            if(pipeline?.upstream_pipeline_id && pipeline?.upstream_project_id) {
                result.push('view-artifacts')
            } 
            result.push('local-deploy')
            result.push('view-in-repository')

            // TODO probably want to check that it's deployed

            // these checks are inadequate
            //if(!this.deploymentItem?.isJobCancelable && this.deploymentItem?.isIncremental) result.push('inc-redeploy')


            // temporary solution -- hide behind developer setting
            if(sessionStorage['manual-incremental-deploy'] && !this.deploymentItem?.isJobCancelable && this.deploymentItem?.isIncremental) result.push('inc-redeploy')

            // hide delete as a temporary workaround for https://github.com/onecommons/gitlab-oc/issues/1115
            // if(this.userCanEdit) result.push('delete')
            return result
        },
        disabledButtons() {
            const result = []

            if(!this.deploymentItem?.pipelines?.length) result.push('job-history')

            return result
        },
        primaryControlButtons() {
            return this.controlButtons.slice(0,1)
        },
        contextMenuControlButtons() {
            return this.controlButtons.slice(1)
        },
        resumeEditingTarget() {
            return this.deploymentItem?.editableLink
        },
        viewDeploymentTarget() {
            return this.deploymentItem?.viewableLink
        },
        viewJobsLink() {
            return this.deployPath? `/${this.getHomeProjectPath}/-/jobs?var_deploy_path=${encodeURIComponent(this.deployPath.name)}`: null
        },
        viewInRepositoryLink() {
            return `/${this.getHomeProjectPath}/-/tree/main/${this.deployPath.name}`
        },
        issuesLinkArgs() {
            return [
                this.getHomeProjectPath,
                {
                    title: `Issue with deployment "${this.deployment.title}"`,
                    description: 'Please describe the issue you are experiencing:'
                }
            ]
        }
    },
    methods: {
        deleteDeployment() {
          this.$emit('deleteDeployment', this.deployment, this.environment)
        },
        // teardown in ui
        stopDeployment() {
          this.$emit('stopDeployment', this.deployment, this.environment)
        },
        startDeployment() {
          this.$emit('startDeployment', this.deployment, this.environment)
        },
        cloneDeployment() {
          this.$emit('cloneDeployment', this.deployment, this.environment)
        },
        localDeploy() {
          this.$emit('localDeploy', this.deployment, this.environment)
        },
        incRedeploy() {
          this.$emit('incRedeploy', this.deployment, this.environment)
        },
        async cancelJob() {
            await this.deploymentItem.cancelJob()
            window.location.reload()
        },
        /*
        showPreviousJobs() {
            //this.$emit('showPreviousJobs', this.deployment, this.environment)
            this.$refs.previousJobs?.show()
        },
         */
        pipelineToJobsLink(pipeline) {
            if(!pipeline) return
            const jobId = this.jobByPipelineId(pipeline.id)?.id
            if(!jobId) return
            const result = `/${this.getHomeProjectPath}/-/jobs/${jobId}`
            return result
        },

        edit() {
            this.$emit('edit', this.deployment, this.environment)
        }

    },
}
</script>
<template>
<div class="deployment-controls-outer">
    <div class="deployment-controls">
        <control-buttons 
         :deployment="deployment"
         :environment="environment"
         :view-deployment-target="viewDeploymentTarget"
         :resume-editing-target="resumeEditingTarget"
         :view-jobs-link="viewJobsLink"
         :view-artifacts-link="deploymentItem.artifactsLink"
         :control-buttons="primaryControlButtons"
         :view-in-repository-link="viewInRepositoryLink"
         :disabled-buttons="disabledButtons"
         @deleteDeployment="deleteDeployment"
         @stopDeployment="stopDeployment"
         @startDeployment="startDeployment"
         @cloneDeployment="cloneDeployment"
         @incRedeploy="incRedeploy"
         @cancelJob="cancelJob"
         @localDeploy="localDeploy"
         @edit="edit"
        />
        <gl-dropdown style="margin: 0 -0.5em;" v-if="contextMenuControlButtons.length" variant="link" toggle-class="text-decoration-none" no-caret right :popper-opts="{ positionFixed: true }">
            <template #button-content>
                <gl-icon style="padding-left: 0!important; padding-right: 0 !important; color: black" name="ellipsis_v" :size="24" class="p-1"/>
            </template>
            <control-buttons
             :deployment="deployment"
             :environment="environment"
             :resume-editing-target="resumeEditingTarget"
             :view-jobs-link="viewJobsLink"
             :view-deployment-target="viewDeploymentTarget"
             :view-artifacts-link="deploymentItem.artifactsLink"
             :control-buttons="contextMenuControlButtons"
             :view-in-repository-link="viewInRepositoryLink"
             :disabled-buttons="disabledButtons"
             :issues-link-args="issuesLinkArgs"
             component="gl-dropdown-item"
             @deleteDeployment="deleteDeployment"
             @stopDeployment="stopDeployment"
             @startDeployment="startDeployment"
             @cloneDeployment="cloneDeployment"
             @cancelJob="cancelJob"
             @incRedeploy="incRedeploy"
             @localDeploy="localDeploy"
             @edit="edit"
             />
        </gl-dropdown>
    </div>
    <!--gl-dropdown ref="previousJobs" v-if="pipelines.length > 1" id="jobs-dropdown" toggle-class="text-decoration-none" no-caret right :popper-opts="{ positionFixed: true }">
        <gl-dropdown-item :href="pipelineToJobsLink(pipeline)" :key="pipeline.id" v-for="(pipeline, n) in pipelines.slice(0, -1)">
            <pipeline-dropdown-item :deployment-item="deploymentItem" :pipeline-index="n"/>
        </gl-dropdown-item>
    </gl-dropdown-->
</div>
</template>
<style scoped>
#jobs-dropdown { position: absolute; } 
#jobs-dropdown >>> .dropdown-toggle { padding: 0; } 
.deployment-controls {font-size: 1em; display: flex; height: 2.5em; justify-content: space-between; margin: 0 1em;}
.deployment-controls > * { display: flex; margin: 0 0.25em;}
</style>
