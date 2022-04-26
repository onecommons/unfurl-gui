<script>
import {GlIcon, GlDropdown, GlDropdownItem} from '@gitlab/ui'
import {mapGetters} from 'vuex'
import {lookupPipelineJobs} from '../../../vue_shared/client_utils/pipelines'
import {generateIssueLink} from '../../../vue_shared/client_utils/issues'
import ControlButtons from './deployment-controls/control-buttons.vue'
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
        ControlButtons
    },
    computed: {
        ...mapGetters([
            'lookupDeployPath',
            'getHomeProjectPath',
            'deploymentItemDirect',
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
            if(this.deploymentItem?.isDeployed && this.deployment?.url) result.push('open')
            if(this.deploymentItem?.isDraft) result.push('edit-draft')
            else if(this.deploymentItem?.isEditable) result.push('edit-deployment')
            else result.push('view-deployment')
            //if(this.isUndeployed) result.push('deploy')
            if(this.deploymentItem?.isDeployed) result.push('teardown')
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
            return this.deploymentItem?.viewableLink
        },
        viewDeploymentTarget() {
            return this.deploymentItem?.viewableLink
        },
        issuesLink() {
            return generateIssueLink(
                this.getHomeProjectPath,
                {
                    title: `Issue with deployment "${this.deployment.title}"`,
                    description: 'Please describe the issue you are experiencing:'
                }
            )
        }
    },
    methods: {
        deleteDeployment() {
          this.$emit('deleteDeployment', this.deployment, this.environment)
        },
        stopDeployment() {
          this.$emit('stopDeployment', this.deployment, this.environment)
        },
        startDeployment() {
          this.$emit('startDeployment', this.deployment, this.environment)
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
         :control-buttons="primaryControlButtons"
         @deleteDeployment="deleteDeployment"
         @stopDeployment="stopDeployment"
         @startDeployment="startDeployment"
        />
        <gl-dropdown style="margin: 0 -0.5em;" v-if="contextMenuControlButtons.length" variant="link" toggle-class="text-decoration-none" no-caret right>
            <template #button-content>
                <gl-icon style="padding-left: 0!important; padding-right: 0 !important; color: black" name="ellipsis_v" :size="24" class="p-1"/>
            </template>
            <control-buttons
             :deployment="deployment"
             :environment="environment"
             :resume-editing-target="resumeEditingTarget"
             :view-deployment-target="viewDeploymentTarget"
             :control-buttons="contextMenuControlButtons"
             :issues-link="issuesLink"
             component="gl-dropdown-item"
             @deleteDeployment="deleteDeployment"
             @stopDeployment="stopDeployment"
             @startDeployment="startDeployment"
            />
        </gl-dropdown>
    </div>
</div>
</template>
<style scoped>
    
.deployment-controls {font-size: 0.95em; display: flex; height: 2.5em; justify-content: space-between; margin: 0 1em;}
.deployment-controls > * { display: flex; margin: 0 0.25em;}
</style>
