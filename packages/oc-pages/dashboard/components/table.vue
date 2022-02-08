<script>
import TableComponent from '../../vue_shared/components/oc/table.vue';
import Status from '../../vue_shared/components/oc/Status.vue';
import {mapGetters, mapActions} from 'vuex';
import _ from 'lodash';
import { __ } from '~/locale';
import {USER_HOME_PROJECT} from '../../vue_shared/util.mjs'

/*
        unknown: ["muted", "status_notfound"],
        pending: ["neutral", "status_preparing"],
        absent: ["info", "status_open"],
        ok: ["success", "status_success_solid"],
        error: ["danger", "status_warning"],
        degraded: ["warning", "status_running"]

* this is the shape that the items can be passed in NOTE the tooltips
const items = [
  {
    name: "A",
    type: "DB",
    status: "unknown",
    project: "Project1",
    maintainer: "Imran",
    deployment: 1,
  },
  {
    name: "B",
    type: "Compute",
    status: "pending",
    project: "Project1",
    deployment: 1,
    uptime: 1800
  },
  {
    name: "C",
    type: "Compute",
    status: "ok",
    project: "Project1",
    deployment: 1,
    uptime: 1800
  },
  {
    name: "A",
    type: "DB",
    status: "absent",
    tooltips: {
      name: 'missing in action'
    },
    project: "Project1",
    deployment: 2,
  },
  {
    name: "B",
    type: "Compute",
    status: "error",
    project: "Project1",
    deployment: 2,
  },
  {
    name: "C",
    type: "Compute",
    status: "degraded",
    project: "Project2",
    maintainer: "Andrew",
    deployment: 1,
    tooltips: {
      maintainer: 'What a tool?!'
    }
  },
]; 

*/

const fields = [
  {key: 'application',  label: __('Applications')},
  {key: 'environmentName', label: __('Environments')},
  {key: 'deployment', label: __('Deployment')},
  {key: 'type', label: __('Type')},
  {key: 'name', label: __('Name')},
  {key: 'status', groupBy: 'name', label: __('Status')},
];

export default {
  name: 'TableComponentContainer',
  //components: {TableComponent, Status},
  components: {TableComponent},
  data() {
    return { fields, items: [], loaded: false};
  },

  computed: {
    ...mapGetters([
      'getApplicationBlueprint',
      'getDeploymentDictionaries',
      'getDeployment',
      'getResources',
      'resolveResourceTemplate',
      'resolveResourceType',
      'resolveDeploymentTemplate'
    ]),
  },

  methods: {
    ...mapActions([
      'useProjectState'
    ])
  },

  async beforeCreate() {
    //await this.$store.dispatch('fetchEnvironments', {fullPath: `${window.gon.current_username}/${USER_HOME_PROJECT}`});
  },

  async mounted() {
    this.loaded = false;
    await this.$store.dispatch('fetchEnvironments', {fullPath: `${window.gon.current_username}/${USER_HOME_PROJECT}`});
    const items = [];
    
    const groups = _.groupBy(this.getDeploymentDictionaries, '_environment');
    for(const environmentName in groups) {
      for(const deploymentDict of groups[environmentName]) {
        this.useProjectState(_.cloneDeep(deploymentDict))
        const deployment = this.getDeployment
        const application = this.getApplicationBlueprint.title;

        for(const resource of this.getResources) {
          const resourceTemplate = this.resolveResourceTemplate(resource.template);
          const resourceType = this.resolveResourceType(resourceTemplate.type);

          items.push({application, deployment: deployment.title, environmentName, type: resourceType.title, name: resource.title, status: resource.status.toString()});
        }
      }
    }

    this.items = items;
    this.loaded = true;
  }
};

</script>
<template>
  <TableComponent v-if="loaded" :items="items" :fields="fields">
    <template #status=scope>
      {{scope.item.status}}
      <!--Status :status="scope.item.status"/-->
    </template>
  </TableComponent> 
</template>

