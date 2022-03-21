<script>
import {GlIcon, GlButton} from '@gitlab/ui'
export default {
    props: {
        resumeEditingLink: Object,
        scope: Object,
    },
    components: {
        GlIcon, GlButton
    },
    computed: {
        deployment() {return this.scope.item.context?.deployment},
        application() {return this.scope.item.context?.application},
        environment() {return this.scope.item.context?.environment},
        isDraft() {
            return this.deployment?.__typename == 'DeploymentTemplate'
        },
        isDeployed() {
            return this.deployment?.__typename == 'Deployment'
        },

    },
    methods: {
        deleteDeployment() { this.$emit('deleteDeployment', this.deployment, this.environment) },
        stopDeployment() { this.$emit('stopDeployment', this.deployment, this.environment) }
    }
}
</script>
<template>
<div v-if="environment && deployment && application" class="deployment-controls">
    <div class="external-link-container">
        <gl-button v-if="isDraft" target="_blank" rel="noopener noreferrer" :href="$router.resolve(resumeEditingLink.to).href" style="background-color: #eee">
            <gl-icon name="external-link"/>
            {{__('Resume')}}
        </gl-button>
        <gl-button v-else target="_blank" rel="noopener noreferrer" :href="application.livePreview" style="background-color: #eee">
            <gl-icon name="external-link"/> 
            {{__('Open')}}
        </gl-button>
    </div>
    <gl-button v-if="isDeployed" @click="stopDeployment" variant="danger"><gl-icon name="stop" /> {{__('Undeploy')}} </gl-button>
    <gl-button v-if="!isDeployed" @click="deleteDeployment"><gl-icon name="remove" /> {{__('Delete')}} </gl-button>
</div>

</template>
<style scoped>
    
.deployment-controls {font-size: 0.95em; display: flex; height: 2.5em; justify-content: center;}
.deployment-controls > * { display: flex; margin: 0 0.3em; }
</style>
