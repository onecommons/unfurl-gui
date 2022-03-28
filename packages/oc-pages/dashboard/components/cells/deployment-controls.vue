<script>
import {GlIcon, GlButton} from '@gitlab/ui'
import {mapGetters} from 'vuex'
import {lookupPipelineJobs} from '../../../vue_shared/client_utils/pipelines'
export default {
    props: {
        resumeEditingLink: Object,
        scope: Object,
    },
    data() {
        return {
            job: null
        }
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
        isDraft() {
            return this.deployment.__typename == 'DeploymentTemplate' && this.pipeline === undefined
        },
        isUndeployed() {
            return this.deployment.__typename == 'Deployment' && !this.isDeployed
        },
        isDeployed() {
            return this.deployment.__typename == 'Deployment' && this.deployment.statuses?.every(rt => {
                return rt?.status != 5 && rt?.status != 3
            })
        }

    },
    methods: {
        deleteDeployment() {
          this.$emit('deleteDeployment', this.deployment, this.environment)
        },
        stopDeployment() {
          this.$emit('stopDeployment', this.deployment, this.environment)
        }
    },
    async mounted() {
        const projectId = this.deployPath?.projectId
        const pipelineId = this.deployPath?.pipeline?.id
        if(projectId && pipelineId) {
            const jobs = await lookupPipelineJobs({projectId, pipelineId})
            try {
                this.job = jobs[0]
            } catch(e) {}
        }

    },

}
</script>
<template>
<div class="deployment-controls-outer">
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
    <div style="height: 0;" v-if="createdAt">
        <div style="font-size: 0.95em; position: absolute; width: calc(100% - 1em); text-align: right; top: -2px;">
            {{__(pipelineWorkflow == 'undeploy'? 'Stopped': 'Created')}} {{createdAtText}} <span v-if="job">(<a :href="job.web_url">Console</a>)</span>
        </div>
    </div>
</div>
</template>
<style scoped>
    
.deployment-controls >>> .gl-button {
    width: 8em;
}
.deployment-controls {font-size: 0.95em; display: flex; height: 2.5em; justify-content: space-between; width: 21.5em; margin: 0 1em;}
.deployment-controls > * { display: flex;}
</style>
