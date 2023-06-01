<script>
import { mapGetters } from 'vuex'
import { GlBadge } from '@gitlab/ui'
import {JSONView} from 'vue-json-component'
import TableComponent from 'oc_vue_shared/components/oc/table.vue'
export default {
    name: 'JobSummary',
    components: { GlBadge, TableComponent },
    computed: {
        ...mapGetters(['getJobSummary', 'taskLineNo'])
    },
    fields: [
        { key: 'template', label: 'Template', textValue: item => `${item.template}: ${item.type}`},
        { key: 'status', label: 'Status'},
        { key: 'target', label: 'Target'},
        { key: 'targetStatus', label: 'Target Statuses', s: 'Target Status'},
        { key: 'operation', label: 'Operations', s: 'Operation', textValue: (item) => item}
    ],
    methods: {
        badgeVariantFor(jobCountKey) {
            return {
                ok: 'success',
                error: 'danger',
                skipped: 'warning',
                changed: 'info',
                unknown: 'tier'
            }[jobCountKey] || 'neutral'
        },
        taskUrl(item) {
            const lineNo = this.taskLineNo(item)
            if(lineNo) return `#L${this.taskLineNo(item)}`
        },
    }
}
</script>
<template>
    <div class="job-summary">
        <h3 class="mt-0"> Job ID: {{getJobSummary.job.id}} </h3>
        <div class="d-flex">
            <div v-for="key in ['ok', 'error', 'unknown', 'skipped', 'changed']" :key="key" >
                <gl-badge v-if="getJobSummary.job[key] > 0" :variant="badgeVariantFor(key)">
                    {{getJobSummary.job[key]}} {{key}}
                </gl-badge>
            </div>
        </div>

        <table-component :items="getJobSummary.tasks" :fields="$options.fields" hide-filter>
            <template #template="{item}">
                <div>
                    <b>{{item.template.split(': ')[0]}}</b>
                </div>
                <div>
                    ({{item.template.split(': ')[1]}})
                </div>
            </template>

            <template #status="{item}">
                <gl-badge v-if="item" :variant="badgeVariantFor(item.status)">
                    {{item.status}}
                </gl-badge>
            </template>

            <template #targetStatus="{item}">
                <gl-badge v-if="item" :variant="badgeVariantFor(item.targetStatus)">
                    {{item.targetStatus}}
                </gl-badge>
            </template>

            <template #target="{item}">
                <b>{{item.target}}</b>
            </template>

            <template #operation="{item}">
                <a :href="taskUrl(item.operation)" class="operation">{{item.operation.operation}}</a>
            </template>

        </table-component>
    </div>
</template>
<style scoped>
.job-summary >>> .badge-pill, .job-summary >>> .operation {
    text-transform: capitalize;
}
</style>
