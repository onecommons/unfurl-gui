<script>
import {
    Card as ElCard,
    DatePicker as ElDatePicker,
    TimeSelect as ElTimeSelect,
    Tooltip as ElTooltip,
    Popover as ElPopover,
    Input as ElInput,
} from 'element-ui'
import { GlButton, GlFormCheckbox } from '@gitlab/ui'
import {mapMutations} from 'vuex'

export default {
    name: 'Autostop',
    components: {
        ElCard, ElDatePicker, ElTimeSelect, ElInput, ElPopover, ElTooltip,
        GlFormCheckbox, GlButton,
    },
    data() {
        const d = new Date(Date.now() + 2 * 60 * 60 * 1000)
        const scheduledAutostopTime = `${('0' + d.getHours()).slice(-2)}:${('0' + d.getMinutes()).slice(-2)}`
        return {
            scheduledAutostop: new Date(d.getYear() + 1900, d.getMonth(), d.getDate()),
            scheduledAutostopTime, // TODO remember the user's last choice
            enabledAutostop: false,
            popover: false,
        }
    },

    methods: {
        ...mapMutations(['setAutostop']),
        disabledDate(d) {
            return d < Date.now() - 60 * 60 * 24 * 1000
        },
    },

    computed: {
        todayArgs() {
            const d = new Date()
            return [d.getYear() + 1900, d.getMonth(), d.getDate()]
        },

        tomorrow() {
            return new Date(+new Date(...this.todayArgs) + 24 * 60 * 60 * 1000)
        },

        inOneWeek() {
            return new Date(+new Date(...this.todayArgs) + 7 * (24 * 60 * 60 * 1000))
        },

        inTwoWeeks() {
            return new Date(+new Date(...this.todayArgs) + 14 * (24 * 60 * 60 * 1000))
        },

        inOneMonth() {
            return new Date(this.todayArgs[0], this.todayArgs[1] + 1, this.todayArgs[2])
        },

        shortcuts() {
            return [
                ['Tomorrow', this.tomorrow],
                ['In One Week', this.inOneWeek],
                ['In Two Weeks', this.inTwoWeeks],
                ['In One Month', this.inOneMonth],
            ].map(([text, value]) => {
                return {
                    text,
                    onClick: (picker) => picker.$emit('pick', value)
                }
            })
        },

        autostopTime() {
            if(!(this.enabledAutostop && this.scheduledAutostopTime)) return 0
            const [hours, min] =  this.scheduledAutostopTime.split(':')

            return (parseInt(hours) * 60 + parseInt(min)) * 60 * 1000
        },
        autostop() {
            const result = Math.floor((Date.parse(this.scheduledAutostop) + this.autostopTime - Date.now()) / 1000)
            if(result > 0) {
                return result
            }
        },

        pickerOptions() {
            return {
                shortcuts: this.shortcuts,
                disabledDate: this.disabledDate
            }
        }
    },

    watch: {
        autostop: {
            handler(val) {
                this.setAutostop(val)
            },
            immediate: true
        }
    },

    pickerOptions: {
        disabledDate(d) {
            return d < Date.now() - 60 * 60 * 24 * 1000
        },
    }
}
</script>
<template>
    <el-popover v-model="popover" trigger="click">
        <div class="ml-2 m-1">
            Automatically stop the deployment at a specified time:
        </div>
        <div>
            <el-date-picker class="ml-2" type="date" v-model="scheduledAutostop" :picker-options="pickerOptions"/>
            <el-input style="width: 220px;" type="time" v-model="scheduledAutostopTime" clearable/>
        </div>


        <div v-if="popover" class="mt-2 d-flex justify-content-end">
            <gl-button class="mr-2" @click="popover = false">Cancel</gl-button>
            <gl-button v-if="!enabledAutostop" variant="confirm" @click="popover = false; enabledAutostop = true">Confirm</gl-button>
            <gl-button v-else @click="popover = false; enabledAutostop = false">Unschedule</gl-button>
        </div>



        <template #reference>
            <el-tooltip>
                <template #content>
                    <div> Automatically stop the deployment at a specified time </div>
                </template>

            <gl-button :variant="enabledAutostop? 'confirm': 'default'">
                <i class="el-icon-timer"></i>
                <span>
                    {{enabledAutostop? 'Auto Stop Scheduled': 'Schedule Auto Stop'}}
                </span>
            </gl-button>

            </el-tooltip>
        </template>

    </el-popover>
</template>
