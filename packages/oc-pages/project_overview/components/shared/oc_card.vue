<script>
import { GlCard, GlIcon, GlBadge} from "@gitlab/ui";
import commonMethods from '../mixins/commonMethods';
import {mapGetters} from 'vuex'
import { bus } from '../../bus.js';
import StatusIcon from '../../../vue_shared/components/oc/Status.vue'

import { __ } from '~/locale';

export default {
    name: "OcCard",
    components: {
        GlCard,
        GlIcon,
        GlBadge,
        StatusIcon
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
        ...mapGetters(['cardIsValid', 'getCardType']),

        badgeHeaderText() {
            const result = this.$props.badgeHeader.text || this.getCardType(this.card)
            return result
        }

    },
    methods: {

        openDeletemodal(title, action=__("Delete")) {
            // eslint-disable-next-line no-unused-expressions
            bus.$emit('deleteNode', {...this.card, level: this.level, action});
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
            <slot name="header">
                <div :id="id" :data-testid="'card-' + card.name" class="align_left gl-display-flex flex-one gl-pt-1">
                    <gl-icon :size="16" class="gl-mr-3 gl-mt-1 icon-gray" :name="detectIcon(badgeHeaderText)" />
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
                <div v-if="displayStatus">
                    <status-icon :size="16" :state="card.state" :status="card.status" />
                </div>
            </slot>
            <slot name="controls"></slot>
            <div @click="toggleCard" class="ml-2" v-if="card.dependentName">
                <gl-icon :name="expanded? 'chevron-down': 'chevron-left'" :size="24"></gl-icon>
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
    overflow: hidden;
}

.card-content-container {
    padding: 2em;
    padding-bottom: 1em;
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
    padding: 0;
}
</style>
