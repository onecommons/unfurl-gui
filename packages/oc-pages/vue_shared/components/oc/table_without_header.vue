<script>
import TableListRow from './table_list_row.vue';
import { __ } from '~/locale';

export default {
    name: "TableWithoutHeader",
    components: {
        TableListRow
    },
    props: {
        dataRows: {
            type: Array,
            required: true
        },
        editable: {
            type: Boolean,
            required: true
        }
    },
    data() {
        return {
            projectName: null
        };
    },
    methods: {}
};
</script>
<template>
  <div class="row-fluid">
      <div class="ci-table" role="grid">
          <TableListRow :items="dataRows" :editable="editable" />
      </div>
  </div>
</template>
