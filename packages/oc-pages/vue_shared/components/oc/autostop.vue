<script>
import {
    Card as ElCard,
    DatePicker as ElDatePicker,
    TimeSelect as ElTimeSelect,
    Input as ElInput,
} from 'element-ui'
import { GlFormCheckbox } from '@gitlab/ui'
import {mapMutations} from 'vuex'

export default {
    name: 'Autostop',
    components: {
        ElCard, ElDatePicker, ElTimeSelect, ElInput, GlFormCheckbox
    },
    data() {
        const d = new Date(Date.now() + 2 * 60 * 60 * 1000)
        const scheduledAutostopTime = `${('0' + d.getHours()).slice(-2)}:${('0' + d.getMinutes()).slice(-2)}`
        console.log({scheduledAutostopTime})
        return {
            scheduledAutostop: new Date(d.getYear() + 1900, d.getMonth(), d.getDate()),
            scheduledAutostopTime, // TODO remember the user's last choice
            enabledAutostop: false,
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
                console.log({val})
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
    <el-card class="gl-mt-6 autostop">
            <gl-form-checkbox v-model="enabledAutostop">
                Automatically stop the deployment at a specified time:
            </gl-form-checkbox>
            <div v-if="enabledAutostop">
                <el-date-picker class="ml-2" type="date" v-model="scheduledAutostop" :picker-options="pickerOptions"/>
                <!-- <el-time-select class="ml-2" v-model="scheduledAutostopTime" :picker-options="$options.timePickerOptions"/> -->
                <el-input style="width: 220px;" type="time" v-model="scheduledAutostopTime" clearable/>
            </div>
    </el-card>
</template>
<style scoped>
.autostop >>> .gl-form-checkbox.custom-control .custom-control-input:checked ~ .custom-control-label::before,
.autostop >>> .gl-form-radio.custom-control .custom-control-input:checked ~ .custom-control-label::before {
    background-color: #00D2D9 !important;
}

</style>
