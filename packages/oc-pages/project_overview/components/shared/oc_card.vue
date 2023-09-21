<script>
import { GlButton, GlCard, GlIcon, GlBadge, GlTooltipDirective} from "@gitlab/ui";
import commonMethods from '../mixins/commonMethods';
import {mapGetters} from 'vuex'
import { bus } from 'oc_vue_shared/bus';
import StatusIcon from 'oc_vue_shared/components/oc/Status.vue'
import {DetectIcon} from 'oc_vue_shared/components/oc'
import {generateCardId} from 'oc_vue_shared/util'
import {Tooltip as ElTooltip} from 'element-ui'

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
        DetectIcon,
        ElTooltip
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
        childClass: {
            default: () => ({}),
            required: false,
            type: Object
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
        },
        tooltip: String,
        children: {
            type: Array,
            required: false,
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
        ...mapGetters([
            'isMobileLayout',
            'cardIsValid',
            'getCardType',
            'resolveResourceTypeFromAny',
            'getDeployments',
            'getDeploymentDictionary',
            'getDeployment',
            'getCardsInTopology'
        ]),

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
            const className = []
            if(isValid && this._displayValidation) className.push('icon-green')
            let title
            if (this._displayValidation && !this.tooltip) title = isValid? 'Complete': `${this.customTitle || card.title} is Incomplete`
            const name = isValid? 'check-circle-filled': 'error-filled'
            const isProtected = this.card['protected']
            return {name, size, 'class': className, title, isProtected}
        },

        _readonly() {
            return this.readonly || this.card?.imported || this.card?.readonly
        },

        _displayValidation() {
            return this.displayValidation && ! this._readonly
        },

        _displayStatus() {
            return this.displayStatus || this._readonly
        },

        importedResource() {
            if(!this.card?.imported) return null
            const [deploymentName, resourceName] = this.card.imported.split(':', 2)
            const deployment = deploymentName?
                this.getDeployments.find(dep => dep.name == deploymentName) :
                this.getDeployment

            if(!deployment) return null

            const dict = this.getDeploymentDictionary(deployment.name, deployment._environment)
            const resource = dict['Resource'][resourceName]

            // resolve the template here, since it's not in our other dictionary
            return {...resource, template: dict['ResourceTemplate'][resource.template]}
        },

        _card() {
            if(this.importedResource) {
                return {...this.card, ...this.importedResource, imported: this.card.imported}
            }
            return this.card
        },

        childAttrs() {
            const attrs = {}

            for(const key of ['displayValidation', 'displayStatus', 'readonly', 'childClass']) {
                attrs[key] = this[key]
            }

            return attrs
        },

        _children() {
            return this.children ?? this.getCardsInTopology(this.card.name)
        }
    },
    methods: {

        onDeleteNode(...args) {
            this.$emit('deleteNode', ...args)
        },

        openDeletemodal(title, action=__("Delete")) {
            // eslint-disable-next-line no-unused-expressions
            const payload = {...this.card, action}
            // TODO get rid of bus
            bus.$emit('deleteNode', payload);

            this.$emit('deleteNode', payload)
        },

        adaptWidth() {
            const container = this.$refs.container
            if(!container) return
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
                <div class="d-flex oc-card-header justify-content-between w-100">
                    <slot name="header">
                        <div v-if="card" class="align_left gl-display-flex align-items-center flex-one flex-wrap">
                            <div class="d-flex pt-1 pb-1 gl-mr-3">
                                <detect-icon v-if="card && card.type" :size="isPrimary? 24: 18" class="d-flex gl-mr-2 icon-gray" :type="resolveResourceTypeFromAny(card.type)"/>
                                <h4 class="gl-my-0 oc_card_title">{{ customTitle || _card.title }}</h4>
                            </div>
                            <el-tooltip :disabled="!tooltip">
                                <template #content>
                                    <div>
                                        {{tooltip}}
                                    </div>
                                </template>

                                <detect-icon v-if="_displayValidation" v-bind="statusIconProps" />
                            </el-tooltip>
                            <div v-if="_displayStatus" class="d-flex pt-1 pb-1 badges-container">
                                <slot name="status">
                                    <gl-badge v-if="!isMobileLayout && badgeHeaderText" size="md" class="gl-tab-counter-badge gl-mr-3" >
                                        <detect-icon :size="16" name="tag"/>
                                        <div class="ml-1">{{ badgeHeaderText }}</div>

                                    </gl-badge>
                                    <status-icon :size="16" :state="card.state" :status="status" :card="card" display-text v-bind="statusIconProps" />
                                </slot>
                            </div>
                        </div>

                    </slot>
                    <div class="d-flex align-items-center">
                        <slot name="controls" v-bind="card">
                            <gl-button v-if="card && !isPrimary && !_readonly && !card._permanent && !card._deployed" @click="openDeletemodal" class="controls">
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

            </div>
        </template>
        <div ref="containerOuter" class="card-content-outer" :class="{active: setHeight}">
            <div ref="container" class="card-content-container" :class="{collapsed: !expanded, active: setHeight}">
                <slot name="content" v-bind="card"></slot>

                <div v-if="_children.length > 0">
                    <!-- could also be v-on="$listeners" -->
                    <oc-card
                            v-for="card in _children"
                            :key="card.name"
                            :card="card"
                            @deleteNode="onDeleteNode"
                            v-bind="childAttrs"
                            :class="childClass"
                    >
                        <template #child-controls="card">
                            <slot name="child-controls" v-bind="card" />
                        </template>
                        <template #child-content="card">
                            <slot name="child-content" v-bind="card"/>
                        </template>
                        <template #controls="card">
                            <slot name="child-controls" v-bind="card" />
                        </template>
                        <template #content="card">
                            <slot name="child-content" v-bind="card"/>
                        </template>
                    </oc-card>
                </div>
            </div>
        </div>
        <template v-if="$slots['footer-controls']" #footer>
            <div class="d-flex justify-content-end">
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
.primary-card .oc_card_title {
	font-size: 18px !important;
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
    display: inline-flex;
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
}

.oc-card.primary h4 {
    font-size: 1.25rem;
    margin-bottom: -0.1em;
    display: inline-flex;
    align-items: center;
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
:global(.gl-dark .oc-inputs label) {
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

.oc-card >>> .oc-card-header > * {
  min-height: 32px;
  margin-bottom: -0.914px;
}

.oc-card >>> .oc-card-header .gl-badge.md {
  padding-top: 0.125rem;
  padding-bottom: 0.125rem;
}

.oc-card >>> .gl-card-header {
  display: flex;
  align-items: center;
}

.oc-card.primary > .gl-card-header .badges-container {
    transform: scale(1.1);
    border-style: solid;
    border-width: 0 1em;
    border-color: transparent;
}

</style>
