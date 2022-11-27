<script>
import {mapGetters} from 'vuex'
import {GlIcon} from '@gitlab/ui'
import {DetectIcon, Status} from 'oc_vue_shared/oc-components'
import {JSONView} from 'vue-json-component'
import Redacted from './redacted.vue'

export default {
    name: 'OcPropertiesList',
    components: {GlIcon, Status, 'json-view': JSONView, Redacted, DetectIcon},
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
        schema: {
            type: Object
        },
        header: String,
        property: String,
        containerStyle: Object
    },
    computed: {
        ...mapGetters([
            'lookupEnvironmentVariable',
            'windowWidth'
        ]),
        _properties() {
            // TODO handle this gracefully when we don't have an environment loaded
            const properties = this.property? this.card[this.property] : this.card?.template?.properties || this.card?.properties || this.properties
            return properties.map(prop => {
                if (prop.value?.get_env) return {...prop, value: this.lookupEnvironmentVariable(prop.value?.get_env)}
                return prop
            })
        },
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
        },
        isUrl(value) {
            const regex = new RegExp(/https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,4}\b([-a-zA-Z0-9@:%_\+.~#?&//=]*)/gi)
            return regex.test(value)
        },
        isEmail(value) {
            const regex = new RegExp(/[a-z0-9]+@[a-z]+\.[a-z]{2,3}/)
            return regex.test(value)
        },
        formatName(property) {
            let result  = property.name
            if(this.schema?.properties) {
                const title = this.schema.properties[property.name]?.title
                if(title) result = title
            }

            return result.replaceAll('_', ' ')
        },
        isSensitive(property) {
            if(this.schema?.properties) {
                const sensitive = this.schema.properties[property.name]?.sensitive ?? null

                if(sensitive !== null) return sensitive
            }

            return property.sensitive
        },
        tableSizingHack() {
            // TODO use CSS grid instead
            this.$nextTick(() => {
                try {
                    const headerWidth = this.$refs.header?.clientWidth
                    const nameColumnWdith = this.$refs.transitionTarget.querySelector('td.name-column')?.clientWidth
                    if(!(headerWidth && nameColumnWdith)) return
                    this.$refs.transitionTarget.style.width = headerWidth + 'px'
                    this.$refs.transitionTarget.querySelectorAll('td.value-column').forEach(cell => {
                        cell.style.width = (headerWidth - nameColumnWdith - 30) + 'px'
                    })
                    this.$refs.transitionTarget.style.tableLayout = 'fixed'
                } catch(e) {console.error(e)}
            })

        }
    },
    watch: {
        windowWidth() { this.tableSizingHack() },
        properties() { this.tableSizingHack() },

    },
    mounted() {
        this.tableSizingHack()
    }
}

</script>
<template>
    <div style="max-width: 100%; overflow-x: auto;">
        <div :style="containerStyle" class="properties-list-container">
            <div @click="toggleExpanded" v-if="header" class="header" ref="header">
                <slot name="header-text">
                    <div>{{header}}</div>
                </slot>
                <div>
                    <slot name="header-controls"></slot>
                    <gl-icon v-if="_properties.length" :name="expanded? 'chevron-down': 'chevron-left'" :size="18"></gl-icon>
                </div>
            </div>
            <table ref="transitionTarget" class="properties-list-inner" style="display: table; width: 100%;">
                <tr style="display: table-row" class="properties-list-item" v-for="property in _properties" :key="property.name">
                    <td class="name-column">{{formatName(property)}}</td>
                    <td :style="property.valueStyle" class="value-column">
                        <div style="display: flex; justify-content: space-between;">
                            <slot :name="property.name" v-bind="property.value">
                                <div v-if="property.status" style="margin-left: calc(-12px - 0.25rem)">
                                    <Status :status="property.status" :state="property.state" :size="14" display-text />
                                </div>
                                <div v-else style="width: 100%">
                                    <div v-if="property.icon" class="icon-container">
                                        <detect-icon :size="14" :name="property.icon" />
                                    </div>
                                    <json-view
                                        v-if="property.value && typeof property.value == 'object'"
                                        :data="property.value"
                                        :rootKey="property.name"
                                    />
                                    <a v-else-if="property.url || isUrl(property.value)" :href="property.url || property.value" rel="noopener noreferrer" target="_blank" >{{ property.value }}</a>
                                    <a v-else-if="isEmail(property.value)" :href="`mailto:${property.value}`" rel="noopener noreferrer" target="_blank">{{ property.value }}</a>

                                    <Redacted v-else-if="isSensitive(property)" :value="property.value" />

                                    <span v-else>
                                        {{property.value}}
                                    </span>
                                </div>
                                <div v-if="property.outboundLink" class="outbound-link-container d-flex">
                                    <a :href="property.outboundLink" target="_blank" rel="noreferrer noopener" style="display: contents">
                                        <detect-icon class="mr-1" :size="14" name="external-link"/>
                                        {{__(property.outboundLinkText)}}
                                    </a>
                                </div>
                            </slot>
                    </div>
                    </td>
                </tr>
            </table>
        </div>
    </div>

</template>

<style scoped>

.properties-list-container {
    border-radius: 4px;
    background-color: white;
    border-color: #d8d8d8;
    border-style: solid;
    border-width: 1px;
    display: inline-block;
    overflow: hidden;
}

.gl-dark .properties-list-container {
    background-color: #121212;
    border-color: #626464;
}

.properties-list-inner {
    transition: margin 0.5s;
    width: 100%;
    table-layout: auto;
}
.properties-list-item {
    margin: -1px;
    min-width: min(100%, 22em);
}
.name-column, .value-column {
    padding: 0.75em;
    border-width: 1px;
    border-color: #d8d8d8;
    border-top-style: inherit;
    display: table-cell;
}
.gl-dark .name-column, .value-column {
    border-color: #626464;
}

.properties-list-item:nth-child(n+2) {
    border-top-style: solid;
    border-width: 0;
}
.header {
    z-index: 1;
    position: relative;
    background: #fafafa;
    border-color: #d8d8d8;
    border-bottom-style: solid;
    border-width: 1px;
    padding: 0.5em;
    margin: -1px;
    font-size: 1.25em;
    display: flex;
    justify-content: space-between;
}

.gl-dark .header {
    background: #232931;
    border-color: #626464;
    color: #ffffffde;
}

.name-column {
    font-weight: bold;
    background: #fafafa;
    border-top-color: white;
    border-right-style: solid;
    color: #585d60;
}
.gl-dark .name-column {
    background: #171920;
    border-top-color: #626464;
    color: #ffffffde;
}

.value-column {
    padding-left: 3em; padding-right: 3em;
    color: #666666;
    border-color: #eeeeee;
    position: relative;
}
.gl-dark .value-column {
    border-color: #626464;
    position: relative;
    color: #ffffffde;
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

.gl-dark .json-view-item {
    filter: invert(1) hue-rotate(180deg) brightness(1.1);
}
</style>
