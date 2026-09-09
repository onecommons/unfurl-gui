<script>
import {mapGetters} from 'vuex'
import {GlBreadcrumb} from '@gitlab/ui'
import * as routes from '../router/constants'
import {sectionLinkProps} from '../router/section-link'

export default {
    name: 'DashboardBreadcrumbs',
    components: {GlBreadcrumb},
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
                {avatarPath: document.querySelector('.project-avatar')?.src, text: this.getHomeProjectName, ...sectionLinkProps(this.$router, {name: routes.OC_DASHBOARD_HOME, query: {}})},
                ...this.items
            ]
        }
    }
}
</script>
<template>
    <gl-breadcrumb class="oc-breadcrumbs" :items="_items" />
</template>
<style>
.oc-breadcrumbs img.gl-avatar {
    border-radius: 50% !important;
    width: 12px;
    height: 12px;
}
</style>
