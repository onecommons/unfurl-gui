<script>
import AWS from '../../assets/aws.svg?inline'
import GCP from '../../assets/gcp.svg?inline'
import Azure from '../../assets/azure.svg?inline'
import {lookupCloudProviderAlias} from '../../../vue_shared/util.mjs'

const MAPPINGS = {
    [lookupCloudProviderAlias('gcp')]: GCP,
    [lookupCloudProviderAlias('aws')]: AWS,
    [lookupCloudProviderAlias('aws')]: Azure
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

            const icon = MAPPINGS[lookupCloudProviderAlias(this.cloud)]
            try {
                const url = new URL(icon)
                return icon
            } catch(e) {
                const blob = new Blob([icon], {type: 'image/svg+xml'})
                return URL.createObjectURL(blob)
            }
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
