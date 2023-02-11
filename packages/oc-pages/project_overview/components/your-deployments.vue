<script>
import { GlCard, GlIcon } from '@gitlab/ui'
import {mapState, mapGetters} from 'vuex'
import {DeploymentIndexTable} from 'oc/dashboard/components'
/*
        const fields = [
            {
                key: 'status',
                tableBodyStyles: {'justify-content': 'center'},
                groupBy: deploymentGroupBy,
                textValue: (item) => (item.deployment?.statuses || []).map(resource => resource?.name || '').join(' '),
                label: 'Status'
            },
            {key: 'deployment', textValue: deploymentGroupBy, label: 'Deployment'},
            {
                key: 'environment',
                label: 'Environments',
                s: 'Environment',
                groupBy: (item) => item.environment?.name
            },
            {
                key: 'resource',
                label: 'Resources',
                textValue: (item) => item.resource?.title,
                groupBy: (item) => item.resource?.name,
                s: 'Resource'
            },
            {
                key: 'open',
                label: 'Open',
                groupBy: (item) => item.context.deployment?.name,
                textValue: () => '',
            },
        ]
*/
export default {
    name: "YourDeployments",
    components: {GlCard, GlIcon, DeploymentIndexTable},
    computed: {
        ...mapState(['project']),
        ...mapGetters(['yourDeployments']),
    }
}
</script>
<template>
    <div v-if="yourDeployments.length">
        <gl-card bodyClass="p-0">
            <template #header>
                <div class="d-flex align-items-center">
                    <gl-icon name="package" class="mr-2"/>
                        <h5 class="mb-0 mt-0">
                            {{__('Your Deployments')}}
                        </h5>
                </div>

            </template>
            <deployment-index-table no-router :items="yourDeployments" hide-filter no-margin/>

        </gl-card>
    </div>
</template>
