<script>
import TableComponent from '../../vue_shared/components/oc/table.vue';
import Status from '../../vue_shared/components/oc/Status.vue';
import { __ } from '~/locale';

/*
        unknown: ["muted", "status_notfound"],
        pending: ["neutral", "status_preparing"],
        absent: ["info", "status_open"],
        ok: ["success", "status_success_solid"],
        error: ["danger", "status_warning"],
        degraded: ["warning", "status_running"]
*/

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

const fields = [
  {key: 'project',  label: __('Projects')},
  {key: 'maintainer', groupBy: 'project', label: __('Maintainer')},
  {key: 'deployment', label: __('Deployment')},
  {key: 'type', label: __('Type')},
  {key: 'name', label: __('Name')},
  {key: 'status', groupBy: 'name', label: __('Status')},
  {key: 'uptime', groupBy: 'name', label: __('Uptime')},
];

//const groupByColumns = ['project', 'deployment', 'type', 'name']
export default {
  name: 'TableComponentContainer',
  components: {TableComponent, Status},
  data() {
    return { items, fields };
  }
};

</script>
<template>
  <TableComponent :items="items" :fields="fields">
    <template #status=scope>
        <Status :status="scope.item.status"/>
    </template>
  </TableComponent> 
</template>

