<template>
  <div class="container-fluid">
    <div class="row">
      <div class="col-8"></div>
      <div class="col-4 align-self-end">
        <!-- Filter search Box -->
        <gl-form-input
          id="filter-input"
          v-model="filter"
          type="search"
          placeholder="Type to filter"
        />
      </div>
    </div>
    <div class="row-fluid">
      <div class="col-md-12" :style="tableHeight">
        <div v-if="loading" class="loading apollo">Loading...</div>
        <div v-else-if="error" class="error apollo">An error occured</div>
        <div v-else>
          <!-- Table -->
          <gl-table
            id="accounts-table"
            @row-clicked="rowClicked"
            @filtered="onFiltered"
            :current-page="page"
            :select-mode="selectMode"
            :items="items"
            :fields="fields"
            :perPage="perPage"
            :filter="filter"
            :filter-included-fields="filterOn"
            ref="selectableTable"
            primary-key="id"
            :tbody-tr-class="tbodyRowClass"
            show-empty
          >
            <!-- No records found -->
            <template #empty="scope">
              <div class="text-center my-2">{{ scope.emptyText }}</div>
            </template>

            <!-- Not recours found using filter box -->
            <template #emptyfiltered="scope">
              <div class="text-center my-2">{{ scope.emptyFilteredText }}</div>
            </template>

            <!-- Checkbox to select row -->
            <template v-slot:cell(selected)="{ item, field: { key } }">
              <gl-form-checkbox v-model="item[key]"></gl-form-checkbox>
            </template>
          </gl-table>
        </div>
      </div>
    </div>
    <div class="row-fluid">
      <div class="col-md-12">
        <gl-pagination
          v-model="page"
          :per-page="perPage"
          :total-items="totalRows"
          first-text="First"
          prev-text="Prev"
          next-text="Next"
          last-text="Last"
          aria-controls="accounts-table"
        />
      </div>
    </div>
  </div>
</template>
<script lang="ts">
import {
  GlTable,
  GlPagination,
  GlFormCheckbox,
  GlFormInput,
  GlContainer,
  GlRow,
  GlCol
} from "@gitlab/ui";
import { Component, Vue, Ref } from "vue-property-decorator";
import { GET_ACCOUNTS } from "../../graphql/Accounts/Account";

@Component({
  components: {
    GlTable,
    GlPagination,
    GlFormCheckbox,
    GlFormInput,
    GlContainer,
    GlRow,
    GlCol
  }
})
export default class Table extends Vue {
  @Ref() readonly selectableTable: typeof GlTable;

  [x: string]: any;
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
  perPage = 3;
  loading = false;
  error = false;
  selected: Array<any> = [];
  selectMode = "multi";
  filter = null;
  filterOn = [];
  totalRows = 1;

  data() {
    return {
      items: []
    };
  }

  rowClicked(item: any) {
    if (item.selected) {
      this.$set(item, "selected", false);
    } else {
      this.$set(item, "selected", true);
    }
  }

  tbodyRowClass(item: any) {
    /* Style the row as needed */
    if (item === null || item === undefined) return;
    if (item.selected) {
      return ["b-table-row-selected", "table-primary", "cursor-pointer"];
    } else {
      return ["cursor-pointer"];
    }
  }

  onFiltered(filteredItems: any) {
    this.totalRows = filteredItems.length;
    this.page = 1;
  }

  public async created() {
    this.loading = true;

    const { loading, data, errors } = await this.$apollo.query({
      query: GET_ACCOUNTS
    });

    this.loading = loading;
    if (errors) {
      this.error = true;
    } else {
      this.items = data.accounts;
      this.totalRows = this.items.length;
    }
  }

  public get selectedRows(): string[] {
    return this.items.filter((item: { selected: any }) => item.selected);
  }

  public get tableHeight(): string {
    return `height: ${this.perPage * 56 + 60}px`;
  }
}
</script>
<style scoped>
/* Some css */
</style>
