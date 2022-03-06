<script>
import { GlButton, GlCard, GlIcon, GlBadge} from "@gitlab/ui";
import commonMethods from '../mixins/commonMethods';
import {mapGetters} from 'vuex'
import { bus } from '../../bus.js';
import StatusIcon from '../../../vue_shared/components/oc/Status.vue'
import {DetectIcon} from '../../../vue_shared/oc-components'

import { __ } from '~/locale';

export default {
    name: "OcCard",
    components: {
        GlButton,
        GlCard,
        GlIcon,
        GlBadge,
        StatusIcon,
        DetectIcon
    },
    mixins: [commonMethods],
    props: {
        isPrimary: {
            type: Boolean,
            default: false
        },
        customTitle: {
            type: String,
            required: false,
            default: __("OC Card"),
        },
        card: {
            type: Object,
            required: false,
        },
        badgeHeader: {
            type: Object,
            required: false,
            default: () => {
                return {
                    isActive: false,
                    text:"",
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
        displayValidation: {
            type: Boolean,
            default: true,
        },
        displayStatus: {
            type: Boolean,
            default: false,
        }

    },
    data() {
        return {
            title: null,
            iconSection: false,
            expanded: true,
            setHeight: false,
        };
    },
    updated() {
        this.adaptWidth()
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
        ...mapGetters(['cardIsValid', 'getCardType', 'resolveResourceType']),

        badgeHeaderText() {
            const result = this.$props.badgeHeader.text || this.getCardType(this.card)
            return result
        }

    },
    methods: {

        openDeletemodal(title, action=__("Delete")) {
            // eslint-disable-next-line no-unused-expressions
            const payload = {...this.card, level: this.level, action}
            // TODO get rid of bus
            bus.$emit('deleteNode', payload);

            this.$emit('deleteNode', payload)
        },

        getLegend(title) {
            return `Are you sure you want to delete <b>${title}</b> ? Deleting <b>${title}</b> might affect other (nodes ?) which are linked to it.`;
        },

        adaptWidth() {
            const container = this.$refs.container
            if(!this.expanded) {
                container.style.marginTop = `-${container.offsetHeight}px` 
            } else {
                container.style.marginTop = '0px'
            }
        },

        toggleCard(e) {
            if (!this.setHeight) {
                this.adaptWidth()
                requestAnimationFrame(this.toggleCard)
                this.setHeight = true
                return 
            } 
            this.expanded = !this.expanded
            this.adaptWidth()
        }
    }
};

</script>
<template>
    <gl-card :header-class="['gl-display-flex',  'header-oc']">
        <template #header>
            <div class="position-relative w-100">
                <div class="mr-4 d-flex">
                    <slot name="header">
                        <div :id="id" :data-testid="'card-' + card.name" class="align_left gl-display-flex align-items-center flex-one gl-pt-1 m-1">
                            <detect-icon v-if="card && card.type" :size="18" class="gl-mr-3 gl-mt-1 icon-gray" :type="resolveResourceType(card.type)"/>
                            <h4 class="gl-my-0 oc_card_title">{{ card.title || customTitle}}</h4>
                            <gl-icon
                                v-if="displayValidation"
                                :size="14"
                                :class="['gl-ml-3', 'gl-mt-1', cardIsValid(card)? 'icon-green': 'icon-red']"
                                :name="cardIsValid(card)? 'check-circle-filled': 'warning-solid'"
                                />
                            <gl-badge
                            size="sm"
                            class="gl-tab-counter-badge gl-ml-3 badge-oc-card"
                            >{{ badgeHeaderText }}</gl-badge
                            >
                        </div>
                        <div class="m-1" v-if="displayStatus">
                            <status-icon :size="16" :state="card.state" :status="card.status" />
                        </div>
                    </slot>
                </div>

                <div class="position-absolute d-flex" style="right: 0; top: 0;">
                    <slot name="controls">
                        <gl-button @click="openDeletemodal" class="controls">
                            <div class="d-flex align-items-center">
                                <svg width="16" height="16" viewBox="0 0 15 17" stroke="#DBDBDB;" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path fill-rule="evenodd" clip-rule="evenodd" d="M4.26558 2.04999C4.26558 0.917811 5.20857 0 6.37181 0H8.47805C9.64129 0 10.5843 0.917811 10.5843 2.04999V3.07498H13.7436C14.3252 3.07498 14.7967 3.53389 14.7967 4.09998C14.7967 4.66606 14.3252 5.12497 13.7436 5.12497H13.5816L12.8401 14.5071C12.7557 15.5752 11.8407 16.3999 10.7401 16.3999H4.10979C3.0092 16.3999 2.09417 15.5752 2.00976 14.5071L1.26825 5.12497H1.10623C0.524613 5.12497 0.0531158 4.66606 0.0531158 4.09998C0.0531158 3.53389 0.524612 3.07498 1.10623 3.07498H4.26558V2.04999ZM6.37181 3.07498H8.47805V2.04999H6.37181V3.07498ZM3.38071 5.12497L4.10979 14.3499L10.7401 14.3499L11.4692 5.12497H3.38071Z" fill="#4A5053"/>
                                </svg>
                                <div> {{__('Remove')}} </div>
                            </div>
                        </gl-button>

                    </slot>
                    <div @click="toggleCard" class="ml-2" v-if="!isPrimary">
                        <gl-icon :name="expanded? 'chevron-down': 'chevron-left'" :size="24"></gl-icon>
                    </div>
                </div>
            </div>
        </template>
        <div ref="containerOuter" class="card-content-outer" :class="{active: setHeight}">
            <div ref="container" class="card-content-container" :class="{collapsed: !expanded, active: setHeight}">
                <slot name="content"></slot>
            </div>
        </div>
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
.card-content-outer {
    overflow-y: hidden;
    max-width: 100%;
}

.card-content-container {
    padding-top: 2em !important;
    padding: 1em;
    max-width: 100%;
}

@media only screen and (max-width: 768px) {
    .card-content-container {
        padding: 1em 0;
    }    
}

.card-content-container.active {
    transition: margin-top 0.5s;
}

/*
.card-content-container.collapsed {
    transform: translate(0%, -100%);
}
*/

.card-content-container >>> .gl-card-body {
    padding: 0 1em;
}

.controls {
    padding: 0.4em;
    margin: 0 0.25em;
}
</style>
