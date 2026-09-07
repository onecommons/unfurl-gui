<script>
import {CONFIGURABLE_HIDDEN_OPTIONS, lookupKey, setLocalStorageKey, clearSettings} from '../../storage-keys'
import {GlButton, GlCard, GlIcon, GlModal} from '@gitlab/ui'
import ErrorSmall from './ErrorSmall.vue'
import {mapGetters} from 'vuex'
import ExperimentalSettingInput from './experimental-settings-indicator/experimental-settings-input.vue'

const enabled = !window.gon.unfurl_gui

export default {
    name: 'ExperimentalSettingIndicator',
    components: {GlButton, GlCard, GlIcon, GlModal, ErrorSmall, ExperimentalSettingInput},
    data() {
        return {
            yPos: '0px',
            xPos: '0px',
            CONFIGURABLE_HIDDEN_OPTIONS,
            changed: false,
            enabled
        }
    },
    methods: {
        computePosition() {
            const {y, height, x, width} = document.querySelector('[data-qa-selector="navbar"] .navbar-collapse.collapse').getBoundingClientRect()
            this.yPos = y + 'px'
            this.xPos = x + 'px'
        },
        downloadState() {
            const link = document.createElement('A')
            const location = window.location.pathname + window.location.search
            const state = this.$store.state
            const contents = JSON.stringify({location, state})
            const file = new Blob([contents], {type: 'application/json'})
            link.href = URL.createObjectURL(file)
            link.download = encodeURIComponent(location.slice(1)) + '.json'
            link.click()
            URL.revokeObjectURL(link.href)
        },
        uploadState() {
            const input = document.createElement('INPUT')
            input.setAttribute('type', 'file')
            input.setAttribute('accept', 'application/json')
            input.click() 
            input.addEventListener('change', () => {
                try {
                    input.files[0].text().then(text => {
                            const {location, state} = JSON.parse(text)
                            //location = '/' + decodeURIComponent(location)
                            const dest = new URL(window.location.href)
                            const [pathname, query] = location.split('?')
                            dest.pathname = pathname || ''
                            dest.search = query || ''
                            sessionStorage['unfurl-gui:state'] = JSON.stringify(state)
                            window.location.href = dest.toString()
                    })
                }
                catch(e) { console.error(e) }
            })
        },
        lookupKey,
        setLocalStorageKey,
        clearSettings,
    },
    computed: {
        ...mapGetters(['windowWidth']),
        modal: {
            get() {
                return this.$route.query.hasOwnProperty('dev-settings')
            },
            set(val) {
                if(!val && this.modal) {
                    const newQuery = {...this.$route.query}
                    delete newQuery['dev-settings']
                    this.$router.replace({...this.$route, query: newQuery})
                } else if(val && !this.modal) {
                    const newQuery = {...this.$route.query}
                    newQuery['dev-settings'] = null
                    this.$router.push({...this.$route, query: newQuery})
                }
            }
        },
        indicateExperimentalSetting() {
            return this.changed || this.CONFIGURABLE_HIDDEN_OPTIONS.some(o => !!lookupKey(o.key))
        }
    },
    watch: {
        windowWidth: {
            immediate: enabled,
            handler(_) {
                if(enabled) {
                    this.computePosition()
                }
            }
        }
    },
    mounted() {
        document.addEventListener('keyup', e => {
            if(e.ctrlKey &&
                e.shiftKey &&
                // keycode is deprecated, but it's not depended on here for latin keyboards
                (['?', '/'].includes(e.key) || e.keyCode == 191)
            ) this.modal = true
        })
    }
}
</script>
<template>
    <div v-if="enabled">
        <gl-modal
            title="Developer Settings"
            modal-id="dev-settings-modal"
            :action-primary="{text: 'OK', attributes: [{variant: 'info'}]}"
            :action-secondary="{text: 'Restore Default Settings', attributes: [{variant: 'danger'}]}"
            @secondary="clearSettings(); modal = false;"
            v-model="modal"
        >
            <gl-card data-testid="experimental-settings-card" class="settings-modal-body">

                <experimental-setting-input
                    v-for="option in CONFIGURABLE_HIDDEN_OPTIONS"
                    @changed="changed = true"
                    :key="option.key"
                    :option="option"
                />

                <error-small :condition="changed" message="Changes will be reflected after page refresh" />

                <div class="gl-flex gl-justify-end gl-mt-6">
                    <gl-button data-testid="experimental-download-state" @click="downloadState" category="tertiary" icon="download"> Download app state </gl-button>
                    <div class="border-right gl-mr-3 gl-ml-3" />
                    <gl-button data-testid="experimental-upload-state" @click="uploadState" category="tertiary" icon="upload"> Upload app state </gl-button>
                </div>

            </gl-card>
        </gl-modal>
        <div class="gl-fixed" style=" z-index: 1000; pointer-events: none;" :style="{left: xPos, top: yPos}">
            <div v-if="indicateExperimentalSetting" class="gl-inline-block gl-relative" style="transform: translateX(-100%); pointer-events: all">
                <!-- shameless sizes without calculations - this might get moved somewhere else so it fits better inline -->
                <gl-button @click="modal = true" variant="confirm" style="height: 32px; margin-top: 4px;">
                    <div class="gl-flex gl-items-center gl-justify-between" style="padding-top: 2px;">
                        <gl-icon :size="16" name="code" class="gl-mr-2"/>
                        <span style="font-size: 13px;">{{__('Developer settings enabled')}}</span>
                    </div>
                </gl-button>
            </div>
        </div>
    </div>
</template>
<style scoped>
.settings-modal-body >>> .input-group-prepend > .input-group-text {
    width: 100%;
}

.settings-modal-body >>> .input-group-prepend {
    /* 250px fit Element's prepend; bootstrap's input-group-text adds
       padding, and the longest label clips under it */
    width: 280px;
}
</style>
