<script>
import {GlCollapsibleListbox, GlDatepicker, GlFormInput} from '@gitlab/ui'
import {mapMutations} from 'vuex'

export default {
    name: 'AutostopInner',
    components: {
        GlCollapsibleListbox,
        GlDatepicker,
        GlFormInput
    },
    // gl-datepicker has no shortcut concept, so the presets element-ui drew
    // inside the calendar become the listbox in front of it
    PRESETS: [
        {value: 'tomorrow', text: 'Tomorrow'},
        {value: 'inOneWeek', text: 'In One Week'},
        {value: 'inTwoWeeks', text: 'In Two Weeks'},
        {value: 'inOneMonth', text: 'In One Month'},
        {value: 'custom', text: 'Custom date...'}
    ],
    data() {
        const d = new Date(Date.now() + 2 * 60 * 60 * 1000)
        const scheduledAutostopTime = `${('0' + d.getHours()).slice(-2)}:${('0' + d.getMinutes()).slice(-2)}`
        return {
            scheduledAutostop: new Date(d.getYear() + 1900, d.getMonth(), d.getDate()),
            scheduledAutostopTime, // TODO remember the user's last choice
            // the default is today at now+2h, which no preset expresses
            preset: 'custom',
        }
    },

    methods: {
        ...mapMutations(['setAutostop']),
    },

    computed: {
        todayArgs() {
            const d = new Date()
            return [d.getYear() + 1900, d.getMonth(), d.getDate()]
        },

        // replaces the picker's disabledDate: no point stopping in the past
        today() {
            return new Date(...this.todayArgs)
        },

        presetText() {
            return this.$options.PRESETS.find(p => p.value == this.preset).text
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

        autostopTime() {
            if(!this.scheduledAutostopTime) return 0
            const [hours, min] =  this.scheduledAutostopTime.split(':')

            return (parseInt(hours) * 60 + parseInt(min)) * 60 * 1000
        },
        autostop() {
            const result = Math.floor((Date.parse(this.scheduledAutostop) + this.autostopTime - Date.now()) / 1000)
            if(result > 0) {
                return result
            }
            return null
        },
    },

    watch: {
        preset(value) {
            if(value != 'custom') this.scheduledAutostop = this[value]
        },

        autostop: {
            handler(val) {
                this.$emit('input', val)
            },
            immediate: true
        }
    },

}
</script>
<template>
    <div>
        <div class="gl-ml-3 gl-m-2">
            Automatically stop the deployment at a specified time:
        </div>
        <div class="gl-flex gl-items-center gl-flex-wrap gl-gap-3 gl-ml-3">
            <gl-collapsible-listbox
                data-testid="autostop-preset"
                v-model="preset"
                :items="$options.PRESETS"
                :toggle-text="presetText"
            />
            <gl-datepicker
                v-if="preset == 'custom'"
                data-testid="autostop-date"
                v-model="scheduledAutostop"
                :min-date="today"
            />
            <gl-form-input data-testid="autostop-time" style="width: 130px;" type="time" v-model="scheduledAutostopTime"/>
        </div>
    </div>
</template>
