<script>
import AutostopInner from './autostop-inner.vue'
import { GlButton, GlPopover, GlTooltipDirective } from '@gitlab/ui'
import {mapMutations} from 'vuex'

export default {
    name: 'Autostop',
    directives: {
        GlTooltip: GlTooltipDirective,
    },
    components: {
        GlPopover,
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
    <div class="gl-inline-block">
        <gl-button
            id="autostop-trigger"
            data-testid="autostop-trigger"
            v-gl-tooltip.hover
            title="Automatically stop the deployment at a specified time"
            :variant="enabledAutostop? 'confirm': 'default'"
            @click="popover = !popover"
        >
            <i style="font-size: 16px;" class="el-icon-timer"></i>
            <span>
                {{enabledAutostop? 'Auto Stop Scheduled': 'Schedule Auto Stop'}}
            </span>
        </gl-button>
        <!-- gl-popover targets by id rather than wrapping its trigger, so the
             trigger moves out and the click is bound directly -->
        <gl-popover
            data-testid="autostop-popover"
            target="autostop-trigger"
            triggers="manual"
            :show="popover"
            placement="top"
        >
            <autostop-inner v-model="autostop"/>
            <div v-if="popover" class="mt-2 d-flex justify-content-end">
                <gl-button class="mr-2" @click="popover = false">Cancel</gl-button>
                <gl-button v-if="!enabledAutostop" :disabled="disabledSchedule" variant="confirm" @click="popover = false; enabledAutostop = true">Confirm</gl-button>
                <gl-button v-else @click="popover = false; enabledAutostop = false">Unschedule</gl-button>
            </div>
        </gl-popover>
    </div>
</template>
