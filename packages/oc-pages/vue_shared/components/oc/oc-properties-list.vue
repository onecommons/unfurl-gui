<script>
import {mapGetters} from 'vuex'
import {GlIcon} from '@gitlab/ui'
export default {
    name: 'OcPropertiesList',
    components: {GlIcon},
    data() {
        return {expanded: true}
    },
    props: {
        card: {
            type: Object,
            required: false
        },
        properties: {
            type: Array,
            required: false,
            default() {return []}
        },
        header: String,
        property: String, // TODO validate to only except inputs and outputs
        containerStyle: Object
    },
    computed: {
        ...mapGetters([
        ]),
        _properties() {
            const properties = this.card?.template?.properties || this.card?.properties || this.properties
            return properties
        }
    },
    methods: {
        toggleExpanded() {
            this.expanded = !this.expanded
            const transitionTarget = this.$refs.transitionTarget
            if(this.expanded) {
                transitionTarget.style.marginTop = ''
            } else {
                transitionTarget.style.marginTop = `-${transitionTarget.offsetHeight}px`
            }
        }
    }
}

</script>
<template>

    <div style="max-width: 100%; overflow-x: auto;">
        <div :style="containerStyle" class="properties-list-container">
            <div @click="toggleExpanded" v-if="header" class="header">
                <div>{{header}}</div>
                <gl-icon v-if="_properties.length" :name="expanded? 'chevron-down': 'chevron-left'" :size="18"></gl-icon>
            </div>
            <div ref="transitionTarget" class="properties-list-inner">
                <div class="properties-list-item" v-for="property in _properties" :key="property.name">
                    <div class="name-column">{{property.name}}</div>
                    <div :style="property.valueStyle" class="value-column">
                        <div v-if="property.icon" class="icon-container">
                            <gl-icon :size="12" :name="property.icon" />
                        </div>
                        {{property.value}}

                        <div v-if="property.outboundLink" class="outbound-link-container">
                            <a :href="property.outboundLink" target="_blank" rel="noreferrer noopener">
                                <gl-icon :size="14" name="external-link"/>
                                {{__(property.outboundLinkText)}}
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>

</template>

<style scoped>

.properties-list-container {
    border-radius: 4px;
    background-color: white;
    border-color: #d8d8d8;
    border-style: solid;
    border-width: 2px;
    display: inline-block;
    overflow: hidden;
}

.properties-list-inner {
    transition: margin 0.5s;
}
.properties-list-item {
    display: flex;
    margin: -1px;
    min-width: 22em;
}
.name-column, .value-column {
    padding: 0.75em;
    border-width: 2px;
    border-color: #d8d8d8;
    border-top-style: inherit;
}
.value-column {
    display: flex;
    justify-content: space-between;
}

.properties-list-item:nth-child(n+2) {
    border-top-style: solid;
    border-width: 0;
}
.header {
    z-index: 1;
    position: relative;
    background: #f4f4f4;
    border-color: #d8d8d8;
    border-bottom-style: solid;
    border-width: 2px;
    padding: 0.5em;
    margin: -2px;
    font-size: 1.25em;
    display: flex;
    justify-content: space-between;
}
.name-column {
    font-weight: bold;
    background: #f4f4f4;
    width: 10em;
    border-top-color: white;
    border-right-style: solid;
    color: #585d60;
}
.value-column {
    width: calc(100% - 10em);
    padding-left: 3em; padding-right: 3em;
    color: #666666;
    border-color: #eeeeee;
    position: relative;
}
.icon-container {
    position: absolute;
    left: 1.5em;
    top: calc(50% - 8px);
    align-items: center;
}
.outbound-link-container {
    margin-right: -2em;
    margin-left: 1.5em;
    font-size: 0.9em;
}
</style>
