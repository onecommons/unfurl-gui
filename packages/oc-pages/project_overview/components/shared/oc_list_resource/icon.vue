<script>
import commonMethods from '../../mixins/commonMethods.js'
import {DetectIcon} from 'oc_vue_shared/oc-components'
export default {
    name: 'OcListResourceIcon',
    mixins: [commonMethods],
    components: { DetectIcon },
    props: {
        badge: { type: String },
        alt: { type: String },
        type: { type: [Object, String] },
    },

    computed: {
        remoteSvgIcon() {
            if(!this.badge) return
            try {
                const url = new URL(this.badge)
                const {pathname} = url
                if(pathname.endsWith('.svg'))
                    return url
            }
            catch(e) { }
            return ''
        },

        svgIcon() {
            if(!this.badge) return
            if(this.badge.includes('<svg')) {
                const blob = new Blob([this.badge], {type: 'image/svg+xml'})
                return URL.createObjectURL(blob)
            }
            return ''
        },
    }
}
</script>
<template>
    <div class="oc_resource_icon gl-mr-3">
        <img v-if="remoteSvgIcon" :src="remoteSvgIcon" :alt="alt" />
        <img v-else-if="svgIcon" :src="svgIcon" :alt="alt "/>
        <detect-icon :size="24" class="icon-gray" :type="type" />
        <!--gl-icon :size="24" class="icon-gray" v-else-if="detectIcon(badge)" :name="detectIcon(badge)" :alt="alt"/-->
    </div>

</template>
<style scoped>
.oc_resource_icon {
    width: 24px;
    height: 24px;
}
.oc_resource_icon img {
    width: 100%;
    height: 100%;
}
</style>
