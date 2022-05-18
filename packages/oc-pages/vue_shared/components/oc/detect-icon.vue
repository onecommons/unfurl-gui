<script>
import {mapGetters} from 'vuex'
import {GlIcon} from '@gitlab/ui'
import ComputeIcon from './icons/Compute.svg'
import DbIcon from './icons/Database.svg'
import GCP from './icons/gcp.svg'
import K8s from './icons/k8s.svg'
import Azure from './icons/azure.svg'
import AWS from './icons/aws.svg'
import LocalDevIcon from './icons/local_dev.svg'
import DnsIcon from './icons/DNS.svg'
import MailIcon from './icons/Mail_server.svg'
import GCPInstance from './icons/gcp_vm.svg'
import EC2Instance from './icons/ec2.svg'
import MongoDbIcon from './icons/mongodb.svg'
import ErrorFilled from './icons/error_filled.svg'

const DEFAULT = 'pod'

const GL_ICON_MAPPINGS = {
    dns: 'earth',
    mail: 'mail', email: 'mail',
}

const CUSTOM_ICON_MAPPINGS = {
    'unfurl.relationships.connectsto.googlecloudproject': 'GCP', 'google cloud platform': 'GCP',
    'unfurl.relationships.connectsto.k8scluster': 'K8s',
    'unfurl.relationships.connectsto.azure': 'Azure', 'azure': 'Azure',
    'unfurl.relationships.connectsto.awsaccount': 'AWS', 'amazon web services': 'AWS',
    gcpinstance: GCPInstance, 'unfurl.nodes.gcpcomputeinstance': GCPInstance,
    ec2compute: EC2Instance, 'unfurl.nodes.ec2compute': EC2Instance,
    dns: 'DnsIcon', 'unfurl.nodes.dnszone': 'DnsIcon', 'unfurl.capabilities.dnszone': 'DnsIcon',
    mail: 'MailIcon',
    mongodb: MongoDbIcon,
    compute: 'ComputeIcon', 'unfurl.nodes.compute': 'ComputeIcon',
    'self-hosted': 'LocalDevIcon', 'local dev': 'LocalDevIcon',
    'error-filled': 'ErrorFilled'

}

function applyTypeToMapping(type, mapping) {
    if(!type) return
    if(typeof type == 'string') {
        return mapping[type.toLowerCase()]
    }
    let result
    result = applyTypeToMapping(type?.name, mapping)
    if(result) return result
    
    if(Array.isArray(type.extends)) {
        for(const tn of type.extends) {
            result = applyTypeToMapping(tn, mapping)
            if(result) return result
        }
    }
}

function detectIcon(type, defaultIcon) {
    const result = applyTypeToMapping(type, GL_ICON_MAPPINGS)
    if(defaultIcon) {
        return result || defaultIcon
    }
    return result
}

function detectIconCustomSVG(type) {
    return applyTypeToMapping(type, CUSTOM_ICON_MAPPINGS)
}

export default {
    name: 'DetectIcon',
    components: { GlIcon },
    props: {
        type: {
            type: [Object, String]
        },
        env: {
            type: [Object, String]
        },
        name: {
            type: String,
            default: null
        },
        noDefault: Boolean
    },
    icons: {
        GCP, ComputeIcon, DbIcon, LocalDevIcon, K8s, Azure, AWS, DnsIcon, MailIcon, GCPInstance, MongoDbIcon, ErrorFilled
    },
    computed: {
        ...mapGetters(['lookupEnvironment']),
        _env() {
            if(!this.env) return
            let env
            if(typeof this.env == 'string') {
                env = this.lookupEnvironment(this.env)
            }
            else env = this.env
            return env?.primary_provider?.type || 'self-hosted'

        },
        detectedIcon() {
            return this.name || detectIcon(this.type || this._env, !this.noDefault && DEFAULT)
        },
        customIcon() {
            return this.type?.icon || detectIconCustomSVG(this.name || this.type || this._env)
        },
        customStyle() {
            if (this.$attrs.size) {
                return {
                    'font-size': this.$attrs.size + 'px'
                }
            } 
            return {
                'font-size': '16px'
            }
        },
        customURL() {
            if(this.type?.icon) return this.type?.icon
            const icon = this.$options.icons[this.customIcon] || this.customIcon
            if(!icon) return
            if(icon.startsWith('<svg')) {
                return `data:image/svg+xml;charset=utf8,${encodeURIComponent(icon)}`
            } else return icon
        }
    }
}
</script>
<template>
    <span class="custom-icon" :style="customStyle" v-if="customIcon">
        <img :src="customURL">
    </span>
    <gl-icon v-else-if="detectedIcon" :name="detectedIcon" v-bind="$attrs" v-on="$listeners" />
</template>
<style scoped>
.custom-icon {
    display: inline-block;
    width: 1em; height: 1em; position: relative;
}
.custom-icon > img{
    width: 1em;
    height: 1em;
    position: absolute;
}
</style>
