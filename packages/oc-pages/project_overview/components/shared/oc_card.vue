<script>
import { GlCard, GlIcon, GlBadge, GlDropdown, GlDropdownItem} from "@gitlab/ui";
import commonMethods from '../mixins/commonMethods';
import {mapGetters} from 'vuex'
import { bus } from '../../bus.js';

import { __ } from '~/locale';

export default {
    name: "OcCard",
    components: {
        GlCard,
        GlIcon,
        GlBadge,
        GlDropdown,
        GlDropdownItem
    },
    mixins: [commonMethods],
    props: {
        customTitle: {
            type: String,
            required: false,
            default: __("OC Card"),
        },
        card: {
            type: Object,
            required: false,
        },
        iconTitle: {
            type: Boolean,
            required: false,
            default: false
        },
        iconName: {
            type: String,
            required: false,
            default: "warning-solid",
        },
        iconColor: {
            type: String,
            required: false,
            default: "icon-red",
        },
        badgeHeader: {
            type: Object,
            required: false,
            default: () => {
            return {
                isActive: false,
                text: "",
                }
            }
        },
        actions: {
            type: Boolean,
            required: false,
        },

        level: {
            type: Number,
            required: false,
            default: 1,
        },

        mainCardClass: {
            type: String,
            required: false,
            default: ''
        },
        dependent: {
            type: Object,
            required: false,
            default: () => {name: 'primary'}
        }
    },
    data() {
        return {
        title: null,
        iconSection: false,
        };
    },
    computed: {
        primaryPropsDelete() {
            return {
                text: __("Delete"),
                attributes: [{ category: "primary" }, { variant: "danger" }],
            };
        },

        cancelProps() {
            return {
                text: __("Cancel"),
            };
        },
        id() {
            return btoa(this.card.name).replace(/=/g, '')
        },
        ...mapGetters(['cardIsValid'])
    },
    methods: {

        openDeletemodal(title, action=__("Delete")) {
            // eslint-disable-next-line no-unused-expressions
            bus.$emit('deleteNode', {...this.card, level: this.level, action});
        },

        getLegend(title) {
            return `Are you sure you want to delete <b>${title}</b> ? Deleting <b>${title}</b> might affect other (nodes ?) which are linked to it.`;
        },
    }
};

</script>
<template>
    <gl-card :header-class="['gl-display-flex',  'header-oc', mainCardClass]">
        <template #header>
            <div :id="id" :data-testid="'card-' + card.name" class="align_left gl-display-flex flex-one gl-pt-1">
                <gl-icon v-if="mainCardClass === ''" :size="16" class="gl-mr-3 gl-mt-1 icon-gray" :name="detectIcon(badgeHeader.text)" />
                <h4 class="gl-my-0 oc_card_title">{{ customTitle }}</h4>
                <gl-icon
                v-if="iconTitle"
                :size="14"
                :class="['gl-ml-3', 'gl-mt-1', cardIsValid(card)? 'icon-green': 'icon-red']"
                :name="cardIsValid(card)? 'check-circle-filled': 'warning-solid'"
                />

                <gl-badge
                v-if="badgeHeader.isActive && badgeHeader.text !== ''"
                size="sm"
                class="gl-tab-counter-badge gl-ml-3 badge-oc-card"
                >{{ badgeHeader.text }}</gl-badge
                >
            </div>
            <div class="dropdown-container">
                <gl-dropdown
                    v-if="actions"
                    text="More actions"
                    icon="ellipsis_v"
                    textSrOnly
                    size="small"
                    :block="false"
                    :disabled="false"
                    no-caret=""
                    category="tertiary"
                    >
                    <gl-dropdown-item>
                        {{ __("Rename") }}
                    </gl-dropdown-item>
                    <gl-dropdown-item>
                        <!--$button data-clipboard-text="onecommons.org" role="menuitem" type="button" class="dropdown-item"-->
                        {{ __("Advance view") }}
                    </gl-dropdown-item>
                    <gl-dropdown-item @click="openDeletemodal(customTitle)">
                        <!--button  data-testid="assign-user" role="menuitem" type="button" class="dropdown-item"-->
                            {{ __("Delete") }}
                    </gl-dropdown-item>


                </gl-dropdown>
            <div v-else class="dropdown more-actions">
                <span>{{ __("Advanced view") }}</span>
            </div>
            </div>
        </template>
        <slot :class="'contenido-oc'" name="content"></slot>
    </gl-card>

</template>
<style >
.oc_card_title {
    font-style: normal;
    font-weight: 700;
    font-size: 14px;
    line-height: 20px;
}
.card_advance_view {
    font-size: 14px;
    line-height: 16px;
    text-align: right;
}
.flex-one {
    flex: 1;
}
.primary-card ~ .gl-card-body {
	background-color: #EEEEEE38 !important;
}
.primary-card .oc_card_title {
	font-size: 18px !important;
}
.badge-oc-card {
    background: #DBDBDB !important;
    color: #525252;
    font-weight: normal !important;
}
</style>

<style scoped>
/*issue with line height on other header items*/
.dropdown-container >>> button.dropdown-toggle {
    margin: -0.5rem 0;
}
</style>
