<script>
export default {
    name: 'LastDeploy',
    props: {
        deploymentItem: Object
    },
    data() {
        return {
            upstreamPipelineLink: null
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
            handler(item) {
                if(!item) return
                item.getUpstreamPipelineLink().then(res => this.upstreamPipelineLink = res) // this doesn't fetch when there's no upstream pipeline reference
            }
        }
    }
}

</script>
<template>
    <div>
        {{createdAtText}}
        <div v-if="createdAtText">
            <span v-if="deploymentItem.consoleLink">
                <a :href="deploymentItem.consoleLink">View Job {{deploymentItem.jobStatusMessage}}</a> /
                <a v-if="upstreamPipelineLink" :href="upstreamPipelineLink">View Build</a>
                <a v-else :href="deploymentItem.artifactsLink">View Artifacts</a>
            </span>
        </div>
    </div>
</template>
