<script>
import {GlIcon, GlButton, GlDropdown, GlDropdownItem} from '@gitlab/ui'
export default {
    props: {
        deployment: Object,
        environment: Object,
        resumeEditingTarget: String,
        viewDeploymentTarget: String,
        issuesLink: String,
        controlButtons: Array,
        component: {
            type: [String, Object],
            default: () => 'gl-button'
        }
    },
    components: {GlIcon, GlButton, GlDropdown, GlDropdownItem},
    methods: {
        hasButton(id) { return this.controlButtons.includes(id) },
        deleteDeployment() {
            this.$emit('deleteDeployment')
        },
        stopDeployment() {
            this.$emit('stopDeployment')
        },
        startDeployment() {
            this.$emit('startDeployment')
        },
        cancelJob() {
            this.$emit('cancelJob')
        },
        showPreviousJobs() {
            this.$emit('showPreviousJobs')
        },
    }
}
</script>
<template>
<div class="control-button-container">
    <component :is='component' v-if="hasButton('cancel-job')" @click="cancelJob">
        <gl-icon :size="16" name="cancel"/> 
        {{__('Cancel Job')}}
    </component>
    <component :is='component' v-if="hasButton('open')" target="_blank" rel="noopener noreferrer" :href="deployment.url" variant="confirm">
        <gl-icon :size="16" name="external-link"/> 
        {{__('Open Live App')}}
    </component>
    <component :is='component' v-if="hasButton('edit-draft')" target="_blank" rel="noopener noreferrer" :href="resumeEditingTarget" style="background-color: #eee">
        <gl-icon :size="16" name="pencil-square"/>
        {{__('Edit Draft')}}
    </component>
    <component :is='component' v-if="hasButton('view-deployment')" :href="viewDeploymentTarget" target="_blank" rel="noopener noreferer" variant="confirm">
        <gl-icon :size="16" name="external-link"/>
        {{__('View Deployment')}}
    </component>
    <component :is='component' v-if="hasButton('edit-deployment')" target="_blank" rel="noopener noreferrer" :href="resumeEditingTarget" style="background-color: #eee">
        <gl-icon :size="16" name="pencil-square"/>
        {{__('Edit Deployment')}}
    </component>
    <component :is='component' v-if="hasButton('deploy')" @click="startDeployment" variant="confirm"> <gl-icon :size="16" name="upload"/> {{__('Deploy')}} </component>
    <component :is='component' v-if="hasButton('teardown')" @click="stopDeployment" variant="danger"><gl-icon :size="16" name="clear-all" /> {{__('Teardown')}}</component>
    <component :is='component' v-if="issuesLink" :href="issuesLink"><gl-icon :size="16" name="abuse" /> {{__('Report Issue')}}</component>
    <component :is='component' v-if="hasButton('job-history')" @click="showPreviousJobs">
        <gl-icon :size="16" name="history"/> 
        {{__('Previous Jobs')}}
    </component>
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
</style>
