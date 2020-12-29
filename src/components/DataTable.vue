<template>
  <gl-table :items="this.items" :fields="$options.fields">
    <template #head(column_one)>
      <div>{{ items }}</div>
    </template>
    <template #cell(column_one)>
      This is the template for column data belonging to the first object
    </template>
  </gl-table>
</template>
<script>
import * as GlComponents from "@gitlab/ui";

export default {
  fields: [
    {
      key: "row",
      label: "Column One",
      thClass: "",
      tdClass: ""
    },
    {
      key: "content",
      label: "Column 2",
      thClass: "",
      tdClass: ""
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
<style></style>
