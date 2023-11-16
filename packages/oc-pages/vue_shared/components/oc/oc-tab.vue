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
        titleTestid: {
            type: String,
            default: () => null
        }
    },
    computed: {
        active() {
            return this.$refs.tab.$children[0]?.localActive
        }
    }
}
</script>
<template>
    <gl-tab ref="tab" class="gl-mt-3" v-on="$listeners">
        <template slot="title">
            <span :data-testid="titleTestid">{{ __(title)}}</span>
            <gl-badge v-if="!(isNaN(parseInt(titleCount)))" size="sm" class="gl-tab-counter-badge">
                {{ titleCount }}
            </gl-badge>
        </template>
        <div class="pt-2 mb-2">
            <slot></slot>
        </div>
    </gl-tab>

</template>
