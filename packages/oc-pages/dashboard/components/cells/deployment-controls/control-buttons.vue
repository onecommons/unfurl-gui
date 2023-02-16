<script>
import {GlIcon, GlButton, GlDropdown, GlDropdownItem} from '@gitlab/ui'
import {generateGitLabIssueSync} from 'oc_vue_shared/client_utils/gitlab-issues'
import OpenLiveApp from './open-live-app.vue'
export default {
    props: {
        deployment: Object,
        environment: Object,
        resumeEditingTarget: String,
        viewDeploymentTarget: String,
        viewJobsLink: String,
        viewArtifactsLink: String,
        issuesLinkArgs: Array,
        viewInRepositoryLink: String,
        controlButtons: Array,
        disabledButtons: Array,
        component: {
            type: [String, Object],
            default: () => 'gl-button'
        }
    },
    components: {GlIcon, GlButton, GlDropdown, GlDropdownItem, OpenLiveApp},
    methods: {
        hasButton(id) { return this.controlButtons.includes(id) },
        hasDisabledButton(id) { return this.disabledButtons.includes(id) },
        deleteDeployment() {
            this.$emit('deleteDeployment')
        },
        stopDeployment() {
            this.$emit('stopDeployment')
        },
        startDeployment() {
            this.$emit('startDeployment')
        },
        cloneDeployment() {
            this.$emit('cloneDeployment')
        },
        cancelJob() {
            this.$emit('cancelJob')
        },
        showPreviousJobs() {
            this.$emit('showPreviousJobs')
        },
        localDeploy() {
            this.$emit('localDeploy')
        },
        incRedeploy() {
            this.$emit('incRedeploy')
        },
        async openIssue() {
            const link = generateGitLabIssueSync(...this.issuesLinkArgs)
            window.open(link, '_blank')
        },
        beforeResumeEdit(e) {
            // TODO move this into user_settings store
            // used for cancel deployment
            sessionStorage['editing-draft-from'] = window.location.href
            sessionStorage['editing-target'] = this.resumeEditingTarget
            e.preventDefault()
            this.$emit('edit')
        }
    }
}
</script>
<template>
<div class="control-button-container">
    <component :is='component' v-if="hasButton('cancel-job')" @click="cancelJob">
        <gl-icon :size="16" name="cancel"/> 
        {{__('Cancel Job')}}
    </component>
    <open-live-app :component="component" v-if="hasButton('open')" :deployment="deployment" />
    <component :is='component' v-if="hasButton('edit-draft')" @click="beforeResumeEdit" :href="resumeEditingTarget">
        <gl-icon :size="16" name="pencil-square"/>
        {{__('Edit Draft')}}
    </component>
    <component :is='component' v-if="hasButton('view-deployment')" :href="viewDeploymentTarget" rel="noopener noreferer" variant="confirm">
        <gl-icon :size="16" name="external-link"/>
        {{__('View Deployment')}}
    </component>
    <component :is='component' v-if="hasButton('edit-deployment')" @click="beforeResumeEdit" :href="resumeEditingTarget">
        <gl-icon :size="16" name="pencil-square"/>
        {{__('Edit Deployment')}}
    </component>
    <component :is='component' v-if="hasButton('clone-deployment')" @click="cloneDeployment">
        <gl-icon :size="16" name="duplicate"/>
        {{__('Clone Deployment')}}
    </component>
    <component :is='component' v-if="hasButton('deploy')" @click="startDeployment" variant="confirm"> <gl-icon :size="16" name="upload"/> {{__('Deploy')}} </component>
    <component :is='component' v-if="hasButton('teardown')" @click="stopDeployment" variant="danger"><gl-icon :size="16" name="clear-all" /> {{__('Teardown')}}</component>
    <!-- View Deployment History is too long when this is the primary action --> 
    <component :is='component' v-if="hasButton('job-history')" :disabled="hasDisabledButton('job-history')" :href="viewJobsLink">
        <gl-icon :size="16" name="history"/> 
        {{component == 'gl-button'? __("Deploy History"): __('View Deployment History')}}
    </component>
    <component :is='component' v-if="hasButton('view-artifacts')" :href="viewArtifactsLink">
        <gl-icon :size="16" name="archive"/> 
        {{__('View Artifacts')}}
    </component>
    <component :is='component' v-if="hasButton('local-deploy')" @click="localDeploy"><gl-icon :size="16" name="upload" /> {{__('Deploy Locally')}}</component>
    <component :is='component' v-if="hasButton('view-in-repository')" :href="viewInRepositoryLink" target="_blank"><gl-icon :size="16" name="file-tree" /> {{__('View in Repository')}}</component>
    <component :is='component' v-if="hasButton('inc-redeploy')" @click="incRedeploy"><gl-icon :size="16" name="repeat" /> {{__('Incremental Redeploy')}}</component>
    <component :is='component' v-if="issuesLinkArgs" @click="openIssue"><gl-icon :size="16" name="abuse" /> {{__('Report Issue')}}</component>
    <component :is='component' v-if="hasButton('delete')" @click="deleteDeployment"><gl-icon :size="16" name="remove" /> {{__('Delete')}}</component>
</div>
</template>
<style scoped>
.control-button-container >>> .gl-button-text {
    font-size: 0.95em;
    font-weight: 600;
    display: flex;
    align-items: center;
}
.control-button-container >>> .gl-button { width: 10em; padding: 0.2em 0;}
.control-button-container >>> .gl-new-dropdown-item-text-primary { display: flex; align-items: center; }
.control-button-container >>> .gl-icon { margin-right: 0.25em; }
.control-button-container >>> .disabled { opacity: 0.7; }
</style>
