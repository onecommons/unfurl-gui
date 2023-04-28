<script>
import {parseMarkdown} from '../../client_utils/markdown'
export default {
    name: 'MarkdownView',
    props: {
        content: String
    },
    computed: {
        parsed() {
            try {
                return parseMarkdown(this.content)
            } catch(e) {
                console.error(e)
                return ''
            }
        }
    }
}
</script>
<template>
    <div v-html="parsed">
    </div>
</template>
<style scoped>
    div {
        display: contents;
    }

    /* TODO add a class override this */
    div >>> p {
        margin-bottom: 0;
    }
</style>


