<script>
import {GlIcon, GlButton} from '@gitlab/ui'
import {mapGetters} from 'vuex'
export default {
    props: {
        resumeEditingLink: Object,
        scope: Object,
    },
    components: {
        GlIcon, GlButton
    },
    computed: {
        ...mapGetters([
            'lookupDeployPath'
        ]),
        deployment() {return this.scope.item.context?.deployment},
        application() {return this.scope.item.context?.application},
        environment() {return this.scope.item.context?.environment},
        isDraft() {
            return this.deployment.__typename == 'DeploymentTemplate'
        },
        isUndeployed() {
            return this.deployment.__typename == 'Deployment' && !this.isDeployed
        },
        isDeployed() {
            return this.deployment.__typename == 'Deployment' && this.deployment.statuses?.every(rt => {
                return rt.status != 5 && rt.status != 3
            })
        }

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
        <gl-button v-else-if="isUndeployed" variant="confirm" target="_blank" rel="noopener noreferrer" :href="$router.resolve(resumeEditingLink.to).href">
            <gl-icon name="upload"/>
            {{__('Deploy')}}
        </gl-button>
        <gl-button v-else-if="deployment.url" target="_blank" rel="noopener noreferrer" :href="deployment.url" style="background-color: #eee">
            <gl-icon name="external-link"/> 
            {{__('Open')}}
        </gl-button>
    </div>
    <gl-button v-if="isDeployed" @click="stopDeployment" variant="danger"><gl-icon name="clear-all" /> {{__('Undeploy')}} </gl-button>
    <gl-button v-if="!isDeployed" @click="deleteDeployment"><gl-icon name="remove" /> {{__('Delete')}} </gl-button>
</div>

</template>
<style scoped>
    
.deployment-controls >>> .gl-button {
    width: 8em;
}
.deployment-controls {font-size: 0.95em; display: flex; height: 2.5em; justify-content: space-between; width: 21.5em; margin: 0 1em;}
.deployment-controls > * { display: flex;}
</style>
