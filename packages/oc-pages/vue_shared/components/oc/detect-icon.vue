<script lang="ts">
import {defineComponent} from 'vue'
import type {PropType} from 'vue'
import {mapGetters} from 'vuex'
import {GlIcon} from '@gitlab/ui'
import ComputeIcon from './icons/Compute.svg'
import DbIcon from './icons/Database.svg'
import GCP from './icons/gcp.svg'
import K8s from './icons/k8s.svg'
import Azure from './icons/azure.svg'
import AWS from './icons/aws.svg'
import DigitalOcean from './icons/digital_ocean.svg'
import LocalDevIcon from './icons/local_dev.svg'
import DnsIcon from './icons/DNS.svg'
import MailIcon from './icons/Mail_server.svg'
import GCPInstance from './icons/gcp_vm.svg'
import EC2Instance from './icons/ec2.svg'
import MongoDbIcon from './icons/mongodb.svg'
import ErrorFilled from './icons/error_filled.svg'
import DatabaseIcon from './icons/Database.svg'
import Protected from './icons/protected.svg'
import Failed from './icons/failed.svg'
import Absent from './icons/absent.svg'
import Expire from './icons/expire.svg'

const DEFAULT = 'pod'

// a type name, or a resource type: its own name, what it extends, maybe its own icon
type IconType = string | {_localName?: string, extends?: unknown, icon?: string, [key: string]: unknown}

const GL_ICON_MAPPINGS: Record<string, string> = {
}

// get rid of prop validation error for size: 18px, etc.
delete GlIcon.props.size.validator

const CUSTOM_ICON_MAPPINGS: Record<string, string> = {
    'unfurl.relationships.connectsto.googlecloudproject': 'GCP', 'google cloud platform': 'GCP',
    'unfurl.relationships.connectsto.k8scluster': 'K8s', 'kubernetes': 'K8s',
    'unfurl.relationships.connectsto.azureaccount': 'Azure', 'unfurl.relationships.connectsto.azure': 'Azure', 'connectsto.azureenvironment': 'Azure', 'azure': 'Azure',
    'unfurl.relationships.connectsto.awsaccount': 'AWS', 'amazon web services': 'AWS',
    'unfurl.relationships.connectsto.digitalocean': 'DigitalOcean', 'digital ocean': 'DigitalOcean',
    'connectsto.digitaloceanenvironment': 'DigitalOcean',
    gcpinstance: GCPInstance, 'unfurl.nodes.gcpcomputeinstance': GCPInstance,
    ec2compute: EC2Instance, 'unfurl.nodes.ec2compute': EC2Instance,
    dns: 'DnsIcon', 'unfurl.nodes.dnszone': 'DnsIcon', 'unfurl.capabilities.dnszone': 'DnsIcon',
    db: 'DatabaseIcon', sqldb: 'DatabaseIcon',
    mail: 'MailIcon', email: 'MailIcon', smtpserver: 'MailIcon',
    mongodb: MongoDbIcon,
    compute: 'ComputeIcon', 'unfurl.nodes.compute': 'ComputeIcon',
    'self-hosted': 'LocalDevIcon', 'local dev': 'LocalDevIcon', 'generic': 'LocalDevIcon',
    'error-filled': 'ErrorFilled',
    'protected': Protected, 'failed': Failed, 'absent': Absent,
    expire: Expire,
}

const NO_FILTER = ['GCP']

function applyTypeToMapping(type: IconType | null | undefined, mapping: Record<string, string>): string | undefined {
    if(!type) return
    if(typeof type == 'string') {
        return mapping[type.toLowerCase().split('@')[0]]
    }
    let result
    result = applyTypeToMapping(type?._localName, mapping)
    if(result) return result

    if(Array.isArray(type.extends)) {
        for(const tn of type.extends) {
            result = applyTypeToMapping(tn, mapping)
            if(result) return result
        }
    }
}

function detectIcon(type: IconType | null | undefined, defaultIcon: string | false) {
    const result = applyTypeToMapping(type, GL_ICON_MAPPINGS)
    if(defaultIcon) {
        return result || defaultIcon
    }
    return result
}

function detectIconCustomSVG(type: IconType | null | undefined) {
    return applyTypeToMapping(type, CUSTOM_ICON_MAPPINGS)
}

export default defineComponent({
    name: 'DetectIcon',
    components: { GlIcon },
    // two possible roots, so nothing falls through on its own; the gl-icon
    // branch binds $attrs itself (which in Vue 3 carries the listeners too)
    inheritAttrs: false,
    props: {
        type: {
            type: [Object, String] as PropType<IconType>
        },
        env: {
            type: [Object, String] as PropType<string | Record<string, any>>
        },
        name: {
            type: String,
            default: null
        },
        size: [String, Number],
        circle: Boolean,
        noDefault: Boolean,
        noInvert: {
            type: Boolean,
            default: null
        }
    },
    icons: {
        GCP, ComputeIcon, DbIcon, LocalDevIcon, K8s, DigitalOcean, Azure, AWS, DnsIcon, MailIcon, GCPInstance, MongoDbIcon, ErrorFilled, DatabaseIcon,
        Protected, Failed, Absent,
        Expire,
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
            return env?.primary_provider?._localTypeName || 'self-hosted'

        },
        detectedIcon() {
            return this.name || detectIcon(this.type || this._env, !this.noDefault && DEFAULT)
        },
        // a resource type's own icon, when it has one
        ownIcon(): string | undefined {
            return typeof this.type == 'object'? this.type.icon: undefined
        },
        customIcon() {
            return this.ownIcon || detectIconCustomSVG(this.name || this.type || this._env)
        },
        customImageStyle() {
            const result: Record<string, string> = {}
            if(this._noInvert || (this.customIcon && NO_FILTER.includes(this.customIcon))) {
                result['filter'] = 'unset'
            }

            if(this.circle) {
                result['border-radius'] = '50%'
            }

            return result

        },
        customStyle() {
            const result = {'font-size': '16px', overflow: 'hidden'}
            if (this.size) {
                result['font-size'] =  this.size + 'px'
            }

            return result
        },
        customURL() {
            if(this.ownIcon) return this.ownIcon
            if(!this.customIcon) return
            const icon = this.$options.icons[this.customIcon] || this.customIcon
            if(!icon) return
            if(icon.startsWith('<svg')) {
                return `data:image/svg+xml;charset=utf8,${encodeURIComponent(icon)}`
            } else return icon
        },
        _noInvert() {
            const ancestors = typeof this.type == 'object' && Array.isArray(this.type.extends)? this.type.extends as string[]: undefined
            return this.noInvert ?? ancestors?.find(t => t.startsWith('unfurl.nodes.App@') || t.startsWith('App@'))
        }
    }
})
</script>
<template>
    <span class="custom-icon" :style="customStyle" v-if="customIcon">
        <img :style="customImageStyle" :src="customURL">
    </span>
    <gl-icon v-else-if="detectedIcon" :name="detectedIcon" v-bind="$attrs" />
</template>
<style scoped>
.custom-icon {
    display: inline-flex;
    width: 1em; height: 1em; position: relative;
}
.custom-icon > img {
    width: 1em;
    height: 1em;
    /*position: absolute;*/
}

.gl-dark .custom-icon > img:not([src$="no-invert"]) {
    filter: invert(1) hue-rotate(180deg);
}
</style>
