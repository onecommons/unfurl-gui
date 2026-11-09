<!-- taken from project_overview/templates for global use -->
<script lang="ts">
import {defineComponent} from 'vue'
import _ from 'lodash'
import type {DebouncedFunc} from 'lodash'
const CONDITION_DEBOUNCE_TIME = 500
const MESSAGE_DEBOUNCE_TIME = 500

// set in created, outside the reactive state
interface DebouncedUpdates {
    conditionChanged: DebouncedFunc<() => void>
    messageChanged: DebouncedFunc<() => void>
}

export default defineComponent({
    props: {
        condition: {
            // typed by its default; without the annotation that is the literal `true`
            default(): boolean {return true}
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
        const update = () => { this.shouldDisplay = this.calculateShouldDisplay() };
        (this as unknown as DebouncedUpdates).conditionChanged = _.debounce(update, CONDITION_DEBOUNCE_TIME);
        (this as unknown as DebouncedUpdates).messageChanged = _.debounce(update, MESSAGE_DEBOUNCE_TIME)
    },
    beforeUnmount() {
        (this as unknown as DebouncedUpdates).conditionChanged.cancel();
        (this as unknown as DebouncedUpdates).messageChanged.cancel()
    },
    watch: {
        condition() { (this as unknown as DebouncedUpdates).conditionChanged() },
        message() { (this as unknown as DebouncedUpdates).messageChanged() }
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
