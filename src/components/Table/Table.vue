<template>
  <ApolloQuery :query="require('../../graphql/Accounts/Account.gql')">
    <template slot-scope="{ result: { loading, error, data } }">
      <!-- Loading -->
      <div v-if="loading" class="loading apollo">Loading...</div>

      <!-- Error -->
      <div v-else-if="error" class="error apollo">An error occured</div>

      <!-- Result -->
      <div v-else-if="data" class="result apollo">
        <p>
          Selected Rows:<br />
          {{ selected }}
        </p>

        <gl-table
          id="accounts-table"
          selectable
          @row-selected="onRowSelected"
          :current-page="page"
          :select-mode="selectMode"
          :items="data.accounts"
          :fields="fields"
          :perPage="perPage"
          ref="selectableTable"
          show-empty
        >
          <!-- No records found -->
          <template #empty="scope">
            <div class="text-center my-2">{{ scope.emptyText }}</div>
          </template>
          <!-- Checkoboxes -->
          <template #cell(selected)="row">
            <gl-form-checkbox
              v-model="row.rowSelected"
              @change="onRowClicked(row)"
            ></gl-form-checkbox>
          </template>
        </gl-table>
        <gl-pagination
          v-model="page"
          :per-page="perPage"
          :total-items="data.accounts.length"
          first-text="First"
          prev-text="Prev"
          next-text="Next"
          last-text="Last"
          aria-controls="accounts-table"
        />
      </div>
    </template>
  </ApolloQuery>
</template>
<script lang="ts">
import { GlTable, GlPagination, GlFormCheckbox } from "@gitlab/ui";
import { Component, Vue, Ref } from "vue-property-decorator";

@Component({
  components: {
    GlTable,
    GlPagination,
    GlFormCheckbox
  }
})
export default class Table extends Vue {
  @Ref() readonly selectableTable: GlTable;
  fields: Array<any> = [
    {
      key: "selected",
      label: "",
      sortable: false
    },
    {
      key: "account",
      label: "Account",
      sortable: true
    },
    {
      key: "group",
      label: "Group",
      sortable: true
    },
    {
      key: "network",
      label: "Network",
      sortable: true
    },
    {
      key: "resource",
      label: "Resource",
      sortable: true
    },
    {
      key: "service",
      label: "Service",
      sortable: true
    },
    {
      key: "emsemble",
      label: "Emsemble",
      sortable: true
    },
    {
      key: "description",
      label: "Description",
      sortable: false
    }
  ];
  page = 1;
  perPage = 10;
  selected: Array<any> = [];
  selectMode = "multi";

  onRowSelected(items: any) {
    this.selected = items;
  }

  onRowClicked(row: any) {
    this.$refs.selectableTable.$children[0].selectRow(row.index);
  }
}
</script>
<style scoped>
/* Some css */
</style>
