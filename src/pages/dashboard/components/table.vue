<script>
import { GlTable, GlPagination, GlFormCheckbox, GlFormInput } from "@gitlab/ui";
import { __ } from '~/locale';
import accountsQuery from '../graphql/queries/accounts.query.graphql';

export default {
  name: 'TableComponent',
  components: {
    GlTable,
    GlPagination,
    GlFormCheckbox,
    GlFormInput
  },

  data() {
    return {
      fields : [
        {
          key: "selected",
          label: "",
          sortable: false
        },
        {
          key: "account",
          label: __('Account'),
          sortable: true
        },
        {
          key: "group",
          label: __("Group"),
          sortable: true
        },
        {
          key: "network",
          label: __("Network"),
          sortable: true
        },
        {
          key: "resource",
          label: __("Resource"),
          sortable: true
        },
        {
          key: "service",
          label: __("Service"),
          sortable: true
        },
        {
          key: "ensemble",
          label: __("Ensemble"),
          sortable: true
        },
        {
          key: "description",
          label: __("Description"),
          sortable: false
        }
      ],
      page: 1,
      perPage: 5,
      error: false,
      selected: [],
      selectMode: "multi",
      filter: null,
      filterOn: [],
      totalRows: 0,
      items: []
    }
  },

  apollo: {
    accounts: {
      query: accountsQuery,
      result({ data }) {
        this.items = data?.accounts || [];
        this.totalRows = this.items.length;
      }
    }
  },

  computed: {
    selectedRows() {
      return this.items.filter((item) => item.selected);
    }
  },

  methods: {
    rowClicked(item) {
      if (item.selected) {
        this.$set(item, "selected", false);
      } else {
        this.$set(item, "selected", true);
      }
    },

    tbodyRowClass(item) {
      /* Style the row as needed */
      if (item === null || item === undefined) return;
      if (item.selected) {
        // eslint-disable-next-line consistent-return
        return ["b-table-row-selected", "table-primary", "cursor-pointer"];
      }
      // eslint-disable-next-line consistent-return
      return ["cursor-pointer"];
    },

    onFiltered(filteredItems) {
      this.totalRows = filteredItems.length;
      this.page = 1;
    },
  }
};
</script>
<template>
  <div class="container-fluid">
    <div class="row filter-searchbox">
      <div class="col-8"></div>
      <div class="col-4 align-self-end">
        <!-- Filter search Box -->
        <gl-form-input
          id="filter-input"
          v-model="filter"
          type="search"
          :placeholder="__(`Type to filter`)"
        />
      </div>
    </div>
    <div class="row-fluid">
      <div class="col-md-12">
        <div v-if="$apollo.loading" class="loading apollo">{{ __("Loading...") }}</div>
        <div v-else-if="error" class="error apollo">{{ __("An error occured") }}</div>
        <div v-else>
          <!-- Table -->
          <gl-table
            id="accounts-table"
            ref="selectableTable"
            responsive
            layout
            :current-page="page"
            :select-mode="selectMode"
            :items="items"
            :fields="fields"
            :per-page="perPage"
            :filter="filter"
            :filter-included-fields="filterOn"
            primary-key="id"
            :tbody-tr-class="tbodyRowClass"
            show-empty
            @row-clicked="rowClicked"
            @filtered="onFiltered"
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
            <template #cell(selected)="{ item, field: { key } }">
              <gl-form-checkbox v-model="item[key]"/>
            </template>
          </gl-table>
        </div>
      </div>
    </div>
    <div class="row justify-content-end gl-mt-4">
      <div class="col">
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
<style scoped>
.filter-searchbox {
  margin-bottom: 10px;
}
</style>
