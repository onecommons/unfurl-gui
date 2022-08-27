<!-- taken from project_overview/templates for global use -->
<script>
import _ from 'lodash'
const CONDITION_DEBOUNCE_TIME = 500
const MESSAGE_DEBOUNCE_TIME = 500

export default {
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
        return { shouldDisplay: this.condition && this.message }
    },
    methods: {
        calculateShouldDisplay() {
            return this.condition && (this.message || this.message === null)
        }
    },
    watch: {
        condition: _.debounce(function() {this.shouldDisplay = this.calculateShouldDisplay()}, CONDITION_DEBOUNCE_TIME),
        message: _.debounce(function() {this.shouldDisplay = this.calculateShouldDisplay()}, MESSAGE_DEBOUNCE_TIME)
    }
}
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
