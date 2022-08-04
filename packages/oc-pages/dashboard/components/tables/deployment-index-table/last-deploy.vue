<script>
export default {
    name: 'LastDeploy',
    props: {
        deploymentItem: Object
    },
    data() {
        return {
            createdAtText: null,
        }
    },
    watch: {
        deploymentItem: {
            immediate: true,
            async handler(item) {
                this.createdAtText = await item.getCreatedAtText() 
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
                <a :href="deploymentItem.artifactsLink">View Artifacts</a>
            </span>
        </div>
    </div>
</template>
