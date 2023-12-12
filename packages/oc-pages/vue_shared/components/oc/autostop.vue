<script>
import AutostopInner from './autostop-inner.vue'
import {
    Tooltip as ElTooltip,
    Popover as ElPopover,
} from 'element-ui'
import { GlButton } from '@gitlab/ui'
import {mapMutations} from 'vuex'

export default {
    name: 'Autostop',
    components: {
        ElPopover, ElTooltip,
        GlButton,
        AutostopInner,
    },
    data() {
        return {
            enabledAutostop: false,
            popover: false,
            autostop: null,
        }
    },

    computed: {
        disabledSchedule() {
            return !this.autostop || this.autostop <= 0
        }
    },

    methods: {
        ...mapMutations(['setAutostop']),
        updateAutostop() {
            if(this.enabledAutostop) {
                this.setAutostop(this.autostop)
            } else {
                this.setAutostop(null)
            }
        }
    },


    watch: {
        autostop() {
            this.updateAutostop()
        },
        enabledAutostop() {
            this.updateAutostop()
        }
    },
}
</script>
<template>
    <el-popover v-model="popover" trigger="click">
        <autostop-inner v-model="autostop"/>
        <div v-if="popover" class="mt-2 d-flex justify-content-end">
            <gl-button class="mr-2" @click="popover = false">Cancel</gl-button>
            <gl-button v-if="!enabledAutostop" :disabled="disabledSchedule" variant="confirm" @click="popover = false; enabledAutostop = true">Confirm</gl-button>
            <gl-button v-else @click="popover = false; enabledAutostop = false">Unschedule</gl-button>
        </div>

        <template #reference>
            <el-tooltip>
                <template #content>
                    <div> Automatically stop the deployment at a specified time </div>
                </template>

            <gl-button :variant="enabledAutostop? 'confirm': 'default'">
                <i style="font-size: 16px;" class="el-icon-timer"></i>
                <span>
                    {{enabledAutostop? 'Auto Stop Scheduled': 'Schedule Auto Stop'}}
                </span>
            </gl-button>

            </el-tooltip>

        </template>

    </el-popover>
</template>
