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
            this.$emit('deleteDeployment', this.deployment, this.environment)
        },
        stopDeployment() {
            this.$emit('stopDeployment', this.deployment, this.environment)
        },
        startDeployment() {
            this.$emit('startDeployment', this.deployment, this.environment)
        },
    }
}
</script>
<template>
<div class="control-button-container">
    <component :is='component' v-if="hasButton('open')" target="_blank" rel="noopener noreferrer" :href="deployment.url" variant="confirm">
        <gl-icon :size="14" name="pencil-square"/> 
        {{__('Open')}}
    </component>
    <component :is='component' v-if="hasButton('edit-draft')" target="_blank" rel="noopener noreferrer" :href="resumeEditingTarget" style="background-color: #eee">
        <gl-icon :size="14" name="pencil-square"/>
        {{__('Edit Draft')}}
    </component>
    <component :is='component' v-if="hasButton('view-deployment')" :href="viewDeploymentTarget" target="_blank" rel="noopener noreferer" variant="confirm">
        <gl-icon :size="14" name="external-link"/>
        {{__('View Deployment')}}
    </component>
    <component :is='component' v-if="hasButton('edit-deployment')" target="_blank" rel="noopener noreferrer" :href="resumeEditingTarget" style="background-color: #eee">
        <gl-icon :size="14" name="pencil-square"/>
        {{__('Edit Deployment')}}
    </component>
    <component :is='component' v-if="hasButton('deploy')" @click="startDeployment" variant="confirm"> <gl-icon :size="14" name="upload"/> {{__('Deploy')}} </component>
    <component :is='component' v-if="hasButton('teardown')" @click="stopDeployment" variant="danger"><gl-icon :size="14" name="clear-all" /> {{__('Teardown')}}</component>
    <component :is='component' v-if="issuesLink" :href="issuesLink"><gl-icon :size="14" name="abuse" /> {{__('Report Issue')}}</component>
    <component :is='component' v-if="hasButton('delete')" @click="deleteDeployment"><gl-icon :size="14" name="remove" /> {{__('Delete')}}</component>
</div>
</template>
<style scoped>
.control-button-container >>> .gl-button-text {
    font-size: 0.85em;
    font-weight: 600;
    display: flex;
    align-items: center;
}
.control-button-container >>> .gl-button { width: 9.5em; padding: 0.25em;}
.control-button-container >>> .gl-new-dropdown-item-text-primary { display: flex; align-items: center; }
.control-button-container >>> .gl-icon { margin-right: 0.25em; }
</style>
