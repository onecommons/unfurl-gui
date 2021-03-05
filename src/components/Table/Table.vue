<template>
    <ApolloQuery
        :query="require('../../graphql/Accounts/Account.gql')"
        >
        <template slot-scope="{ result: { loading, error, data } }">
            <!-- Loading -->
            <div v-if="loading" class="loading apollo">Loading...</div>

            <!-- Error -->
            <div v-else-if="error" class="error apollo">An error occured</div>

            <!-- Result -->
            <div v-else-if="data" class="result apollo">
                <p class="mt-3">Current Page: {{ page }}</p>

                <gl-table
                    id="accounts-table"
                    hover
                    :current-page="page"
                :items="data.accounts" 
                :fields="fields" 
                :perPage="perPage"
                show-empty>
                    <!-- No records found -->
                    <template #empty="scope">
                    <div class="text-center my-2">{{ scope.emptyText }}</div>
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
import { GlTable } from '@gitlab/ui';
import { GlPagination } from '@gitlab/ui';
import { Component, Vue } from "vue-property-decorator";

@Component({components: {
    GlTable,
    GlPagination
}})

export default class Table extends Vue {
    fields: Array<any> = [
        {
            key: "account",
            label: "Account",
            sortable: true
        },
        {
            key: 'group',
            label: "Group",
            sortable: true
        },
        {
            key: 'network',
            label: 'Network',
            sortable: true,
        },
        {
            key: 'resource',
            label: 'Resource',
            sortable: true,
        },
        {
            key: 'service',
            label: 'Service',
            sortable: true,
        },
        {
            key: 'emsemble',
            label: 'Emsemble',
            sortable: true,
        },
        {
            key: 'description',
            label: 'Description',
            sortable: false,
        }
    ]
    page = 1
    perPage = 10

}
</script>
<style scoped>
/* Some css */
</style>