<script>
import TableComponent from '../../vue_shared/components/oc/table.vue';
import Status from '../../vue_shared/components/oc/Status.vue';
import {mapGetters, mapActions} from 'vuex';
import _ from 'lodash';
import { __ } from '~/locale';

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
      'getDeployments',
      'resolveResourceTemplate',
      'resolveResourceType',
      'resolveDeploymentTemplate'
    ]),
  },

  methods: {
    ...mapActions([
      'fetchProject'
    ])
  },

  async beforeCreate() {
    await this.$store.dispatch('fetchDeployments', {projectPath: 'user1/unfurl-home'});
  },

  async mounted() {
    this.loaded = false;
    await this.$store.dispatch('fetchDeployments', {projectPath: 'user1/unfurl-home'});
    const items = [];
    
    const groups = _.groupBy(this.getDeployments, 'blueprint');
    for(const blueprint in groups) {
      await this.fetchProject({projectPath: blueprint});
      for(const deployment of groups[blueprint]) {
        const application = this.getApplicationBlueprint.title;
        const environmentName = deployment.environment.name;
        for(const resource of deployment.resources) {
          const resourceTemplate = this.resolveResourceTemplate(resource.template);
          const resourceType = this.resolveResourceType(resourceTemplate.type);

          items.push({application, deployment: deployment.title, environmentName, type: resourceType.title, name: resource.title, status: resource.status.toString()});
        }


      }
    }

    this.loaded = true;
    this.items = items;
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

