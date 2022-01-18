<script>
/* eslint-disable vue/no-v-html */
import { GlIcon, GlButton } from '@gitlab/ui';
import createFlash, { FLASH_TYPES } from '~/flash';
import axios from '~/lib/utils/axios_utils';
import { __ } from '~/locale';

export default {
    name: 'HeaderProjectView',
    components: {
        //GlIcon,
        //GlButton,
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
        toggleStar() {
            axios
                .post(this.$projectGlobal.buttonStar.endpoint)
                .then(({ data }) => {
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
                })
                .catch(() => createFlash(__('Star toggle failed. Try again later.')));
        },

        redirectTo(link) {
            window.location.href = link;
        },
    }
}
</script>
<template>
    <div class="project-home-panel js-show-on-project-root gl-my-5">

        <div class="gl-display-flex gl-justify-content-space-between gl-flex-wrap gl-sm-flex-direction-column gl-mb-3">
            <div class="home-panel-title-row gl-display-flex">
                <div class="avatar-container rect-avatar s48 gl-flex-shrink-0 gl-w-11 gl-h-11 gl-mr-3 float-none">
                    <div class="project_icon_oc" v-html="this.$projectGlobal.projectIcon"></div>
                </div>
                <div class="d-flex flex-column flex-wrap align-items-baseline">
                    <div class="d-inline-flex align-items-baseline">
                        <h1 class="oc-home-panel-title gl-mt-0 gl-mb-0">
                            {{projectInfo.name || this.$projectGlobal.projectName}}
                        </h1>
                    </div>
                    <div class="home-panel-metadata d-flex flex-wrap text-secondary gl-font-base gl-font-weight-normal gl-line-height-normal">
                        <div class="button_id_project" v-html="this.$projectGlobal.buttonId" ></div>
                    </div>
                </div>
            </div>
            <!--div class="project-repo-buttons gl-display-flex gl-justify-content-md-end gl-align-items-start gl-flex-wrap gl-mt-3">
                <div class="count-badge d-inline-flex align-item-stretch gl-mr-3 btn-group uf-header-project">
                    <gl-button @click="redirectTo($projectGlobal.linkDeployment)">
                        <gl-icon
                        name="upload"
                        :size="16"
                        />
                        <span>{{ __("Deployments") }}</span>
                    </gl-button>
                    <a :href="this.$projectGlobal.linkDeployment" class="gl-button btn btn-default btn-sm  count">{{ projectInfo.deployments }}</a>
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
                        @click="redirectTo($projectGlobal.buttonFork.link)">
                        <gl-icon
                        name="fork"
                        :size="16"
                        />
                        <span>{{ __("Fork") }}</span>
                    </gl-button>
                    <a :href="this.$projectGlobal.buttonFork.link" class="gl-button btn btn-default btn-sm star-count count">{{ this.$projectGlobal.buttonFork.count }}</a>
                </div>
            </div-->
        </div>
    </div>
</template>
<style scoped>
.project_icon_oc,
.button_id_project {
    width: 100%;
}
.uf-header-project {
    height: 24px;
}
</style>
