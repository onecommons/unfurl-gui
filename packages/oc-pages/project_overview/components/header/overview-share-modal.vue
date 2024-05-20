<script>

const QUERY_PARAM = 'share'
const DEPLOY_BUTTON_PARAM = 'deploy-btn'

import Vue from 'vue'
import _ from 'lodash'
import { mapState } from 'vuex'
import {compatibilityUnfurlBadgeUrlBuilder as initUnfurlBadgeUrlBuilder} from 'oc_vue_shared/compat'

import { GlModal } from '@gitlab/ui'

const enabled = !window.gon.unfurl_gui

export default {
    name: 'OverviewShareModal',
    components: {
        GlModal
    },
    data() {
        return {
            imageEl: null, encodedButtonParams: '',
            baseTitle: enabled && document.querySelector('title').textContent,
            enabled
        }
    },
    methods: {
        setButtonParams() {
            this.encodedButtonParams = new URL(this.imageEl.src).search
        },
        onImageChanged() {
            this.setButtonParams()
        },
        updateTitle() {
            const val = this.encodedButtonParams
            let newTitle = this.baseTitle
            if(this.visible) {
                newTitle += ' Share'
                if(val && val != '?type=default') {
                    const params = Array.from(val.match(/(\w+=\w+)/g))
                    .filter(p => p != 'type=default')
                    newTitle += ' (' + params.join(', ') + ')'
                }
            }

            document.querySelector('title').textContent = newTitle
        }
    },
    watch: {
        visible: {
            async handler(val) {
                if(val) {
                    let imageEl
                    while(!(imageEl = document.querySelector('#js-uf-badge-img > img'))) {
                        await Vue.nextTick()
                    }

                    initUnfurlBadgeUrlBuilder()
                    imageEl.onload = this.onImageChanged.bind(this)
                    this.imageEl = imageEl
                    this.setButtonParams()

                }

                this.updateTitle()
            },
            immediate: enabled
        },
        encodedButtonParams: {
            handler(val) {
                const query = {...this.$route.query}
                if(val && val != '?type=default') {
                    query[DEPLOY_BUTTON_PARAM] = val
                } else {
                    delete query[DEPLOY_BUTTON_PARAM]
                }
                if(! _.isEqual(query, this.$route.query)) {
                    // replace instead of push, because this isn't a two-way binding
                    this.$router.replace({...this.$route, query})
                }

                this.updateTitle()
            }
        }
    },
    computed: {
        ...mapState(['project']),
        visible: {
            get() {
                return this.$route.query.hasOwnProperty(QUERY_PARAM)
            },
            set(val) {
                const query = {...this.$route.query}

                for(const param of [QUERY_PARAM, DEPLOY_BUTTON_PARAM]) {
                    if(val) { query[param] = null }
                    else { delete query[param] }
                }

                if(! _.isEqual(query, this.$route.query)) {
                    this.$router.push({...this.$route, query})
                }
            },
        },
    },
    //data() {}
}
</script>
<template>
<gl-modal v-if="enabled" modalId="overview-share-modal" title="Create an embeddable 'Deploy With Unfurl' button for this blueprint." :visible="visible" @hidden="visible = false">
    <div v-html="project.globalVars.badgeSettings">  </div>
</gl-modal>
</template>
