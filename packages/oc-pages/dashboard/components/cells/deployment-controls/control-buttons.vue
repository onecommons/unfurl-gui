<script>
import {GlIcon, GlButton, GlDropdown, GlDropdownItem} from '@gitlab/ui'
export default {
    props: {
        deployment: Object,
        environment: Object,
        resumeEditingTarget: String,
        viewDeploymentTarget: String,
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
<div>
    <component :is='component' v-if="hasButton('open')" target="_blank" rel="noopener noreferrer" :href="deployment.url" style="background-color: #eee">
        <gl-icon name="pencil-square"/> 
        {{__('Open')}}
    </component>
    <component :is='component' v-if="hasButton('edit-draft')" target="_blank" rel="noopener noreferrer" :href="resumeEditingTarget" style="background-color: #eee">
        <gl-icon name="pencil-square"/>
        {{__('Edit Draft')}}
    </component>
    <component :is='component' v-if="hasButton('view-deployment')" :href="viewDeploymentTarget" target="_blank" rel="noopener noreferer" style="background-color: #eee">
        <gl-icon name="external-link"/>
        {{__('View Deployment')}}
    </component>
    <component :is='component' v-if="hasButton('edit-deployment')" target="_blank" rel="noopener noreferrer" :href="resumeEditingTarget" style="background-color: #eee">
        <gl-icon name="pencil-square"/>
        {{__('Edit Deployment')}}
    </component>
    <component :is='component' v-if="hasButton('deploy')" @click="startDeployment" variant="confirm"> <gl-icon name="upload"/> {{__('Deploy')}} </component>
    <component :is='component' v-if="hasButton('teardown')" @click="stopDeployment" variant="danger"><gl-icon name="clear-all" /> {{__('Teardown')}}</component>
    <component :is='component' v-if="hasButton('delete')" @click="deleteDeployment"><gl-icon name="remove" /> {{__('Delete')}}</component>
</div>
</template>
