<script>
import {GlDropdown, GlButtonGroup} from '@gitlab/ui'
import {mapGetters, mapActions} from 'vuex'
import {lookupKey} from 'oc_vue_shared/storage-keys'
import ControlButtons from './deployment-controls/control-buttons.vue'
import * as routes from '../../router/constants'

function emitDeploymentItemFor(eventNames) {
    const result = {}

    for(const eventName of eventNames) {
        result[eventName] = function() {
            this.$emit(eventName, this.deployment, this.environment)
        }
    }

    return result
}

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
            'serviceDesk',
            'getDashboardItems'
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
            if(this.deploymentItem?.isRunning) {
                result.push('schedule-autostop')
            }
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

            // will be disabled when needed
            result.push('job-history')

            const pipeline = this.deploymentItem?.pipeline
            if(pipeline?.upstream_pipeline_id && pipeline?.upstream_project_id) {
                result.push('view-artifacts')
            }

            if((window.gon.unfurl_gui || window.gon.projectId) && this.userCanEdit) {
                //temporary limitation (restrict to dashboard app)

                // allowing local deploy regardless of teardown status
                result.push('local-deploy')
            }

            if(this.userCanEdit) {
                if(this.deploymentItem?.isRenamable) result.push('rename-deployment')
            }

            if(!window.gon.unfurl_gui || window.gon.gitlab_url) {
                result.push('view-in-repository')
            }

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

            if(!this.deploymentItem?.pipelines?.length || window.gon.unfurl_gui) result.push('job-history')

            if(window.gon.unfurl_gui) {
                result.push('cancel-job')
                result.push('cancel-autostop')
                result.push('schedule-autostop')
            }

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
            let result = `/${this.getHomeProjectPath}/-/tree/main/${this.deployPath.name}`
            if(window.gon.unfurl_gui && window.gon.gitlab_url) {
                result = window.gon.gitlab_url + result
            }
            return result
        },
        issuesLinkArgs() {
            if(window.gon.unfurl_gui && !window.gon.gitlab_url) return

            return [
                this.getHomeProjectPath,
                {
                    title: `Issue with deployment "${this.deployment.title}"`,
                    description: 'Please describe the issue you are experiencing:',
                    serviceDesk: this.serviceDesk,
                    confidential: true
                }
            ]
        },
        attrs() {
            return {
                deploymentItem: this.deploymentItem,
                'resume-editing-target': this.resumeEditingTarget,
                'view-jobs-link': this.viewJobsLink,
                'view-deployment-target': this.viewDeploymentTarget,
                'view-artifacts-link': this.deploymentItem?.artifactsLink,
                'view-in-repository-link': this.viewInRepositoryLink,
                'disabled-buttons': this.disabledButtons,
            }

        },
        handlers() {
            const result = {
                renameDeployment: this.renameDeployment,
                deleteDeployment: this.deleteDeployment,
                stopDeployment: this.stopDeployment,
                startDeployment: this.startDeployment,
                cloneDeployment: this.cloneDeployment,
                incRedeploy: this.incRedeploy,
                cancelJob: this.cancelJob,
                cancelAutostop: this.cancelAutostop,
                scheduleAutostop: this.scheduleAutostop,
                localDeploy: this.localDeploy,
                edit: this.edit,
            }

            Object.values(result).forEach(handler => handler.bind(this))
            return result
        }
    },
    methods: {
        ...mapActions([
            'populateJobsList',
            'populateDeploymentItems',
        ]),
        ...emitDeploymentItemFor([
            'renameDeployment',
            'deleteDeployment',
            'scheduleAutostop',
            'stopDeployment',
            'startDeployment',
            'cloneDeployment',
            'localDeploy',
            'incRedeploy',
            'edit',
        ]),

        async cancelJob() {
            if(this.deploymentItem.isAutostopCancelable) {
                await this.deploymentItem.cancelAutostop()
            }
            await this.deploymentItem.cancelJob()

            await this.populateJobsList()
            await this.populateDeploymentItems(this.getDashboardItems)
        },
        async cancelAutostop() {
            await this.deploymentItem.cancelAutostop()

            await this.populateJobsList()
            await this.populateDeploymentItems(this.getDashboardItems)
        },
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
        <gl-button-group>
            <control-buttons
                    v-bind="attrs"
                    :control-buttons="primaryControlButtons"
                    component="gl-button"
                    v-on="handlers"
            />
            <gl-dropdown v-if="contextMenuControlButtons.length" :popper-opts="{ positionFixed: true, placement: 'bottom-end' }">
                <control-buttons
                        v-bind="attrs"
                        :control-buttons="contextMenuControlButtons"
                        :issues-link-args="issuesLinkArgs"
                        component="gl-dropdown-item"
                        v-on="handlers"
                 />
            </gl-dropdown>
        </gl-button-group>
    </div>
</div>
</template>
<style scoped>
.deployment-controls {font-size: 1em; display: flex; height: 2.5em; justify-content: space-between; margin: 0 1em;}
.deployment-controls > * { display: flex; margin: 0 0.25em;}
.deployment-controls >>> .dropdown-menu {
    top: 95px !important; /* not sure why this became necessary */
}
</style>
