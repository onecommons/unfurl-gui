<script>
import {mapGetters, mapActions} from 'vuex'
import {sleep} from 'oc_vue_shared/client_utils/misc'
import {Card as ElCard, Input as ElInput, Button as ElButton, Tooltip as ElTooltip, Tag as ElTag} from 'element-ui'
import axios from '~/lib/utils/axios_utils'
import { XhrIFrame } from 'oc_vue_shared/client_utils/crossorigin-xhr'
import CodeClipboard from 'oc_vue_shared/components/oc/code-clipboard.vue'
import ErrorSmall from 'oc_vue_shared/components/oc/ErrorSmall.vue'
import {hasUpdates} from './mixins'
import _ from 'lodash'

const COMPLETE = 'COMPLETE', VERIFIED = 'COMPLETE'
const UNVERIFIED = 'UNVERIFIED'
const VERIFYING = 'VERIFYING'
const ERROR = 'ERROR'

export default {
    name: 'UnfurlCNamedDNSZone',
    props: {
        card: Object
    },
    mixins: [hasUpdates],
    data() {
        const data =  {
            target_subdomain:  Math.floor(Math.random() * Number.MAX_SAFE_INTEGER).toString(36),
            name: '',
            verifiedStatus: UNVERIFIED,
            saved: {},
            COMPLETE,
            UNVERIFIED,
            VERIFYING,
            ERROR,
            nameserversResolved: []
        }

        for(const {name, value} of this.card.properties) {
            if(data.hasOwnProperty(name) && value) {
                data[name] = value
            } else {
                data.saved[name] = value
            }
        }

        return data
    },
    components: {
        ElCard, ElInput, ElButton, ElTooltip, ElTag,
        CodeClipboard,
        ErrorSmall
    },
    watch: {
        target_subdomain: {
            immediate: true,
            handler(val) { this.updateValue('target_subdomain') }
        },
        name() {
            this.updateValue('name')
        },

        subdomain() {
            this.updateValue()
        },
        verifiedStatus() {
            this.nameserversResolved = []
        }
    },
    methods: {
        ...mapActions(['updateProperty', 'updateCardInputValidStatus']),
        async checkCName() {
            this.verifiedStatus = VERIFYING
            const sleepAndRecurse = async () => {
                await sleep(5000)
                this.checkCName()
            }
            let response
            try {
                response = await axios.get(`/services/project-dns/cname_verification/${this.host}?target=${this.target}&auth_project=${encodeURIComponent(this.getHomeProjectPath)}`)
                const {nameserver_results, target_reachable} = response.data || {}

                if(nameserver_results) {
                    this.nameserversResolved = Object.entries(nameserver_results).filter(([_, value]) => value).map(([key]) => key)
                }

                // no assumptions about the number of nameservers we check
                const nameserversReady = nameserver_results && Object.values(nameserver_results).indexOf(false) == -1

                if(!(nameserversReady && target_reachable)) {
                    sleepAndRecurse()
                } else {
                    this.verifiedStatus = COMPLETE
                }
                return
            } catch(e) {
                console.error(e)
                this.verifiedStatus = ERROR
                return
            }
        },

        getStatus() {
            return (
                this.target_subdomain &&
                this.validUserDomain
            ) ? 'valid': 'missing'
        }
    },
    computed: {
        ...mapGetters(['lookupEnvironmentVariable', 'getDependent', 'getHomeProjectPath']),
        subdomain() {
            let parentDependency = this.card
            do {
                if(parentDependency.properties.find(prop => prop.name == 'subdomain')) break
            } while (parentDependency = this.getDependent(parentDependency?.name))
            
            return parentDependency.properties.find(prop => prop.name == 'subdomain')?.value
        },
        target() {
            return `${this.target_subdomain}.${this.lookupEnvironmentVariable('PROJECT_DNS_ZONE')}`
        },
        host() {
            return `${this.subdomain}.${this.name}`
        },
        validUserDomain() {
            return this.name?.match(/\..{3}/) && this.subdomain
        },
        descAttrs() {
            if(!this.validUserDomain) {
                return {class: 'transparent'}
            }
            return {}
        }
    },
    mounted() {
        this.updateValue()
    }
}
</script>
<template>
    <el-card>
        <ol>
            <error-small class="m-0" :condition="!subdomain">A subdomain is required to use a CNAME.</error-small>
            <li>Enter the domain you would like to use below:</li>
            <el-input v-model="name" class="mb-2">
                <template #prepend>Domain</template>
            </el-input>
            <li v-bind="descAttrs">Visit your DNS provider or registrar's site to create a CNAME record for this service. This functionality will usually be available under "Advanced DNS".
            <ul>
                <li>
                    Enter the subdomain for this service in the 
                    <el-tooltip>
                        <template #content>
                            <div style="max-width: 300px;">
                                This is the left side of the CNAME record, also referred to as the "name", "host", or "alias".
                            </div>
                        </template>
                        <u>host</u>
                    </el-tooltip>
                    field:
                    <b v-if="subdomain" class="user-select-all"><code-clipboard>{{subdomain}}</code-clipboard></b>
                </li>
                <li>
                    Enter into the 
                    <el-tooltip>
                        <template #content>
                            <div style="max-width: 300px;">
                                This is the right side of the CNAME record.  Somewhat counter-intuitively, this will be the Canonical Name (CNAME) for this service, though you will not need to expose it to your users.  It may also be called the "value" or "target" by your DNS provider.
                            </div>
                        </template>
                        <u>target</u></el-tooltip>
                    field:
                    <b class="user-select-all">
                        <code-clipboard>{{target}}</code-clipboard>
                    </b>
                </li>
            </ul>
            <p> We highly recommend completing this step before deploying. </p>
            </li>
            <li v-bind="descAttrs">
                    <div>
                        (Optional) Verify your CNAME record <br>
                        <div class="d-flex">
                            <el-button :type="verifiedStatus == ERROR? 'danger': 'primary'" :loading="verifiedStatus == VERIFYING" @click="checkCName">
                                <span v-if="verifiedStatus == VERIFYING">Verifying CNAME</span>
                                <span v-else-if="verifiedStatus == COMPLETE">CNAME was verified successfully</span>
                                <span v-else-if="verifiedStatus == ERROR">Couldn't connect to DNS service</span>
                                <span v-else>Verify CNAME</span>
                            </el-button>
                            <div class="d-flex align-items-center ml-3">
                                <el-tag v-for="resolved in nameserversResolved" type="success" class="mr-2" effect="dark" :key="resolved"><i class="el-icon-success mr-1"/>{{resolved}}</el-tag>
                            </div>
                        </div>
                </div>
            </li>
        </ol>
    </el-card>
</template>
<style scoped>
.transparent {
    opacity: 0.5;
    pointer-events: none;
}
ol > li:nth-child(n+1) {
    margin-top: 1em;
}
</style>
