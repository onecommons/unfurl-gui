<script>
import {GlFormInput, GlIcon} from '@gitlab/ui'

export default {
    name: 'FakePassword',
    // formily's props used to fall through to el-input, which was a component
    // and honoured them; the wrapper below is a plain div, so they are bound
    // to the control explicitly instead
    inheritAttrs: false,
    components: {
        GlFormInput, GlIcon
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
    <!-- gl-form-input has no suffix slot, so the toggle is laid over the field
         rather than sitting inside it as element's suffix did -->
    <div class="fake-password" :class="{hidingPassword}">
        <gl-form-input v-bind="$attrs" :value="value" @input="input" type="text"/>
        <button
            type="button"
            class="fake-password-toggle"
            :aria-label="hidingPassword? 'Show': 'Hide'"
            @click="hidingPassword = !hidingPassword"
        >
            <gl-icon :name="hidingPassword? 'eye': 'eye-slash'" :size="16"/>
        </button>
    </div>
</template>
<style>

    /*
     * Masked in CSS rather than by type="password", so nothing offers to save
     * it and the value in the DOM stays untouched for the generate directive.
     * The old rule named a font-family called Password that is defined
     * nowhere; the masking really came from formily's type prop falling
     * through to el-input, which also left the reveal toggle doing nothing.
     * -webkit-text-security predates browserslist's Firefox floor -- see the
     * note there.
     */
    .hidingPassword input {
        letter-spacing: 0.5px;
        -webkit-text-security: disc;
        text-security: disc;
    }

    .fake-password {
        position: relative;
    }

    /*
     * Sized to the icon rather than stretched to the field's height. It used to
     * be top:0/bottom:0, so its focus ring drew a full-height box inside the
     * input's own border -- a box within a box. The ring should outline what
     * looks clickable.
     */
    .fake-password > .fake-password-toggle {
        position: absolute;
        top: 50%;
        right: 8px;
        transform: translateY(-50%);
        display: flex;
        align-items: center;
        justify-content: center;
        width: 24px;
        height: 24px;
        padding: 0;
        border: 0;
        border-radius: 4px;
        background: none;
        color: inherit;
        cursor: pointer;
    }

    .fake-password input {
        padding-right: 30px;
    }
</style>
