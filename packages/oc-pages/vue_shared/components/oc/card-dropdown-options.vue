<script>
import { mapGetters } from 'vuex'
import {GlButton, GlDropdown, GlButtonGroup} from '@gitlab/ui'
export default {
    name: 'CardDropdownOptions',
    components: {
        GlButton,
        GlDropdown,
        GlButtonGroup
    },
    props: {
        card: Object
    },
    data() {
    },
    computed: {
        ...mapGetters([
            'getPrimaryCard',
            'userCanEdit',
        ]),

        canShareResource() {
            /*
             * don't require connect implementation, handled by Unfurl
             * https://github.com/onecommons/gitlab-oc/issues/1167
            */
            // const type = this.resolveResourceTypeFromAny(this.card?.type)

            return (
                // type?.implementations?.includes('connect') &&
                this.userCanEdit &&
                this.card?.name &&
                !(this.card?.status == 3 || this.card?.status == 5) && // status is not error or absent
                this.card?.__typename != 'ResourceTemplate' &&
                !this.card.name.startsWith('__') // __ prefix is a hack for unfurl-gui to track external resources
                // && this.card.status == 1 // require OK status
            )
        },

        isPrimary() {
            return this.getPrimaryCard?.name == this.card.name
        },

        controlButtons() {
        }
    }
}
</script>
<template>
    <gl-button-group>
        <gl-button> Foo </gl-button>
        <gl-dropdown right>
        </gl-dropdown>
    </gl-button-group>
</template>
