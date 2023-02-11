<script>
import {mapMutations, mapActions, mapGetters} from 'vuex'
import {compatibilityMountNotesApp} from 'oc/vue_shared/compat'
import {sleep} from 'oc/vue_shared/client_utils/misc'
import {countComments} from 'oc/vue_shared/client_utils/comments'

const TEXT_HTML = 'text/html' // my editor can't figure out how to indent this string
const POLL_PERIOD = 1000
export default {
    props: {
        poll: {
            type: Boolean,
            default: true
        }
    },
    data() {
        return {
            notesApp: null,
            timeout: null,
            initialCompletionState: null,
            linesRead: 0,
            autoscroll: true
        }
    },
    computed: {
        ...mapGetters(['commentsIssueUrl', 'commentsCount']),
    },
    methods: {
        ...mapMutations(['setCommentsCount']),
        async mountNotesApp() {
            this.notesApp = compatibilityMountNotesApp()
        },
        async pollDiscussions() {
            await sleep(POLL_PERIOD)

            const commentsCount = countComments(this.notesApp.$store.getters.discussions)
            this.setCommentsCount(commentsCount)

            if(this.poll) this.pollDiscussions()
        }
    },
    async mounted() {
        this.mounted = true
        const documentContents = await fetch(this.commentsIssueUrl).then(res => res.text())
        const elementMarkup = documentContents.match(/.*id="js-vue-notes".*/)[0]
        const tempDocument = (new DOMParser()).parseFromString(elementMarkup, TEXT_HTML)
        const element = tempDocument.querySelector('#js-vue-notes')
        const dataset = element.dataset
        const commentsContainer = document.querySelector('#comments-container')
        commentsContainer.appendChild(element)

        this.mountNotesApp()
        this.pollDiscussions()
    },
    beforeUnmount() {
        this.notesApp.$destory()
    }
}
</script>
<template>
    <div v-pre id="comments-container"/>
</template>
<style scoped>

/* hide timeline events such as added labels */
#comments-container >>> ul#notes-list > li.system-note {
    display: none;
}

/* hide close issue button */
#comments-container >>> button[data-testid="close-reopen-button"] {
    display: none;
}

/* hide non-functional fullscreen button */
#comments-container >>> button[title$="full screen"] {
    display: none;
}

/* hide "Markdown and quick actions are supported" */
/* TODO find a way to show just markdown link */
#comments-container >>> .toolbar-text {
    display: none;
}
</style>
