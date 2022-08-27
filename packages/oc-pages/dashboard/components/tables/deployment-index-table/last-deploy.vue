<script>
export default {
    name: 'LastDeploy',
    props: {
        deploymentItem: Object
    },
    data() {
        return {
            createdAtText: null,
            upstreamPipelineLink: null
        }
    },
    watch: {
        deploymentItem: {
            immediate: true,
            handler(item) {
                item.getUpstreamPipelineLink().then(res => this.upstreamPipelineLink = res) // this doesn't fetch when there's no upstream pipeline reference
                item.getCreatedAtText().then(res => this.createdAtText = res)
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
