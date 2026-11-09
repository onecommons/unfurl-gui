<script lang="ts">
import {defineComponent} from 'vue'
import type {PropType} from 'vue'
import type {CONFIGURABLE_HIDDEN_OPTIONS} from '../../../storage-keys'
import {lookupKey, setLocalStorageKey} from '../../../storage-keys'
import {GlFormInput, GlFormInputGroup} from '@gitlab/ui'
export default defineComponent({
    name: 'ExperimentalSettingInput',
    components: {GlFormInput, GlFormInputGroup},
    props: {
        // `type` is an input type; no option sets one yet
        option: {type: Object as PropType<typeof CONFIGURABLE_HIDDEN_OPTIONS[number] & {type?: string}>, required: true}
    },
    emits: ['changed'],
    data() {
        return {
            inner: lookupKey(this.option.key)
        }
    },
    computed: {
        value: {
            get() {
                return this.inner
            },
            set(v: string | undefined) {
                this.inner = v
                setLocalStorageKey(this.option.key, v)
                this.$emit('changed')
            }
        }
    }
})
</script>
<template>
    <!-- gl-form-input has no prepend slot; the group provides it -->
    <gl-form-input-group>
        <template #prepend>
            <span style="font-size: 12px;" class="input-group-text text-monospace">{{option.label}}</span>
        </template>
        <gl-form-input
            v-model="value"
            :placeholder="option.placeholder"
            :type="option.type || 'text'"
        />
    </gl-form-input-group>
</template>
