<script>
import { GlTabs, GlTab, GlBadge  } from "@gitlab/ui";
import { __ } from '~/locale';
import commonMethods from './mixins/commonMethods';
import {mapGetters, mapState} from 'vuex'
import {OcTab, DetectIcon} from 'oc_vue_shared/oc-components'

export default {
    name: 'ProjectDescriptionBox',
    components: {
        GlTabs,
        OcTab,
        GlBadge,
        DetectIcon
    },
    mixins: [commonMethods],
    props: {
        projectInfo: {
            type: Object,
            required: false
        },
        inputs: {
            type: Array,
            required: false,
            default: () => {
                return [];
            }
        },
        outputs: {
            type: Array,
            required: false,
            default: () => {
                return [];
            }
        },
        projectImage: {
            type: String,
            required: false,
            default: ""
        },
        projectDescription: {
            type: String,
            required: false,
            default: ""
        },
        liveUrl: {
            type: String,
            required: false,
            default: ""
        },

        projectTitle: {
            type: String,
            required: false,
            default: ""
        },

        projectName: {
            type: String,
            required:false,
            default: __("Fiction Name")
        },
        codeSourceUrl: {
            type: String,
            required: false,
            default: null
        }
    },

    data() {
        return {
            notRecordsFound: __("Not found")
        }
    },

    methods: {
        capitalizeFirstLetter(str) {
            return str.charAt(0).toUpperCase() + str.slice(1);
        },
    },

    computed: {
        ...mapGetters(['getProjectInfo', 'getDisplayableDependenciesByCard', 'getPrimaryCard', 'resolveResourceTypeFromAny']),
        ...mapState(['project']),



        // requirements and extras here use the same method for following buried constraints as in the deployment editor
        // (see oc_list)
        // if there is no primaryDeploymentBlueprint here, primaryCard will not be loaded
        // as a result the old, fallback method will be used

        requirements() {
            const self = this
            const primaryCard = this.getPrimaryCard
            if(!primaryCard?.name) {
                return this.getProjectInfo.primary.requirements.filter(dependency => dependency?.visibility != 'hidden' && (dependency?.min || 0) > 0)
            }

            const requirements = this.getDisplayableDependenciesByCard(this.getPrimaryCard.name).filter(pairing => (pairing.dependency?.constraint?.min || 0) > 0)
            
            return requirements.map(r => {
                const constraint = r.dependency.constraint
                const resourceType = this.resolveResourceTypeFromAny(constraint.resourceType)
                return {...constraint, resourceType}
            })
        },
        extras() {
            const self = this
            const primaryCard = this.getPrimaryCard
            if(!primaryCard?.name) {
                return this.getProjectInfo.primary.requirements.filter(dependency => dependency?.visibility != 'hidden' && (dependency?.min || 0) == 0) || []
            }

            const requirements = this.getDisplayableDependenciesByCard(this.getPrimaryCard.name).filter(pairing => (pairing.dependency?.constraint?.min || 0) == 0)
            
            return requirements.map(r => {
                const constraint = r.dependency.constraint
                const resourceType = this.resolveResourceTypeFromAny(constraint.resourceType)
                return {...constraint, resourceType}
            })
        },
        previewImage() {
            return this.project.globalVars.projectIcon || this.projectImage
        },


        shouldRenderRequirements() { return this.requirements?.length },
        shouldRenderExtras() {return this.extras?.length},
    }
}
</script>
<template>
    <div class="row oc-project-description-box gl-pt-5 gl-pb-5 gl-pl-5 gl-pr-5 gl-mb-6">
        <div class="col-lg-4">
            <div class="row">
                <div v-if="!previewImage" class="image-placeholder-default">
                    {{ __("Screenshot")}}
                </div>
                <img v-else :src="previewImage" :alt="projectInfo.title" class="image-project" />
            </div>
        </div>
        <div class="col-lg-8 right-description">
            <div class="row">
                <div class="col-lg-12">
                    <div class="gl-display-flex">
                        <h4 class="project-title gl-display-flex">
                            {{ getProjectInfo.title || getProjectInfo.name }}
                        </h4>
                        <div class="gl-display-flex">
                            <!--a :href="codeSourceUrl ? codeSourceUrl  : this.$projectGlobal.treePath" class="nav-link gl-align-items-center gl-button btn btn-default uf-button-source" style="height: 30px;">{{ __("Source Code") }}
                                        <gl-icon
                                                name="link"
                                                class="options-expanded-icon gl-ml-1"/>
                            </a-->
                            <!--a class="gl-ml-4" :href="liveUrl ? liveUrl : 'javascript:void(0);'" target="_blank">{{ __("Live preview") }} <gl-icon :size="12" name="external-link" /></a-->
                            <!--gl-button variant="confirm"> {{__('View Live')}} <gl-icon name="external-link" /></gl-button-->
                        </div>
                    </div> 
                    <div class="subtitle-description gl-mb-4">
                        <div class="subtitle"></div>
                        <div class="live-preview">
                        </div>
                    </div>
                    <p class="text-description">{{ projectDescription }}</p>
                </div>
            </div>
            <div class="row">
                <div class="col-lg-12">
                    <gl-tabs>
                        <oc-tab title="Components" :titleCount="requirements.length" v-if="shouldRenderRequirements">
                            <ul class="oc-list-ordered" >
                                <li v-for="(requirement, idx) in requirements" :key="idx" class="gl-mb-4">
                                    <div class="gl-display-flex gl-justify-content-space-between">
                                        <div class="gl-display-flex">
                                            <div class="gl-display-flex align-items-center">
                                                <detect-icon :size="12" :type="requirement.resourceType" />
                                            </div>
                                            <div class="gl-display-flex">
                                                <h6 class="title-gray gl-m-0 gl-p-0 gl-ml-2">{{ requirement.title }}</h6>
                                            </div>
                                        </div>
                                        <div class="gl-display-flex">
                                            <gl-badge v-if="requirement.resourceType.badge" size="sm" class="gl-tab-counter-badge">{{capitalizeFirstLetter(requirement.resourceType.badge)}}</gl-badge> 
                                        </div>
                                    </div>
                                    <div style="margin-left: calc(0.25rem + 12px)" class="gl-mt-2 light-gray">
                                        {{ requirement.description }}
                                    </div>
                                </li>
                            </ul>

                        </oc-tab>
                        <oc-tab title="Extras" :titleCount="extras.length" v-if="shouldRenderRequirements && shouldRenderExtras">
                            <ul class="oc-list-ordered" >
                                <li v-for="(requirement, idx) in extras" :key="idx" class="gl-mb-4">
                                    <div class="gl-display-flex gl-justify-content-space-between">
                                        <div class="gl-display-flex">
                                            <div class="gl-display-flex align-items-center">
                                                <detect-icon :size="12" :type="requirement.resourceType" />
                                            </div>
                                            <div class="gl-display-flex">
                                                <h6 class="title-gray gl-m-0 gl-p-0 gl-ml-2">{{ requirement.title }}</h6>
                                            </div>
                                        </div>
                                        <div class="gl-display-flex">
                                            <gl-badge v-if="requirement.resourceType.badge" size="sm" class="gl-tab-counter-badge">{{capitalizeFirstLetter(requirement.resourceType.badge)}}</gl-badge> 
                                        </div>
                                    </div>
                                    <div style="margin-left: calc(0.25rem + 12px)" class="gl-mt-2 light-gray">
                                        {{ requirement.description }}
                                    </div>
                                </li>
                            </ul>

                        </oc-tab>
                        <oc-tab v-if="shouldRenderRequirements && outputs.length + inputs.length" title="Details" :titleCount="outputs.length + inputs.length">
                            <div v-if="inputs.length">
                                <div class="detail-heading">Inputs</div>
                                <ul class="pl-4" v-if="inputs.length > 0">
                                    <li v-for="(input,idx) in inputs" :key="idx" class="gl-mb-3">
                                        <div class="li-inner">
                                            {{input.title}}
                                            <div v-if="input.description" class="light-gray gl-mt-2">
                                                {{ input.description }}
                                            </div>
                                        </div>
                                    </li>
                                </ul>
                            </div>
                            <div v-if="outputs.length">
                                <div class="detail-heading">Outputs</div>
                                <ul class="pl-4" v-if="outputs.length > 0">
                                    <li v-for="(output,idx) in outputs" :key="idx" class="gl-mb-3">
                                        <div class="li-inner">
                                            {{output.title}}
                                            <div v-if="output.description" class="light-gray gl-mt-2">
                                                {{ output.description }}
                                            </div>
                                        </div>
                                    </li>
                                </ul>
                            </div>


                        </oc-tab>
                    </gl-tabs>
                </div>
            </div>
        </div>
    </div>
