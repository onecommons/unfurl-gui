<script>
import {lookupKey, setLocalStorageKey} from '../../../storage-keys'
import {Input as ElInput} from 'element-ui'
import Vue from 'vue'
export default {
    name: 'ExperimentalSettingInput',
    components: {ElInput},
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
    <el-input
        v-model="value"
        :placeholder="option.placeholder"
        :type="option.type || 'text'"
    >
        <template slot="prepend"><span style="font-size: 12px;" class="text-monospace">{{option.label}}</span></template>
    </el-input>
</template>
