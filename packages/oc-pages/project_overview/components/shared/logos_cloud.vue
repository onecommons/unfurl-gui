<script>
import AWS from '../../assets/aws.svg?inline'
import GCP from '../../assets/gcp.svg?inline'
import Azure from '../../assets/azure.svg?inline'
const MAPPINGS = {
    AWSAccount: AWS,
    GoogleCloudAccount: GCP,
    AzureAccount: Azure,
}
export default {
    name: "LogosCloud",
    props: {
        cloud: {
            type: String,
            default: ""
        }
    },
    computed: {
        icon() {

            return MAPPINGS[this.cloud]
        }
        
    }
}
</script>
<template>
    <div> <img v-if="icon" :src="icon" /> </div>
</template>
<style scoped>
img {width: 100%; height: 100%; }
div {width: 100px; height: 25px; }
</style>
