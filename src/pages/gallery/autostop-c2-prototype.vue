<script>
/*
 * PROTOTYPE, gallery only -- option C2 for replacing autostop-inner's
 * el-date-picker: presets in a listbox, with "Custom" revealing a gl-datepicker.
 * Delete this once the approach is chosen.
 */
import {GlCollapsibleListbox, GlDatepicker, GlFormInput} from '@gitlab/ui'

const PRESETS = [
  {value: 'tomorrow', text: 'Tomorrow', days: 1},
  {value: 'week', text: 'In One Week', days: 7},
  {value: 'twoWeeks', text: 'In Two Weeks', days: 14},
  {value: 'month', text: 'In One Month', days: 30},
  {value: 'custom', text: 'Custom date...'},
]

export default {
  name: 'AutostopC2Prototype',
  components: {GlCollapsibleListbox, GlDatepicker, GlFormInput},
  props: {initialPreset: {type: String, default: 'week'}},
  data() {
    const d = new Date(Date.now() + 2 * 60 * 60 * 1000)
    return {
      preset: this.initialPreset,
      date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      time: `${('0' + d.getHours()).slice(-2)}:${('0' + d.getMinutes()).slice(-2)}`,
      PRESETS,
    }
  },
  computed: {
    toggleText() {
      return (PRESETS.find(p => p.value === this.preset) || PRESETS[0]).text
    },
    minDate: () => new Date(),
  },
}
</script>
<template>
  <div>
    <div class="ml-2 m-1">
      Automatically stop the deployment at a specified time:
    </div>
    <div class="gl-flex gl-items-center gl-gap-3 ml-2 gl-flex-wrap">
      <gl-collapsible-listbox v-model="preset" :items="PRESETS" :toggle-text="toggleText" />
      <gl-datepicker v-if="preset === 'custom'" v-model="date" :min-date="minDate" />
      <gl-form-input style="width: 130px;" type="time" v-model="time" />
    </div>
  </div>
</template>
