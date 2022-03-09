<script>
import AWS from '../../assets/aws.svg?inline'
import GCP from '../../assets/gcp.svg?inline'
import Azure from '../../assets/azure.svg?inline'
import SmallAWS from '../../assets/aws-small.svg?inline'
import SmallGCP from '../../assets/gcp-small.svg?inline'
import SmallAzure from '../../assets/azure-small.svg?inline'

import {lookupCloudProviderAlias} from '../../../vue_shared/util.mjs'

const MAPPINGS = {
    [lookupCloudProviderAlias('gcp')]: GCP,
    [lookupCloudProviderAlias('aws')]: AWS,
    [lookupCloudProviderAlias('azure')]: Azure
}

const SMALL_MAPPINGS = {
    [lookupCloudProviderAlias('gcp')]: SmallGCP,
    [lookupCloudProviderAlias('aws')]: SmallAWS,
    [lookupCloudProviderAlias('azure')]: SmallAzure
}
export default {
    name: "LogosCloud",
    props: {
        cloud: {
            type: String,
            default: ""
        },
        small: {
            type: Boolean,
            default: false
        }
    },
    computed: {
        icon() {

            const icon = this.small? 
                SMALL_MAPPINGS[lookupCloudProviderAlias(this.cloud)]:
                MAPPINGS[lookupCloudProviderAlias(this.cloud)]
            if(!icon) return ''
            if(icon.startsWith('<svg')) {
                return `data:image/svg+xml;charset=utf8,${encodeURIComponent(icon)}`
            }
            try {
                try {
                    const url = new URL(icon)
                } catch(e) {}
                const url = new URL(window.location.origin + icon)
                // still not checking relative url
                return icon
            } catch(e) {
                return
            }
        }
        
    }
}
</script>
<template>
    <div :class="{small: small}" > <img v-if="icon" :src="icon" /> </div>
</template>
<style scoped>
img {width: 100%; height: 100%; }
div {width: 100px; height: 25px; }
div.small {width: 2.7em; height: 1.8em;}
</style>
