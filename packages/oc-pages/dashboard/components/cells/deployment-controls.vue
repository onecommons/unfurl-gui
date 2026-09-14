<script>
import {GlDisclosureDropdown, GlButtonGroup} from '@gitlab/ui'
import {mapGetters, mapActions} from 'vuex'
import {lookupKey} from 'oc_vue_shared/storage-keys'
import {homeProjectDefaultBranch} from 'oc_vue_shared/mixins/default-branch'
import ControlButtons from './deployment-controls/control-buttons.vue'
import * as routes from '../../router/constants'
import {projectPathToHomeRoute} from 'oc_vue_shared/client_utils/dashboard'

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
    mixins: [homeProjectDefaultBranch],
    data() {
        return {
            job: null
        }
    },
    components: {
        GlDisclosureDropdown,
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
            return this.deployPath? `${projectPathToHomeRoute(this.getHomeProjectPath)}/-/jobs?var_deploy_path=${encodeURIComponent(this.deployPath.name)}`: null
        },
        viewInRepositoryLink() {
            let result = `${projectPathToHomeRoute(this.getHomeProjectPath)}/-/tree/${this.homeProjectDefaultBranch}/${this.deployPath.name}`
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
            const result = `${projectPathToHomeRoute(this.getHomeProjectPath)}/-/jobs/${jobId}`
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
            <!-- Not gl-dropdown: it positions with popper v1, whose positionFixed
                 assumes the viewport is the containing block. Upstream's .panel-content
                 sets `contain: layout`, which makes it one, so the menu painted a
                 panel's width and height away from its toggle. This positions with
                 floating-ui, which resolves against the real containing block. -->
            <gl-disclosure-dropdown
                    v-if="contextMenuControlButtons.length"
                    placement="bottom-end"
                    positioning-strategy="fixed"
                    icon="ellipsis_v"
                    no-caret
                    text-sr-only
                    :toggle-text="__('Deployment actions')"
            >
                <control-buttons
                        v-bind="attrs"
                        :control-buttons="contextMenuControlButtons"
                        :issues-link-args="issuesLinkArgs"
                        component="dropdown-action-item"
                        v-on="handlers"
                 />
            </gl-disclosure-dropdown>
        </gl-button-group>
    </div>
</div>
</template>
<style scoped>
/* No horizontal margin: the controls are the widest column and the table has to
   fit a limit-container-width panel, so the row cannot afford whitespace it does
   not use. The dropdown-menu `top: 95px !important` that used to live here was
   compensating for gl-dropdown painting its menu a panel away from the toggle --
   fixed at the source by positioning with floating-ui, so it is gone. */
.deployment-controls {font-size: 1em; display: flex; height: 2.5em; justify-content: space-between;}
.deployment-controls > * { display: flex; }

/* control-buttons wraps its buttons in a div, so they are not direct children
   of gl-button-group and its `> .btn` corner rules never reach them -- leaving
   the primary button fully rounded against the toggle, which then reads as two
   controls that happen to touch. Square the adjoining edges and close the 1px
   gap so the pair renders as one. */
.deployment-controls :deep(.control-button-container > .btn:last-child) {
    border-top-right-radius: 0;
    border-bottom-right-radius: 0;
}
.deployment-controls :deep(.gl-new-dropdown) { margin-left: -1px; }

/* The button and the toggle are one control, so the button's right border just
   draws a seam down the middle of it -- low contrast in dark mode, plainly
   visible in light. */
.deployment-controls :deep(.control-button-container > .btn:last-child) {
    border-right-color: transparent;
}

/* Keeps the control off the table's right edge; the row is the widest column
   so the space has to come from the environment name's cap, not from here. */
.deployment-controls { padding-right: 8px; }

</style>
