<script>
import {GlTab, GlBadge} from '@gitlab/ui'
export default {
    name: 'OcTab',
    components: {GlTab, GlBadge},
    props: {
        title: {
            required: true,
            type: String,
        },
        titleCount: [Number, String],
    }
}
</script>
<template>
    <gl-tab class="gl-mt-3">
        <template slot="title">
            <span>{{ __(title)}}</span>
            <gl-badge v-if="!(isNaN(parseInt(titleCount)))" size="sm" class="gl-tab-counter-badge">
                {{ titleCount }}
            </gl-badge>
        </template>
        <slot></slot>
    </gl-tab>

</template>
