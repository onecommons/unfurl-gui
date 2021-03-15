<template>
  <div class="row-fluid mt-4">
    <h3>Accounts</h3>
    <Table />
  </div>
</template>
<script lang="ts">
import { Component, Vue } from "vue-property-decorator";
import Table from "../components/Table/Table.vue";

@Component({
  components: {
    Table
  }
})
export default class TableView extends Vue {}
</script>
