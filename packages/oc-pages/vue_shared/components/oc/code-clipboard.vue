
<script>
import {GlIcon} from '@gitlab/ui'

const CLIPBOARD_TITLE_COPY = 'Copy to clipboard'
const CLIPBOARD_TITLE_COPIED = 'Copied to clipboard!'

export default{
    name: 'CodeClipboard',
    data() {
        return {clipboardTitle: CLIPBOARD_TITLE_COPY, CLIPBOARD_TITLE_COPY}
    },
    components: {
        GlIcon
    },
    methods: {
        async copyLocalCloneInvocation() {
            const code = this.$refs.code.textContent
            await navigator.clipboard.writeText(code)
            this.clipboardTitle = CLIPBOARD_TITLE_COPIED
        }
    },
}
</script>
<template>
    <div class="position-relative">
        <pre><code ref="code"><slot></slot></code></pre>
        <gl-icon v-gl-tooltip.hover @mouseenter="clipboardTitle = CLIPBOARD_TITLE_COPY" @click="copyLocalCloneInvocation" class="position-absolute" style="bottom: 8px; right: 8px; cursor: pointer;" :size="18" :title="clipboardTitle" name="copy-to-clipboard" />
    </div>

</template>
