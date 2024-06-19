<script>
import {mapGetters, mapMutations} from 'vuex'
import {defaultSeverityLevel} from '../../storage-keys'
import {GlAlert, GlTabs, GlPagination} from '@gitlab/ui'
import CodeClipboard from 'oc_vue_shared/components/oc/code-clipboard.vue'

const ERROR_LEVELS = ['minor', 'major', 'critical']

const PER_PAGE = 5
export default {
    name: 'UnfurlGuiErrors',
    components: {
        GlAlert, GlTabs, GlPagination,
        CodeClipboard
    },
    data() {
        const headerElement = document.querySelector('[data-qa-selector="navbar"]')
        const {y, height} = headerElement.getBoundingClientRect()
        return {
            currentTab: ERROR_LEVELS.indexOf(defaultSeverityLevel()),
            defaultSeverityLevel: defaultSeverityLevel(),
            page: 1,
            PER_PAGE,
            headerElementPos: y + height,
        }
    },
    computed: {
        ...mapGetters(['errors', 'errorsBySeverity', 'scrollTop']),
        presentableErrors() {
            return this.errorsBySeverity(ERROR_LEVELS[this.currentTab]) || []
        },
        minorCount() { return this.errorsBySeverity('minor').length },
        majorCount() { return this.errorsBySeverity('major').length },
        criticalCount() { return this.errorsBySeverity('critical').length },
        defaultErrorCount() { return this.errorsBySeverity(this.defaultSeverityLevel).length },
        errorsOnPage() {
            return this.presentableErrors.slice((this.page - 1) * this.PER_PAGE, this.page * this.PER_PAGE)
        }

    },
    watch: {
        currentTab() {
            this.page = 1
        },
        scrollTop: {
            immediate: true,
            handler(val) {
                try {
                    this.$refs.container.style.top = Math.min(val, this.headerElementPos) + 'px'
                } catch(e) {}
            }
        },
    },
    methods: {
        ...mapMutations(['clearErrors']),
    },
}
</script>
<template>
    <!-- 599 is one z-index below the sidebar -->
    <div class="ufgui-error-container" ref="container" style="top: 0px; z-index: 599;">
        <gl-alert @dismiss="clearErrors" variant="danger" v-if="defaultErrorCount > 0">
            <gl-tabs v-if="defaultErrorCount > 1 && defaultErrorCount != errors.length" v-model="currentTab" style="margin-bottom: -24px" >
                <oc-tab title="All" v-if="minorCount > majorCount" :title-count="minorCount" />
                <oc-tab v-if="majorCount > criticalCount" title="Major" :title-count="majorCount" />
                <oc-tab v-if="criticalCount" title="Critical" :title-count="criticalCount" />
            </gl-tabs>
            <oc-properties-list
                v-for="error in errorsOnPage"
                :key="error.time"
                :header="`${error.message}`"
                :properties="Object.entries(error).map(([name, value]) => ({name, value}))"
                container-style="width: 100%"
                start-collapsed
            >
                <template #traceback="{traceback}">
                    <code-clipboard>{{traceback}}</code-clipboard>
                </template>
            </oc-properties-list>
            <gl-pagination v-if="presentableErrors.length > PER_PAGE" v-model="page" :per-page=PER_PAGE :total-items="presentableErrors.length" />
        </gl-alert >
        <div v-else />
    </div>

</template>
<style>
.ufgui-error-container {
    position: sticky;
}

/* Doesn't work consistently on dashboard page */
body.modal-open #OcAppDeployments .ufgui-error-container {
    position: fixed;
    min-width: min(950px, 100%)
}
</style>
