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
            'jobByPipelineId'
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
            if(this.deploymentItem?.isDraft) result.push('edit-draft')
            else {
                if(this.deploymentItem?.isEditable) result.push('edit-deployment')
                if(this.$route.name != routes.OC_DASHBOARD_DEPLOYMENTS) result.push('view-deployment')
                result.push('clone-deployment')
            }
            //if(this.isUndeployed) result.push('deploy')
            if(this.deploymentItem?.isDeployed) result.push('teardown')
            if(this.deploymentItem?.pipelines?.length > 1) result.push('job-history')
            result.push('delete')
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
         :control-buttons="primaryControlButtons"
         @deleteDeployment="deleteDeployment"
         @stopDeployment="stopDeployment"
         @startDeployment="startDeployment"
         @cloneDeployment="cloneDeployment"
         @cancelJob="cancelJob"
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
             :control-buttons="contextMenuControlButtons"
             :issues-link-args="issuesLinkArgs"
             component="gl-dropdown-item"
             @deleteDeployment="deleteDeployment"
             @stopDeployment="stopDeployment"
             @startDeployment="startDeployment"
             @cloneDeployment="cloneDeployment"
             @cancelJob="cancelJob"
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
