<script>
import TableComponent from 'oc_vue_shared/components/oc/table.vue';
import {GlCard} from '@gitlab/ui'
import {Tooltip as ElTooltip} from 'element-ui'
import {DetectIcon} from 'oc_vue_shared/components/oc'
import {lookupCloudProviderAlias} from 'oc_vue_shared/util'
import graphJson from './cloud-graph-inspector-mock.data.json'


export default {
  name: 'CloudTable',
  components: {TableComponent, DetectIcon, GlCard},
  props: {
    data: Object
  },
  fields: [
    {key: 'provider', label: 'Provider'},
    {key: 'region', label: 'Regions', s: 'Region'},
    {key: 'testbed', label: 'Testbed Dashboards', s: 'Testbed', groupBy: i => i.testbed.url},
    {key: 'deployment', label: 'Deployments', s: 'Deployment', groupBy: i => i.deployment.url},
  ],
  methods: {
    lookupCloudProviderAlias,
    regionInspectorHref() {
      const rootUrl = graphJson.roots?.[0]?.url
      return rootUrl ? `#graph=${encodeURIComponent(rootUrl)}` : '#'
    },
  },
  computed: {
    items() {
      const items = []
      if(!this.data?.children) return items

      for(const provider of this.data.children) {
        for(const region of provider.children) {
          for(const _testbed of region.children) {
            for(const openCloudDeployment of _testbed.children) {
              let deployment, testbed
              {
                const name = openCloudDeployment.name
                const url = openCloudDeployment.visit
                deployment = {name, url}
              }

              {
                const url = openCloudDeployment.visit.split('/-/deployments')[0] + '/-/deployments'
                const name = _testbed.name
                testbed = {name, url}
              }
              items.push({provider: provider.name, region: region.name, testbed, deployment})
            }
          }
        }
      }

      return items
    }
  }
}
</script>
<template>
  <gl-card id="public-cloud-deployments" class="ml-5 mr-5">
    <template #header>
      <div class="d-flex justify-content-center">
        <h1 style="font-size: 28px; cursor: default" class="m-0">
          Public Cloud Testbeds
          <el-tooltip>
            <template #content>
              <div style="max-width: 300px; font-size: 1.1rem;">
                Here are some of the open-source application and services available in our public cloud. Click on a deployment to see details or to clone.  Or join one of  a testbed project to get full access to our public cloud infrastructure.
              </div>
            </template>

            <i class="el-icon-info"></i>
          </el-tooltip>
        </h1>
      </div>
    </template>
    <table-component v-if="items.length" :items="items" no-margin hide-filter :fields="$options.fields" style="font-size: 1.125em;">
      <template #provider="scope">
        <div class="d-flex">
          <detect-icon :size="20" :name="lookupCloudProviderAlias(scope.item.provider)" />
          <div class="ml-1">
            <a href="#" @click.prevent="$emit('focus', {type: 'cloudProvider', node: scope.item.provider})">
              {{scope.item.provider}}
            </a>
          </div>
        </div>
      </template>
      <template #region="scope">
        <a :href="regionInspectorHref()">
          {{scope.item.region}}
        </a>
      </template>
      <template #testbed="scope">
        <div>
          <a target="blank" :href="scope.item.testbed.url">{{scope.item.testbed.name}}</a>
        </div>
      </template>
      <template #deployment="scope">
        <a target="blank" :href="scope.item.deployment.url">{{scope.item.deployment.name}}</a>
      </template>
    </table-component>
  </gl-card>
</template>

<style scoped>
#public-cloud-deployments  >>> .gl-card-body {
  padding: 0;
}
</style>
