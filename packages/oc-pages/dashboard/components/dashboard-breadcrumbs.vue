<script>
import {GlIcon, GlBreadcrumb} from '@gitlab/ui'
import BreadcrumbAvatar from './breadcrumb-avatar.vue'
import * as routes from '../router/constants'
import {__} from '~/locale.js'

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
        _items() {
            return [
                {text: __('Dashboard'), to: {name: routes.OC_DASHBOARD_HOME, query: {}}},
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
