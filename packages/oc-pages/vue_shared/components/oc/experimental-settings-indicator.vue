<script>
import {CONFIGURABLE_HIDDEN_OPTIONS, indicateExperimentalSetting, lookupKey, setLocalStorageKey, clearSettings} from '../../storage-keys'
import {GlButton, GlIcon, GlModal} from '@gitlab/ui'
import {Card as ElCard, Input as ElInput} from 'element-ui'
import ErrorSmall from './ErrorSmall.vue'
import {mapGetters} from 'vuex'
export default {
    name: 'ExperimentalSettingIndicator',
    components: {GlButton, GlIcon, GlModal, ElInput, ErrorSmall},
    data() {
        return {
            indicateExperimentalSetting: indicateExperimentalSetting(),
            yPos: '0px',
            xPos: '0px',
            CONFIGURABLE_HIDDEN_OPTIONS,
            valuesByKey: CONFIGURABLE_HIDDEN_OPTIONS.reduce((acc, option) => {acc[option.key] = lookupKey(option.key); return acc}, {}),
            changed: false
        }
    },
    methods: {
        computePosition() {
            const {y, height, x, width} = document.querySelector('[data-qa-selector="navbar"] .navbar-collapse.collapse').getBoundingClientRect()
            this.yPos = y + 'px'
            this.xPos = x + 'px'
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
                this.valuesByKey = CONFIGURABLE_HIDDEN_OPTIONS.reduce((acc, option) => {acc[option.key] = lookupKey(option.key); return acc}, {})
            }
        },
    },
    watch: {
        windowWidth: {
            immediate: true,
            handler(_) {
                this.computePosition()
            }
        }
    },
    mounted() {
        document.addEventListener('keyup', e => {
            if(e.ctrlKey && e.key == '?') this.modal = true
        })
    }
}
</script>
<template>
    <div>
        <gl-modal
            title="Developer Settings"
            modal-id="dev-settings-modal"
            :action-primary="{text: 'OK', attributes: [{variant: 'info'}]}"
            :action-secondary="{text: 'Restore Default Settings', attributes: [{variant: 'danger'}]}"
            @secondary="clearSettings(); modal = false; indicateExperimentalSetting = false;"
            v-model="modal"
        >
            <el-card class="settings-modal-body">
                <el-input
                    @input="v => {setLocalStorageKey(option.key, v); valuesByKey[option.key] = v; changed = true}"
                    v-for="option in CONFIGURABLE_HIDDEN_OPTIONS"
                    :key="option.key"
                    :value="valuesByKey[option.key]"
                    :placeholder="option.placeholder"
                    :type="option.type || 'text'"
                >
                    <template slot="prepend"><span style="font-size: 12px;" class="text-monospace">{{option.label}}</span></template>
                </el-input>
                <error-small :condition="changed" message="Changes will be reflected after page refresh" />
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
