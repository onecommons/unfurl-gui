<script>
import {mapGetters} from 'vuex'
import {GlIcon, GlBreadcrumb} from '@gitlab/ui'
import BreadcrumbAvatar from './breadcrumb-avatar.vue'
import * as routes from '../router/constants'

export default {
    name: 'DashboardBreadcrumbs',
    components: {GlBreadcrumb, GlIcon, BreadcrumbAvatar},
    props: {
        items: {
            type: Array,
            default: () => []
        }
    },
    computed: {
        ...mapGetters(['getHomeProjectName']),
        _items() {
            return [
                {text: this.getHomeProjectName, to: {name: routes.OC_DASHBOARD_HOME, query: {}}},
                ...this.items
            ]
        }
    }
}
</script>
<template>
    <gl-breadcrumb :items="_items">
        <template #avatar>
            <breadcrumb-avatar />
        </template>
        <template #separator>
            <gl-icon name="chevron-right" />
        </template>
    </gl-breadcrumb>
</template>
