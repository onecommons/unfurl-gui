<script>
import { GlCard, GlIcon, GlBadge } from "@gitlab/ui";
import commonMethods from '../mixins/commonMethods';
import { bus } from 'oc/project_overview/bus';

import { __ } from '~/locale';

export default {
    name: "OcCard",
    components: {
        GlCard,
        GlIcon,
        GlBadge,
    },
    mixins: [commonMethods],
    props: {
        customTitle: {
            type: String,
            required: false,
            default: __("OC Card"),
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
        }
    },
    methods: {

        openDeletemodal(title, action=__("RemoveFromElipsis")) {
            // eslint-disable-next-line no-unused-expressions
            bus.$emit('deleteNode', {title, level: this.level, titleKey: this.customTitle, action});
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
            <div class="align_left gl-display-flex flex-one gl-pt-1">
                <gl-icon v-if="mainCardClass === ''" :size="16" class="gl-mr-3 gl-mt-1 icon-gray" :name="detectIcon(badgeHeader.text)" />
                <h4 class="gl-my-0 oc_card_title">{{ customTitle }}</h4>
                <gl-icon
                v-if="iconTitle"
                :size="14"
                :class="['gl-ml-3', 'gl-mt-1', iconColor]"
                :name="iconName"
                />

                <gl-badge
                v-if="badgeHeader.isActive && badgeHeader.text !== ''"
                size="sm"
                class="gl-tab-counter-badge gl-ml-3 badge-oc-card"
                >{{ badgeHeader.text }}</gl-badge
                >
            </div>
            <div v-if="actions" class="dropdown more-actions">
                <button title="More actions" data-toggle="dropdown" type="button" class="btn note-action-button more-actions-toggle btn btn-transparent btn-default btn-sm gl-button btn-default-tertiary btn-icon" aria-expanded="false">
                    <gl-icon
                    :size="16"
                    name="ellipsis_v"
                    />
                </button> 
                <ul class="dropdown-menu more-actions-dropdown" style="">
                    <li role="presentation" class="gl-new-dropdown-item">
                        <a role="menuitem" target="_self" href="javascript: void(0);" class="dropdown-item">
                            <div class="gl-new-dropdown-item-text-wrapper">
                                <p class="gl-new-dropdown-item-text-primary">{{ __("Rename") }}</p> 
                            </div>
                        </a>
                    </li> 
                    <li role="presentation" class="gl-new-dropdown-item js-btn-copy-note-link">
                        <button data-clipboard-text="onecommons.org" role="menuitem" type="button" class="dropdown-item">
                            <div class="gl-new-dropdown-item-text-wrapper">
                                <p class="gl-new-dropdown-item-text-primary">{{ __("Advance view") }}</p> 
                            </div>
                        </button>
                    </li>
                    <li role="presentation" class="gl-new-dropdown-item">
                        <button data-testid="assign-user" role="menuitem" type="button" class="dropdown-item">
                            <div class="gl-new-dropdown-item-text-wrapper"
                                @click="openDeletemodal(customTitle)"
                            ><p class="gl-new-dropdown-item-text-primary">{{ __("Delete") }}</p> 
                            </div> 
                        </button>
                    </li>
                </ul>
            </div>
            <div v-else class="dropdown more-actions">
                <span>{{ __("Advanced view") }}</span>
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