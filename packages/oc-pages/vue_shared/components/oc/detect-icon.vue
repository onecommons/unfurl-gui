<script>
import {GlIcon} from '@gitlab/ui'
import {BIconstack} from 'bootstrap-vue'

const DEFAULT = 'pod'

const GL_ICON_MAPPINGS = {
    dns: 'earth',
    mail: 'mail', email: 'mail',
}

const CUSTOM_ICON_MAPPINGS = {
    compute: 'compute',
    mongodb: 'db'
}

function applyTypeToMaping(type, mapping) {
    if(!type) return
    if(typeof type == 'string') {
        return mapping[type.toLowerCase()]
    }
    let result
    result = applyTypeToMaping(type?.name, mapping)
    if(result) return result
    
    if(Array.isArray(type.extends)) {
        for(const tn of type.extends) {
            result = applyTypeToMaping(tn, mapping)
            if(result) return result
        }
    }
}

function detectIcon(type) {
    return applyTypeToMaping(type, GL_ICON_MAPPINGS) || DEFAULT
}

function detectIconCustomSVG(type) {
    return applyTypeToMaping(type, CUSTOM_ICON_MAPPINGS)
}

export default {
    name: 'DetectIcon',
    components: {GlIcon, BIconstack},
    props: {
        type: {
            required: true,
            type: [Object, String]
        }
    },
    computed: {
        detectedIcon() {
            console.log(this.type)
            return detectIcon(this.type)
        },
        customIcon() {
            return detectIconCustomSVG(this.type)
        },
        customStyle() {
            if (this.$attrs.size) {
                return {
                    'font-size': this.$attrs.size + 'px'
                }
            } return null
        }
    }
}
</script>
<template>
    <span :style="customStyle" v-if="customIcon">
        <b-iconstack  v-bind="$attrs" v-on="$listeners">
            <svg v-if="customIcon == 'compute'" version="1.0" viewBox="0 0 206 188" xmlns="http://www.w3.org/2000/svg"><path d="M54.8.819c-1.8.5-4.7 2.4-6.6 4.2-2 1.9-12.4 19.5-25.8 43.2-22.3 39.8-22.4 40-22.4 46s.1 6.2 23.1 47c20.4 36.3 23.5 41.3 27.3 44l4.3 3h96.6l4.3-3c3.8-2.7 6.9-7.7 27.3-44 23-40.8 23.1-41 23.1-47s-.1-6.2-23.1-47c-20.4-36.3-23.5-41.3-27.3-44l-4.3-3-46.6-.2c-26.9-.1-48.1.2-49.9.8zm96.6 10.6c2.4 2.3 35.7 59.8 44 76 2.7 5.3 2.7 8.3 0 13.6-8.3 16.2-41.6 73.7-44 75.9l-2.9 2.8h-91l-2.9-2.8c-2.4-2.2-35.7-59.7-44-75.9-2.7-5.3-2.7-8.3 0-13.6 8.3-16.2 41.6-73.7 44-76l2.9-2.7h91z"/><path d="M80.5 56.2v6.5h-9v9h-13v9h13v9h-13v9h13v9h-13v9h13v9h9v13h9v-13h9v13h9v-13h9v13h9v-13h9v-9h13v-9h-13v-9h13v-9h-13v-9h13v-9h-13v-9h-9v-13h-9v13h-9v-13h-9v13h-9v-13h-9zm45 38v22.5h-45v-45h45z"/><path d="M89.5 94.2v13.5h27v-27h-27z"/></svg>
            <svg v-else-if="customIcon == 'db'" xmlns="http://www.w3.org/2000/svg" fill="currentColor" class="bi bi-hdd-stack" viewBox="0 0 16 16">
                <path d="M14 10a1 1 0 0 1 1 1v1a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1v-1a1 1 0 0 1 1-1h12zM2 9a2 2 0 0 0-2 2v1a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-1a2 2 0 0 0-2-2H2z"/>
                <path d="M5 11.5a.5.5 0 1 1-1 0 .5.5 0 0 1 1 0zm-2 0a.5.5 0 1 1-1 0 .5.5 0 0 1 1 0zM14 3a1 1 0 0 1 1 1v1a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h12zM2 2a2 2 0 0 0-2 2v1a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H2z"/>
                <path d="M5 4.5a.5.5 0 1 1-1 0 .5.5 0 0 1 1 0zm-2 0a.5.5 0 1 1-1 0 .5.5 0 0 1 1 0z"/>
            </svg>
        </b-iconstack>
    </span>
    <gl-icon v-else :name="detectedIcon" v-bind="$attrs" v-on="$listeners" />

</template>
