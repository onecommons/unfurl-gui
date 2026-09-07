<script>
import {lookupKey, setLocalStorageKey} from '../../../storage-keys'
import {GlFormInput, GlFormInputGroup} from '@gitlab/ui'
import Vue from 'vue'
export default {
    name: 'ExperimentalSettingInput',
    components: {GlFormInput, GlFormInputGroup},
    props: {
        option: String
    },
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
            set(v) {
                this.inner = v
                setLocalStorageKey(this.option.key, v)
                this.$emit('changed')
            }
        }
    }
}
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
