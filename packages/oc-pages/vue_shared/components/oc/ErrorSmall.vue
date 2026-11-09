<!-- taken from project_overview/templates for global use -->
<script lang="ts">
import {defineComponent} from 'vue'
import _ from 'lodash'
const CONDITION_DEBOUNCE_TIME = 500
const MESSAGE_DEBOUNCE_TIME = 500

export default defineComponent({
    props: {
        condition: {
            default() {return true}
        },
        message: {
            type: String,
            default: () => null
        }
    },
    data() {
        return { shouldDisplay: this.condition && (this.message || this.message === null) }
    },
    methods: {
        calculateShouldDisplay() {
            return this.condition && (this.message || this.message === null)
        }
    },
    created() {
        // per instance: debounced once at module level, one timer served every
        // ErrorSmall on the page, and only the last to change was updated
        const update = () => { this.shouldDisplay = this.calculateShouldDisplay() }
        this.conditionChanged = _.debounce(update, CONDITION_DEBOUNCE_TIME)
        this.messageChanged = _.debounce(update, MESSAGE_DEBOUNCE_TIME)
    },
    beforeUnmount() {
        this.conditionChanged.cancel()
        this.messageChanged.cancel()
    },
    watch: {
        condition() { this.conditionChanged() },
        message() { this.messageChanged() }
    }
})
</script>
<template>
    <small v-if="shouldDisplay" class="alert-input">
        <slot>
            <div v-if="message"> {{ __(message) }} </div>
        </slot>
    </small>
</template>
<style>
.alert-input {
    margin: 0.5em;
    display: block;
    color: #EC5941;
    font-weight: 700;
}
</style>
