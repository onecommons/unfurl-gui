<script>
import TableComponent from '../../vue_shared/components/oc/table.vue'
import { __ } from '~/locale';

const items = [
  {
    name: "A",
    type: "DB",
    status: "OK",
    project: "Project1",
    maintainer: "Imran",
    deployment: 1,
  },
  {
    name: "B",
    type: "Compute",
    status: "OK",
    project: "Project1",
    deployment: 1,
    uptime: 1800
  },
  {
    name: "C",
    type: "Compute",
    status: "OK",
    project: "Project1",
    deployment: 1,
    uptime: 1800
  },
  {
    name: "A",
    type: "DB",
    status: "OK",
    project: "Project1",
    deployment: 2,
  },
  {
    name: "B",
    type: "Compute",
    status: "OK",
    project: "Project1",
    deployment: 2,
  },
  {
    name: "C",
    type: "Compute",
    status: "OK",
    project: "Project2",
    maintainer: "Andrew",
    deployment: 1,
  },
] 

const fields = [
  {key: 'project',  label: __('Projects')},
  {key: 'maintainer', groupBy: 'project', label: __('Maintainer')},
  {key: 'deployment', label: __('Deployment')},
  {key: 'type', label: __('Type')},
  {key: 'name', label: __('Name')},
  {key: 'status', groupBy: 'name', label: __('Status')},
  {key: 'uptime', groupBy: 'name', label: __('Uptime')},
]

//const groupByColumns = ['project', 'deployment', 'type', 'name']
export default {
  name: 'TableComponentContainer',
  components: {TableComponent},
  data() {
    return { items, fields }
  }
}

</script>
<template>
  <TableComponent :items="items" :fields="fields">
    <!--template #name$empty>No name</template-->
    <!--template #name=scope>{{JSON.stringify(scope.item)}}</template-->
  </TableComponent> 
</template>

