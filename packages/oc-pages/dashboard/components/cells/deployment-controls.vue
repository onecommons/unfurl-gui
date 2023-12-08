<script>
import {GlDropdown, GlButtonGroup} from '@gitlab/ui'
import {mapGetters} from 'vuex'
import {lookupKey} from 'oc_vue_shared/storage-keys'
import ControlButtons from './deployment-controls/control-buttons.vue'
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
        GlDropdown,
        GlButtonGroup,
        ControlButtons,
    },
    computed: {
        ...mapGetters([
            'lookupDeployPath',
            'getHomeProjectPath',
            'deploymentItemDirect',
            'jobByPipelineId',
            'userCanEdit',
            'serviceDesk'
        ]),
        deployment() {return this.scope.item.context?.deployment},
        application() {return this.scope.item.context?.application},
        environment() {return this.scope.item.context?.environment},
        deploymentItem() {
            return this.deploymentItemDirect({environment: this.environment, deployment: this.deployment})
        },
        deployPath() { return this.lookupDeployPath(this.deployment?.name, this.environment?.name) },
        pipeline() {
            return this.deploymentItem?.pipeline
        },
        pipelines() {
            return this.deploymentItem?.pipelines || []
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
            if(this.deploymentItem?.isAutostopCancelable) result.push('cancel-autostop')
            if(this.deploymentItem?.isRunning && this.deployment?.url) result.push('open')
            if(!this.deploymentItem?.isJobCancelable) {

                if(this.deploymentItem?.isDraft) {
                    if(this.userCanEdit) result.push('edit-draft')
                }
                else {
                    if(this.userCanEdit) result.push('edit-deployment')
                    if(this.$route.name != routes.OC_DASHBOARD_DEPLOYMENTS) result.push('view-deployment')
                }
            }

            if(this.userCanEdit) {
                result.push('clone-deployment')
            }

            if(!this.deploymentItem?.isDraft && this.userCanEdit && !this.deploymentItem?.isJobCancelable) result.push('teardown')

            //if(this.deploymentItem?.pipelines?.length > 0) result.push('job-history')
            result.push('job-history')

            const pipeline = this.deploymentItem?.pipeline
            if(pipeline?.upstream_pipeline_id && pipeline?.upstream_project_id) {
                result.push('view-artifacts')
            }

            if(window.gon.projectId && this.userCanEdit) {
                //temporary limitation (restrict to dashboard app)

                // allowing local deploy regardless of teardown status
                result.push('local-deploy')
            }

            if(this.userCanEdit) {
                result.push('rename-deployment')
            }

            result.push('view-in-repository')

            // these checks are inadequate
            //if(!this.deploymentItem?.isJobCancelable && this.deploymentItem?.isIncremental) result.push('inc-redeploy')
            // temporary solution -- hide behind developer setting
            if(lookupKey('manualIncrementalDeploy') && !this.deploymentItem?.isJobCancelable) result.push('inc-redeploy')
            //if(!this.deploymentItem?.isJobCancelable && this.deploymentItem?.isIncremental) result.push('inc-redeploy')

            if(this.userCanEdit && !this.deploymentItem?.isJobCancelable) result.push('delete')
            return result
        },
        disabledButtons() {
            const result = []

            if(!this.deploymentItem?.pipelines?.length) result.push('job-history')

            return result
        },
        primaryControlButtons() {
            return [this.controlButtons.find(cb => !this.disabledButtons.includes(cb))]
        },
        contextMenuControlButtons() {
            return this.controlButtons.filter(cb => cb != this.primaryControlButtons)
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
                    description: 'Please describe the issue you are experiencing:',
                    serviceDesk: this.serviceDesk,
                    confidential: true
                }
            ]
        }
    },
    methods: {
        renameDeployment() {
            this.$emit('renameDeployment', this.deployment, this.environment)
        },
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
            if(this.deploymentItem.isAutostopCancelable) {
                await this.deploymentItem.cancelAutostop()
            }
            await this.deploymentItem.cancelJob()
            window.location.reload()
        },
        async cancelAutostop() {
            await this.deploymentItem.cancelAutostop()
            window.location.reload()
        },
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
        <gl-button-group>
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
             @renameDeployment="renameDeployment"
             @deleteDeployment="deleteDeployment"
             @stopDeployment="stopDeployment"
             @startDeployment="startDeployment"
             @cloneDeployment="cloneDeployment"
             @incRedeploy="incRedeploy"
             @cancelJob="cancelJob"
             @cancelAutostop="cancelAutostop"
             @localDeploy="localDeploy"
             @edit="edit"
            />
            <gl-dropdown v-if="contextMenuControlButtons.length" right :popper-opts="{ positionFixed: true }">
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
                 @renameDeployment="renameDeployment"
                 @deleteDeployment="deleteDeployment"
                 @stopDeployment="stopDeployment"
                 @startDeployment="startDeployment"
                 @cloneDeployment="cloneDeployment"
                 @cancelJob="cancelJob"
                 @cancelAutostop="cancelAutostop"
                 @incRedeploy="incRedeploy"
                 @localDeploy="localDeploy"
                 @edit="edit"
                 />
            </gl-dropdown>
        </gl-button-group>
    </div>
</div>
</template>
<style scoped>
.deployment-controls {font-size: 1em; display: flex; height: 2.5em; justify-content: space-between; margin: 0 1em;}
.deployment-controls > * { display: flex; margin: 0 0.25em;}
</style>
