<script>
import { mapGetters } from 'vuex'
import { GlBadge } from '@gitlab/ui'
import TableComponent from 'oc_vue_shared/components/oc/table.vue'
export default {
    name: 'JobSummary',
    components: { GlBadge, TableComponent },
    props: {
        jobsData: Object
    },
    fields: [
        { key: 'template', label: 'Template', textValue: item => `${item.template}: ${item.type}`},
        { key: 'status', label: 'Status'},
        { key: 'target', label: 'Target'},
        { key: 'operation', label: 'Operations', s: 'Operation', textValue: (item) => item, groupBy: (item) => item.operation},
        { key: 'targetStatus', label: 'Target Statuses', s: 'Target Status'},
        { key: 'artifact', label: 'Artifacts', s: 'Artifact', groupBy: (item) => item.artifact?.url},
    ],
    computed: {
        ...mapGetters(['getJobSummary', 'taskLineNo', 'getHomeProjectPath']),
        tableItems() {
            const tasks = this.getJobSummary.tasks
            const result = []

            for(const task of tasks) {
                if(task.rendered_paths?.length == 0) {
                    result.push(task)
                } else {
                    for(const path of task.rendered_paths) {
                        try {
                            const basePath = path.replace(
                                new RegExp(`^.*${this.getHomeProjectPath}/`),
                                ''
                            )

                            const jobId = this.jobsData[0].id

                            const url = `/${this.getHomeProjectPath}/-/jobs/${jobId}/artifacts/browse/${basePath}`
                            const text = basePath.split('/').filter(s => !!s).slice(-3).join('/')

                            const artifact = {
                                url,
                                text
                            }

                            result.push({...task, artifact})
                        } catch(e) {
                            console.error(e)
                            // better to have duplicates than fail completely
                            result.push(task)
                        }
                    }
                }
            }

            return result
        }
    },
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
        }
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

        <table-component :items="tableItems" :fields="$options.fields" hide-filter start-expanded>
            <template #template="{item}">
                <div class="longish-column" :title="item.template">
                    <div>
                        <b>{{item.template.split(': ')[0]}}</b>
                    </div>
                    <div>
                        ({{item.template.split(': ')[1]}})
                    </div>
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
                <div class="longish-column">
                    <b :title="item.target">{{item.target}}</b>
                </div>
            </template>

            <template #operation="{item}">
                <a :href="taskUrl(item.operation)" class="operation">{{item.operation.operation}}</a>
            </template>

            <template #artifact={item}>
                <!-- I don't think anyone would ever want to open in the current tab -->
                <a :href="item.artifact.url" target="_blank">{{item.artifact.text}}</a>
            </template>

            <template #artifact$empty>
                <!-- show nothing for 0 artifacts -->
                <span />
            </template>
        </table-component>
    </div>
</template>
<style scoped>
.job-summary >>> .badge-pill, .job-summary >>> .operation {
    text-transform: capitalize;
}

.longish-column, .longish-column > div {
    max-width: 250px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
</style>
