<script lang="ts">
import {defineComponent} from 'vue'
import type {PropType} from 'vue'
import type DeploymentItem from '../../../store/modules/deployment-info/deployment-item'
export default defineComponent({
    name: 'LastDeploy',
    props: {
        deploymentItem: Object as PropType<DeploymentItem>
    },
    data() {
        return {
            upstreamPipelineLink: null as string | null | undefined
        }
    },
    computed: {
        createdAtText() {
            return this.deploymentItem?.createdAtText
        }
    },
    watch: {
        deploymentItem: {
            immediate: true,
            handler(item: DeploymentItem | undefined) {
                if(!item) return
                item.getUpstreamPipelineLink().then((res: string | undefined) => this.upstreamPipelineLink = res) // this doesn't fetch when there's no upstream pipeline reference
            }
        }
    }
})

</script>
<template>
    <div>
        {{createdAtText}}
        <div v-if="deploymentItem && createdAtText">
            <span v-if="deploymentItem.consoleLink">
                <a :href="deploymentItem.consoleLink">View Job {{deploymentItem.jobStatusMessage}}</a> /
                <a v-if="upstreamPipelineLink" :href="upstreamPipelineLink">View Build</a>
                <a v-else :href="deploymentItem.artifactsLink">View Artifacts</a>
            </span>
        </div>
    </div>
</template>
