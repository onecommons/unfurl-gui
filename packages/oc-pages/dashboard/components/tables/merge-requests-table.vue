<script>
import {mapGetters} from 'vuex'
import {GlIcon} from '@gitlab/ui'
import EnvironmentCell from '../cells/environment-cell.vue'
import TableComponent from 'oc_vue_shared/components/oc/table.vue'

const fields = [
    {
        key: 'draft',
        label: 'Merge Request',
        groupBy: (item) => item.draft.title + ':' +  item.author.name
    },
    {
        key: 'environment',
        label: 'Environment',
        groupBy: (item) => item.environment?.name
    },
    {
        key: 'author',
        label: 'Author'
    },
    {
        key: 'source_branch',
        label: 'Source Branch'
    },
    {
        key: 'updated_at',
        label: 'Last Updated'
    }
]

export default {
    name: 'MergeRequestsTable',
    components: {
        TableComponent,
        GlIcon,
        EnvironmentCell
    },
    computed: {
        ...mapGetters(['mergeRequests', 'getHomeProjectPath', 'lookupEnvironment']),
        items() {
            return this.mergeRequests?.map(mr => {
                let environment = null 
                try {
                    const name = mr.labels.find(l => l.startsWith('environment:'))?.split(':')?.pop()
                    environment = this.lookupEnvironment(name)
                } catch(e) {console.error(e)}

                let applicationBlueprintUrl = mr.labels.find(l => l.startsWith('application-blueprint-project-path'))?.split(':')?.pop()
                if(applicationBlueprintUrl) {
                    applicationBlueprintUrl = window.location.origin + '/' + applicationBlueprintUrl
                }

                const applicationBlueprintTitle = mr.labels.find(l => l.startsWith('application-blueprint-title'))?.split(':')?.pop()

                return {...mr, draft: {title: mr.title, description: mr.description, ready: !mr.draft, web_url: mr.web_url, applicationBlueprintUrl, applicationBlueprintTitle}, environment}
            }) || []

        }
    },
    fields

}
</script>
<template>
    <table-component :fields="$options.fields" :items="items" hide-filter>
        <template #selected$head>
            <div style="height: 1.875em; width: 1.875em;" />
        </template>
        <template #draft="{item}">
            <div class="d-flex align-items-center">
                <span style="display: inline-block; margin-left: -30px; margin-right: -10px; width: 40px;">
                    <a :href="item.draft.web_url" style="color: inherit">
                        <gl-icon v-if="item.draft.ready" name="check-circle" title="Ready" v-gl-tooltip.hover :size="16"/>
                    </a>
                </span>
                <!-- link to edit directly -->
                <!-- <a :href="item.draft.description && item.draft.description.split(/[\(\)]/)[1]"><b>{{item.draft.title}}</b></a> -->

                <div class="d-flex flex-column">
                    <a :href="item.draft.web_url"><b>{{item.draft.title}}</b></a>
                    <a v-if="item.draft.applicationBlueprintUrl" :href="item.draft.applicationBlueprintUrl">({{item.draft.applicationBlueprintTitle}})</a>
                </div>
            </div>
        </template>
        <template #environment="{item}">
            <environment-cell :noRouter="noRouter" :environment="item.environment"/>
        </template>
        <template #author="{item}">
            <div>
                <a :href="item.author.web_url">
                    <img style="width: 1.5em; height: 1.5em; border-radius: 50%;" :src="item.author.avatar_url">
                </a>
                <a :href="item.author.web_url">
                    {{item.author.name}}
                </a>
            </div>
        </template>
        <template #updated_at="{item}">
            {{(new Date(item.updated_at)).toLocaleDateString()}} {{(new Date(item.updated_at)).toLocaleTimeString()}}
        </template>
        <template #source_branch="{item}">
            <a :href="`/${getHomeProjectPath}/-/tree/${item.source_branch}`"> {{item.source_branch}} </a>
        </template>
    </table-component>
</template>
