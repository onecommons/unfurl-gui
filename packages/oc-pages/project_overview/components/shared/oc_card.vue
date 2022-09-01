<script>
import { GlButton, GlCard, GlIcon, GlBadge, GlTooltipDirective} from "@gitlab/ui";
import commonMethods from '../mixins/commonMethods';
import {mapGetters} from 'vuex'
import { bus } from 'oc_vue_shared/bus';
import StatusIcon from 'oc_vue_shared/components/oc/Status.vue'
import {DetectIcon} from 'oc_vue_shared/oc-components'
import {generateCardId} from 'oc_vue_shared/util.mjs'

import { __ } from '~/locale';

export default {
    name: "OcCard",
    directives: {
        GlTooltip: GlTooltipDirective, 
    },
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
        readonly: {
            type: Boolean,
            default: false
        },
        customTitle: {
            type: String,
            required: false,
            default: null,
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
        },
        useStatus: {
            type: Number,
            default: null
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
            return generateCardId(this.card?.name)
        },
        ...mapGetters(['isMobileLayout', 'cardIsValid', 'getCardType', 'resolveResourceTypeFromAny']),

        badgeHeaderText() {
            const type = this.getCardType(this.card)
            const result = this.$props.badgeHeader.text || this.resolveResourceTypeFromAny(type)?.title
            return result
        },
        status() {
            return this.useStatus ?? this.card.status
        },

        statusIconProps() {
            const card = this.card
            const isValid = this.cardIsValid(card)

            const size = this.isPrimary? 24: 16
            const className = ['gl-ml-3']
            if(isValid && this.displayValidation) className.push('icon-green')
            let title
            if (this.displayValidation) title = isValid? 'Complete': `${this.customTitle || card.title} is Incomplete`
            const name = isValid? 'check-circle-filled': 'error-filled'
            const isProtected = this.card['protected']
            return {name, size, 'class': className, title, isProtected}
        },

    },
    methods: {

        openDeletemodal(title, action=__("Delete")) {
            // eslint-disable-next-line no-unused-expressions
            const payload = {...this.card, level: this.level, action}
            // TODO get rid of bus
            bus.$emit('deleteNode', payload);

            this.$emit('deleteNode', payload)
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
    <gl-card class="oc-card" :class="{primary: isPrimary}" :header-class="['gl-display-flex',  'header-oc']">
        <template #header>
            <div :id="id" :data-testid="card && ('card-' + card.name)" class="d-flex position-relative w-100 justify-content-between">
                <div class="mr-4 d-flex">
                    <slot name="header">
                        <div v-if="card" class="header-inner align_left gl-display-flex align-items-center flex-one gl-pt-1 m-1">
                            <detect-icon v-if="card && card.type" :size="isPrimary? 24: 18" class="d-flex gl-mr-3 icon-gray" :type="resolveResourceTypeFromAny(card.type)"/>
                            <h4 class="gl-my-0 oc_card_title">{{ customTitle || card.title }}</h4>
                            <detect-icon v-if="displayValidation" v-bind="statusIconProps" />
                            <gl-badge v-if="!isMobileLayout && badgeHeaderText" size="sm" class="gl-tab-counter-badge gl-ml-3 badge-oc-card" >{{ badgeHeaderText }}</gl-badge >
                        </div>
                        <div class="d-flex m-1" v-if="card && displayStatus">
                            <status-icon :size="16" :state="card.state" :status="status" display-text v-bind="statusIconProps" />
                        </div>
                    </slot>
                </div>

                <div class="d-flex align-items-center">
                    <slot name="controls">
                        <gl-button v-if="card && !isPrimary && !readonly && !card._permanent" @click="openDeletemodal" class="controls">
                            <div class="d-flex align-items-center">
                                <gl-icon name="remove" />
                                <div> {{__('Remove')}} </div>
                            </div>
                        </gl-button>

                    </slot>
                    <span class="card-toggle" @click="toggleCard" v-if="!isPrimary">
                        <gl-icon :name="expanded? 'chevron-down': 'chevron-left'" :size="24"></gl-icon>
                    </span>
                </div>
            </div>
        </template>
        <div ref="containerOuter" class="card-content-outer" :class="{active: setHeight}">
            <div ref="container" class="card-content-container" :class="{collapsed: !expanded, active: setHeight}">
                <slot name="content"></slot>
            </div>
        </div>
        <template #footer>
            <div v-if="$slots['footer-controls']" class="d-flex justify-content-end">
                <slot class="float-right" name="footer-controls" />
            </div>
        </template>
    </gl-card>
</template>
<style >
.oc_card_title {
    font-style: normal;
    font-weight: 700;
    font-size: 14px;
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
.header-inner {height: 24px;}
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
    /* I'm not sure why this was important */
    /*padding-top: 2em !important;*/

    padding: 1em;
    max-width: 100%;
}

.card-toggle {
    margin-left: 0.5em;
}

@media only screen and (max-width: 768px) {
    .card-content-container {
        padding: 1em 0;
    }    
    .card-toggle {
        margin-left: 0;
    }
    .oc-card.primary {
        margin-left: -1em;
        margin-right: -1em;
    }

    .oc-card >>> .gl-card-body {
        padding: 0
    }
    .oc-card.primary >>> .gl-card-footer {
        /* TODO move this into global css */
        background: rgb(227, 247, 255);
    }
    .gl-dark .oc-card.primary >>> .gl-card-footer {
        background:  transparent !important;
    }

    .oc-card.primary h4 {
        line-height: 1 !important;
    }

}

.oc-card:not(.primary) >>> .gl-card-body {
    background-color: white; 
    /* sorry Mathew */
}
.gl-dark .oc-card:not(.primary) >>> .gl-card-body {
    background-color: transparent;
}


.oc-card:not(.primary) h4 {
    font-size: 1rem !important;
    line-height: 1rem !important;
}

.oc-card.primary h4 {
    font-size: 1.25rem;
    line-height: 0;
}

.oc-card >>> .gl-card-body {
    background-color: #FBFBFB;
}
.gl-dark .oc-card >>> .gl-card-body {
    background-color: transparent;
}
.oc-card {
    border-color: #DBDBDB !important;
}
.gl-dark .oc-card {
    border-color: #777 !important;
}
:global(.gl-dark) .oc-inputs >>> label {
    color: #999 !important;  
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
