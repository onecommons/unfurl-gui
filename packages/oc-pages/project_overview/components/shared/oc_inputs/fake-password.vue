<script>
import {Input as ElInput} from 'element-ui'

export default {
    name: 'FakePassword',
    components: {
        ElInput
    },
    props: {
        value: String
    },
    data() {
        return {
            hidingPassword: true,
        }
    },
    methods: {
        input() {
            this.$emit('input', ...arguments)
        }
    }
}
</script>
<template>
    <el-input
        ref="input-el"
        :value="value"
        @input="input"
        :class="{hidingPassword}"
        type="text"
    >
        <template #suffix>
            <i @click="hidingPassword = !hidingPassword" class="el-input__icon el-icon-view el-input__clear" />
        </template>
    </el-input>
</template>
<style>
    @font-face {
        font-family: 'Password';
        font-style: normal;
        font-weight: 400;
        src: url(/oc/assets/fonts/Bullets.woff2) format('woff2');
    }

    .hidingPassword input {
        letter-spacing: 0.5px;
        padding-top: 4px;
        font-family: Password;
    }
</style>