</template>


<style scope>
.li-inner {
    margin-left: -0.25em;
    color: #4A5053;
}
.detail-heading {
    color: #404040;
    font-weight: 600;
    font-size: 1.14em;
    line-height: 20px;
    margin-bottom: 0.4em;
}
.oc-project-description-box {
    box-sizing: border-box;
    flex-grow: 0;
    margin: 0px 0px;
    border-radius: 4px;
    padding-left: 0px;
    padding-right: 0px;
}
.oc-source-code-button {
    max-width: 130px;
}
.image-project {
    width: 300px;
    height: 300px;
    object-fit: cover;
}
.image-placeholder-default {
    background: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' version='1.1' preserveAspectRatio='none' viewBox='0 0 100 100'><line x1='0' y1='0' x2='100' y2='100' stroke='rgb(240,240,240,1)' vector-effect='non-scaling-stroke'/><line x1='0' y1='100' x2='100' y2='0' stroke='rgb(240,240,240,1)' vector-effect='non-scaling-stroke'/></svg>");
    background-repeat: no-repeat;
    background-position: center center;
    background-size: 100% 100%, auto;
    background-color: $gray-10;
    min-height: 315px;
    width: 100%;
    text-align: center;
    vertical-align: middle;
    line-height: 315px;
    font-weight: 400;
    font-size: 12px;
    color: $gray-500;
    border: 1px solid #BFBFBF;
}

.text-description {
    font-size: 1rem;
    margin-bottom: 0.5em;
    font-weight: 400;
}
.oc-list-ordered {
    margin: 0px;
    padding: 0px;
    font-weight: 400;
    list-style-type: none;
}

.subtitle-description {
    display: flex;
}
.subtitle,
.project-title {
    flex: 1;
}

.uf-button-source {
    margin-top: -.3em;
}

.title-gray {
    color: #404040;
    font-weight: normal;
}

.light-gray {
    color: #868686;
}
</style>
