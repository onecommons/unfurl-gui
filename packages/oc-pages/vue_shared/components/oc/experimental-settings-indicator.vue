<script>
import {CONFIGURABLE_HIDDEN_OPTIONS, lookupKey, setLocalStorageKey, clearSettings} from '../../storage-keys'
import {GlButton, GlIcon, GlModal} from '@gitlab/ui'
import {Card as ElCard, Button as ElButton} from 'element-ui'
import ErrorSmall from './ErrorSmall.vue'
import {mapGetters} from 'vuex'
import ExperimentalSettingInput from './experimental-settings-indicator/experimental-settings-input.vue'

const enabled = !window.gon.unfurl_gui

export default {
    name: 'ExperimentalSettingIndicator',
    components: {GlButton, GlIcon, GlModal, ElCard, ElButton, ErrorSmall, ExperimentalSettingInput},
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
            <el-card class="settings-modal-body">

                <experimental-setting-input
                    v-for="option in CONFIGURABLE_HIDDEN_OPTIONS"
                    @changed="changed = true"
                    :key="option.key"
                    :option="option"
                />

                <error-small :condition="changed" message="Changes will be reflected after page refresh" />

                <div class="d-flex justify-content-end mt-4">
                    <el-button @click="downloadState" type="text" icon="el-icon-download"> Download app state </el-button>
                    <div class="border-right mr-2 ml-2" />
                    <el-button @click="uploadState" type="text" icon="el-icon-upload2"> Upload app state </el-button>
                </div>

            </el-card>
        </gl-modal>
        <div class="position-fixed" style=" z-index: 1000; pointer-events: none;" :style="{left: xPos, top: yPos}">
            <div v-if="indicateExperimentalSetting" class="d-inline-block position-relative" style="transform: translateX(-100%); pointer-events: all">
                <!-- shameless sizes without calculations - this might get moved somewhere else so it fits better inline -->
                <gl-button @click="modal = true" variant="confirm" style="height: 32px; margin-top: 4px;">
                    <div class="d-flex align-items-center justify-content-between" style="padding-top: 2px;">
                        <gl-icon :size="16" name="code" class="mr-1"/>
                        <span style="font-size: 13px;">{{__('Developer settings enabled')}}</span>
                    </div>
                </gl-button>
            </div>
        </div>
    </div>
</template>
<style scoped>
.settings-modal-body >>> .el-input-group__prepend {
    width: 250px;
}
</style>
