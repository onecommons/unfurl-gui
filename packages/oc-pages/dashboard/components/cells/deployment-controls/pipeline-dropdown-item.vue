<script>
import {mapGetters} from 'vuex'

export default {
    name: 'PipelineDropdownItem',
    props: {
        deploymentItem: Object,
        pipelineIndex: Number,
    },
    data() {
        return {
            committedDate: null,
        }
    },
    computed: {
        ...mapGetters(['jobByPipelineId']),
        pipeline() {
            return this.deploymentItem.pipelines[this.pipelineIndex]
        },
        jobStatus() {
            return this.jobByPipelineId(this.pipeline.id)?.status?.toLowerCase()
        }
    },
    methods: {
        async updateCommittedDate() {
            const commit = await this.deploymentItem.getCommit(this.pipelineIndex)
            this.committedDate = new Date(commit.committed_date)
        },
    },
    watch: {
        deploymentItem: {
            immediate: true,
            handler() { this.updateCommittedDate() }
        },
        pipelineIndex() { this.updateCommittedDate() }
    }
}
</script>
<template>
    <div v-if="committedDate" class="d-contents">
        {{committedDate.toLocaleDateString()}}
        {{committedDate.toLocaleTimeString()}}
        ({{pipeline.variables.WORKFLOW}} / {{jobStatus}})
    </div>
</template>
