<script>
/* eslint-disable vue/no-v-html */
import { GlIcon, GlButton } from '@gitlab/ui';
import OverviewShareModal from './header/overview-share-modal.vue'
import createFlash from 'oc_vue_shared/client_utils/oc-flash';
import axios from '~/lib/utils/axios_utils';
import {mapGetters, mapState} from 'vuex'
import { __ } from '~/locale';

export default {
    name: 'HeaderProjectView',
    components: {
        GlIcon,
        GlButton,
        OverviewShareModal
    },
    props: {
        projectInfo: {
            type: Object,
            required: true,
            default: () => ({}),
        },
    },

    data() {
        return {
            star: {
                count: this.$projectGlobal.buttonStar.count,
                text: this.$projectGlobal.buttonStar.text,
                icon: null,
            }
        }
    },

    methods: {
        async toggleStar() {
            if(!window.gon.current_username) {
                window.location.href = '/users/sign_in?redirect_to_referer=yes'
                return false
            }

            try {
                const {data} = (await axios.post(this.$projectGlobal.buttonStar.endpoint))
                const { star_count } = data;
                // // eslint-disable-next-line babel/camelcase
                this.star.count = star_count;
                // // eslint-disable-next-line babel/camelcase
                if (star_count > this.$projectGlobal.buttonStar.count) {
                    this.star.text = __("Unstar");
                    this.star.icon = 'star';
                } else {
                    this.star.text = __("Star");
                    this.star.icon = 'star-o';
                }
            } catch(e) {
                console.error(e)
                createFlash(__('Star toggle failed. Try again later.'))
            }
        },

        openShareModal() {
            this.$refs.shareModal.visible = true
        },
        redirectTo(link) {
            window.location.href = link;
        },
    },

    computed: {
        ...mapGetters([
            'getApplicationBlueprint'
        ]),
        ...mapState([
            'project'
        ]),
        visitProject() {
            return this.$projectGlobal.treePath
        },
        livePreview() {
            return this.$projectGlobal?.livePreview || this.getApplicationBlueprint?.livePreview
        }
    },

}
</script>
<template>
    <div class="project-home-panel js-show-on-project-root gl-my-5">

        <div class="gl-display-flex gl-justify-content-space-between gl-flex-wrap gl-sm-flex-direction-column gl-mb-3">
            <div class="home-panel-title-row gl-display-flex">
                <div class="avatar-container rect-avatar s48 gl-flex-shrink-0 gl-w-11 gl-h-11 gl-mr-3 float-none">
                    <img v-if="project.globalVars && project.globalVars.projectIcon" :src="project.globalVars.projectIcon" class="w-100" style="object-fit: contain">
                </div>
                <div class="d-flex flex-column flex-wrap align-items-baseline">
                    <div class="d-inline-flex align-items-baseline">
                        <h1 class="oc-home-panel-title gl-mt-0 gl-mb-0">
                            {{projectInfo.title || projectInfo.name}}
                        </h1>
                    </div>
                    <div class="home-panel-metadata d-flex flex-wrap text-secondary gl-font-base gl-font-weight-normal gl-line-height-normal">
                        <a class="view-project-link" :href="visitProject">{{__('View Project')}}</a>
                    </div>
                </div>
            </div>
            <div class="project-repo-buttons gl-display-flex gl-justify-content-md-end gl-align-items-start gl-flex-wrap gl-mt-3">
                <div class="count-badge d-inline-flex align-item-stretch gl-mr-3 uf-header-project uf-deploy-count">
                <gl-icon
                    name="upload"
                    :size="16"
                />
                {{ this.$projectGlobal.deploymentCount }}
                <span>{{ __("Deploys") }}</span>
                </div>
                <div class="count-badge d-inline-flex align-item-stretch gl-mr-3 btn-group uf-header-project">
                    <gl-button
                        class="btn-sm star-btn toggle-star"
                        @click="toggleStar">
                        <gl-icon
                            :name="star.icon? star.icon: this.$projectGlobal.buttonStar.icon"
                            :size="16"
                        />
                        <span>{{ star.text }}</span>
                    </gl-button>
                    <a :href="this.$projectGlobal.buttonStar.link" class="gl-button btn btn-default btn-sm star-count count">{{ star.count }}</a>
                </div>
                <div class="count-badge d-inline-flex align-item-stretch gl-mr-3 btn-group uf-header-project">
                    <gl-button
                        class="btn-sm star-btn toggle-star"
                        @click="openShareModal">
                        <gl-icon
                            name="share"
                            :size="16"
                        />
                        <span>Share</span>
                    </gl-button>
                </div>
                <gl-button v-if="livePreview" :href="livePreview" target="_blank" rel="noreferrer noopener" class="btn-sm ml-1" variant="confirm"> {{__('View Live')}} <gl-icon name="external-link" /></gl-button>
            </div>
        </div>
        <overview-share-modal ref="shareModal" />
    </div>
</template>
<style scoped>
.count-badge {
  align-items: center;
}
.project-repo-buttons {
  align-items: center;
}
.project_icon_oc,
.button_id_project {
    width: 100%;
}
.uf-header-project {
}
.uf-deploy-count {
    font-weight: bold;
}
.uf-deploy-count .gl-icon {
    margin-right: 0.2rem;
}
.uf-deploy-count span {
    margin-left: 0.2rem
}
</style>
