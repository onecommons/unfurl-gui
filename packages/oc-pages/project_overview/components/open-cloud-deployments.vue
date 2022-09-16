<script>
import {mapGetters} from 'vuex'
import TableComponent from 'oc_vue_shared/components/oc/table.vue'
import {DetectIcon} from 'oc_vue_shared/oc-components'
import {lookupCloudProviderAlias} from 'oc_vue_shared/util.mjs'

export default {
    name: 'OpenCloudDeployments',
    fields: [
        {key: 'deployment', label: 'Deployment', groupBy: i => i.deployment.url},
        {key: 'cloud',  label: 'Cloud'},
        {key: 'testbed', label: 'Testbed', groupBy: i => i.testbed.url}
    ],
    components: {TableComponent, DetectIcon},
    computed: {
        ...mapGetters(['openCloudDeployments']),
        items() {
            const items = []
            for(const openCloudDeployment of this.openCloudDeployments) {
                const dashboardURL = new URL(openCloudDeployment.dashboard_url)

                const cloud = lookupCloudProviderAlias(openCloudDeployment.cloud)


                let testbed, deployment

                {
                    const name = dashboardURL.pathname.split('/').slice(0, -1).join('/').slice(1)
                    const url = dashboardURL.origin + '/home/' + name + '/-/deployments' // TODO assumptions about dashboard name
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
        <template #deployment="scope">
            <div>
                <a target="blank" :href="scope.item.deployment.url">{{scope.item.deployment.name}}</a>
            </div>
        </template>
        <template #cloud="scope">
            <detect-icon :name="scope.item.cloud" />
        </template>
        <template #testbed="scope">
            <div>
                <a target="blank" :href="scope.item.testbed.url">{{scope.item.testbed.name}}</a>
            </div>
        </template>
    </table-component>

</template>
