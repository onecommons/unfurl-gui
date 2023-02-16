<script>
import {mapGetters} from 'vuex'
import TableComponent from 'oc_vue_shared/components/oc/table.vue'
import {DetectIcon} from 'oc_vue_shared/components/oc'
import {lookupCloudProviderAlias, cloudProviderFriendlyName} from 'oc_vue_shared/util.mjs'

export default {
    name: 'OpenCloudDeployments',
    fields: [
        {key: 'cloud',  label: 'Cloud'},
        {key: 'testbed', label: 'Testbed Projects', s: 'Testbed', groupBy: i => i.testbed.url},
        {key: 'deployment', label: 'Deployments', s: 'Deployment', groupBy: i => i.deployment.url},
    ],
    components: {TableComponent, DetectIcon},
    methods: {cloudProviderFriendlyName},
    computed: {
        ...mapGetters(['openCloudDeployments']),
        items() {
            const items = []
            for(const openCloudDeployment of this.openCloudDeployments) {
                const dashboardURL = new URL(openCloudDeployment.dashboard_url)

                const cloud = lookupCloudProviderAlias(openCloudDeployment.cloud)


                let testbed, deployment

                {
                    //const name = openCloudDeployment.testbed.name
                    const dashboardPath = dashboardURL.pathname.split('.git')[0]
                    const name = dashboardPath.slice(1)
                    const url = dashboardURL.origin + dashboardPath + '/-/deployments'
                    testbed = {name, url}
                }

                {
                    const split = openCloudDeployment.deploy_path.split('/')
                    const environmentName = split[1]


                    const name = openCloudDeployment.name
                    const url = `${testbed.url}/${environmentName}/${name}`
                    deployment = {name, url}
                }

                items.push({deployment, cloud, testbed})
            }
            return items
        },
    }
}
</script>
<template>
    <table-component no-margin hide-filter :use-collapse-all="false" :fields="$options.fields" :items="items">
        <template #cloud$head>
            <span class="ml-4">Cloud</span>
        </template>
        <template #deployment="scope">
            <div>
                <a target="blank" :href="scope.item.deployment.url">{{scope.item.deployment.name}}</a>
            </div>
        </template>
        <template #cloud="scope">
            <div class="d-flex align-items-center ml-4">
                <detect-icon :size="20" :name="scope.item.cloud" />
                <div class="ml-1"> {{cloudProviderFriendlyName(scope.item.cloud)}} </div>
            </div>
        </template>
        <template #testbed="scope">
            <div>
                <a target="blank" :href="scope.item.testbed.url">{{scope.item.testbed.name}}</a>
            </div>
        </template>
    </table-component>

</template>
