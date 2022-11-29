<script>
import {mapMutations, mapActions, mapGetters} from 'vuex'
import {compatibilityMountNotesApp} from 'oc_vue_shared/compat'
const TEXT_HTML = 'text/html' // my editor can't figure out how to indent this string
export default {
    props: {
        issueURL: {
            type: String,
            required: true
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
        ...mapGetters(['getHomeProjectPath, getDashboardItems'])
    },
    methods: {
        async mountNotesApp() {
            this.notesApp = compatibilityMountNotesApp()
        },
    },
    async mounted() {
        const documentContents = await fetch(this.issueURL).then(res => res.text())
        const elementMarkup = documentContents.match(/.*id="js-vue-notes".*/)[0]
        const tempDocument = (new DOMParser()).parseFromString(elementMarkup, TEXT_HTML)
        const element = tempDocument.querySelector('#js-vue-notes')
        const dataset = element.dataset
        const commentsContainer = document.querySelector('#comments-container')
        commentsContainer.appendChild(element)

        this.mountNotesApp()
    },
    beforeUnmount() {
        this.notesApp.$destory()
        clearTimeout(this.timeout)
    }
}
</script>
<template>
    <div v-pre id="comments-container"/>
</template>
<style scoped>

/* hide timeline events such as added labels */
#comments-container >>> ul#notes-list > li:not([data-note-id]){
    display: none;
}

</style>
