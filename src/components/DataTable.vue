<template>
  <gl-table :items="this.items" :fields="$options.fields">
    <div>{{ items }}</div>
    <!-- add slot here, something like (assuming Status is registered component):

    <template #cell(Status)="{ currentStatus }">
      <Status status="currentStatus"/>
    </template>
    
    -->
  </gl-table>
</template>
<script>
import * as GlComponents from "@gitlab/ui";

export default {
  fields: [
    {
      key: "row",
      label: "Name",
      thClass: "dt-th",
      tdClass: "dt-td"
    },
    {
      key: "content",
      label: "Data",
      thClass: "dt-th",
      tdClass: "dt-td"
    }
  ],
  name: "DataTable",
  props: {
    items: Array
  },
  components: {
    ...GlComponents
  }
};
</script>
<style>
table.gl-table,
table.gl-table tr td {
  border: 1px solid #999;
}
table.gl-table tr th.dt-th {
  background-color: #000;
  color: #fff;
}
</style>
