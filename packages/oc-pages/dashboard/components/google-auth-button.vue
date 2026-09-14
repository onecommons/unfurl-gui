<script>
import LightNormal from '../assets/gcp-sign-in/btn_google_signin_light_normal_web@2x.png'
import LightFocus from '../assets/gcp-sign-in/btn_google_signin_light_focus_web@2x.png'
import LightPressed from '../assets/gcp-sign-in/btn_google_signin_light_pressed_web@2x.png'
import DarkNormal from '../assets/gcp-sign-in/btn_google_signin_dark_normal_web@2x.png'
import DarkFocus from '../assets/gcp-sign-in/btn_google_signin_dark_focus_web@2x.png'
import DarkPressed from '../assets/gcp-sign-in/btn_google_signin_dark_pressed_web@2x.png'

// Google's sign-in button is an image set with prescribed states, so the theme
// and interaction states are a background-image swap rather than a style.
export default {
    name: 'GoogleAuthButton',
    compatConfig: {MODE: 3},
    emits: ['click'],
    data() {
        return {pressed: false}
    },
    computed: {
        cssVars() {
            return {
                '--google-signin-light-normal': `url(${LightNormal})`,
                '--google-signin-light-focus': `url(${LightFocus})`,
                '--google-signin-light-pressed': `url(${LightPressed})`,
                '--google-signin-dark-normal': `url(${DarkNormal})`,
                '--google-signin-dark-focus': `url(${DarkFocus})`,
                '--google-signin-dark-pressed': `url(${DarkPressed})`,
            }
        },
    },
    methods: {
        onClick() {
            this.pressed = true
            this.$emit('click')
        },
    },
}
</script>
<template>
    <button
        type="button"
        class="google-auth-button"
        data-testid="gcp-sign-in-with-google"
        :class="{pressed}"
        :style="cssVars"
        :aria-label="__('Sign in with Google')"
        @click="onClick"
        @blur="pressed = false"
    />
</template>
<style scoped>
.google-auth-button {
    font-size: 1.5rem;
    height: 2.02em;
    min-width: 8.36em;
    width: 8.36em;
    border: 0;
    padding: 0;
    background-color: transparent;
    background-repeat: no-repeat;
    background-position: center;
    background-size: contain;
    cursor: pointer;
    background-image: var(--google-signin-light-normal);
}

.google-auth-button:focus {
    background-image: var(--google-signin-light-focus);
}

.google-auth-button.pressed {
    background-image: var(--google-signin-light-pressed);
}

.gl-dark .google-auth-button {
    background-image: var(--google-signin-dark-normal);
}

.gl-dark .google-auth-button:focus {
    background-image: var(--google-signin-dark-focus);
}

.gl-dark .google-auth-button.pressed {
    background-image: var(--google-signin-dark-pressed);
}
</style>
