<script>
import {GlButton, GlTooltipDirective} from '@gitlab/ui'
import {DetectIcon, StatusIcon} from 'oc_vue_shared/components/oc'
import {mapGetters, mapActions} from 'vuex'
import {bus} from 'oc_vue_shared/bus'
import { __ } from '~/locale';

// TODO clean up dependency vs requirement in here!

export default {
    name: 'Dependency',
    props: {
        card: Object,
        dependency: Object,
        displayValidation: { type: Boolean, default: true, },
        displayStatus: { type: Boolean, default: false, },
        readonly: { type: Boolean, default: false }

    },
    directives: {
        GlTooltip: GlTooltipDirective, 
    },
    data() {
        return {
            DEFAULT_ACTION_LABEL: null
        }
    },
    components: {
        GlButton,
        DetectIcon,
        StatusIcon,
    },
    computed: {
        ...mapGetters([
            'requirementMatchIsValid',
            'cardIsValid',
            'resolveRequirementMatchTitle',
            'availableResourceTypesForRequirement',
            'getValidConnections',
            'isMobileLayout',
            'resolveResourceTypeFromAny',
            'cardStatus'
        ]),
        dependencyType() {
            return this.resolveResourceTypeFromAny(this.dependency.constraint.resourceType)
        },
        dependencyConstraint() {
            return this.dependency?.constraint || {}

        },
        validConnections() {
            return this.getValidConnections(this.card.name, this.dependency)
        },
        canConnectServices() {
            return (
                this.$route.name != 'templatePage' && (
                    this.$router.name != 'dashboard' ||
                    this.validConnections.length > 0
                )

            )
        },
        hasRequirementsSetter() {
            return Array.isArray(this.$store._actions.setRequirementSelected)
        },
        requirementSatisfied() {
            return this.cardIsValid(this.dependency?.match)
        },
        requirementFilled() {
            return !!this.dependency?.match && this.matchIsValid
        },
        statusIconProps() {
            const size = 16
            const className = []
            let title
            let name
            if(this.requirementFilled && this.requirementSatisfied) {
                className.push('icon-green')
                name = 'check-circle-filled'
                title = 'Complete'
            } else if (this.requirementFilled) {
                name = 'error-filled'
                title = 'Error'
            } else {
                className.push('icon-red')
                name = 'error'
                title = 'Incomplete'
            }
            return {name, size, 'class': className, title}
        },

        actionLabel() {
            const requirement = this.dependency
            if(requirement.match?.startsWith('__')) {
                return 'Disconnect'
            } else if(requirement.match) {
                return 'Remove'
            } else {
                return this.DEFAULT_ACTION_LABEL
            }
        },

        matchIsValid() {
            return this.requirementMatchIsValid(this.dependency)
        },

        completionStatus() {
            const requirement = this.dependency
            if(requirement.match?.startsWith('__')) {
                return 'connected'
            } else if(requirement.match) {
                return 'created'
            } else {
                return null
            }
        },
    },
    methods: {
        ...mapActions([
            'setRequirementSelected',
        ]),

        findElementToScroll({requirement}) {
            bus.$emit('moveToElement', {elId: requirement.match});
        },
        sendRequirement(requirement) {
            if(this.hasRequirementsSetter) {
                this.setRequirementSelected({requirement, titleKey: this.titleKey});  // TODO trying to make this redundant
            }
            
            bus.$emit('placeTempRequirement', {dependentName: this.card.name, dependentRequirement: requirement.name, requirement, action: 'create'});
        },
        openDeleteModal(action=__("Remove")) {
            bus.$emit('deleteNode', {name: this.dependency.match, level: this.level, action, dependentRequirement: this.dependency.name, dependentName: this.card.name});
        },

        connectToResource(requirement) {
            if(this.hasRequirementsSetter) {
                this.setRequirementSelected({dependentName: this.card.name, dependentRequirement: requirement.name, requirement, titleKey: this.titleKey}); // TODO trying to make this redundant
            }
            bus.$emit('launchModalToConnect', {dependentName: this.card.name, dependentRequirement: requirement.name, requirement, action: 'connect'});
        },



    }
}
</script>
<template>
    <div class="oc_table_row">
        <div
            class="table-section oc-table-section section-wrap align_left d-flex justify-content-between align-items-center">
            <div>
                <div class="title d-flex align-items-center">
                    <detect-icon :size="16" class="gl-mr-2 icon-gray" :type="dependencyType" />
                    <span class="oc_requirement_title">{{ dependencyConstraint.title || dependencyConstraint.name }}</span>
                </div>
                <div class="oc_requirement_description">
                    <oc-markdown-view v-if="dependencyConstraint" :content="dependencyConstraint.description" />
                </div>

            </div>
            <div v-if="isMobileLayout && !requirementFilled" class="ml-2 mr-2 validation">
                <detect-icon
                    v-if="displayValidation"
                    v-gl-tooltip.hover
                    v-bind="statusIconProps"
                />
                <span v-if="matchIsValid" class=" oc_resource-details">

                    <a href="#" @click.prevent="findElementToScroll({requirement: dependency}) ">
                        <span v-if="displayStatus">
                            <status-icon :status="cardStatus(dependency.target)" />
                        </span>

                        {{ resolveRequirementMatchTitle(dependency) }}
                    </a>
                </span>
            </div>
        </div>
        <div v-if="!isMobileLayout || requirementFilled"
            class="table-section oc-table-section section-wrap d-flex align-items-center validation"
            :class="{'justify-content-center': !readonly}"
        >
            <detect-icon
                v-if="displayValidation"
                v-gl-tooltip.hover
                v-bind="statusIconProps"
            />

            <span v-if="matchIsValid" class=" oc_resource-details">

                <a href="#" @click.prevent="findElementToScroll({requirement: dependency}) ">
                    <span v-if="displayStatus">
                        <status-icon :status="cardStatus(dependency.target)" />
                    </span>

                    {{ resolveRequirementMatchTitle(dependency) }}
                </a>
            </span>
        </div>

        <div
            v-if="!readonly && matchIsValid"
            class="table-section oc-table-section section-wrap d-flex flex-wrap align-items-center justify-content-end">
            <div style="height: 32px;">
                <gl-button
                    v-if="actionLabel !== 'Disconnect'"
                    title="edit"
                    :aria-label="__(`edit`)"
                    type="button"
                    class="oc_requirements_actions"
                    @click.prevent="findElementToScroll({requirement: dependency})"
                >{{ __('Edit') }}</gl-button>
                <gl-button
                    v-if="actionLabel && !card._deployed"
                    :title="__(completionStatus || DEFAULT_ACTION_LABEL)"
                    :aria-label="__(completionStatus || DEFAULT_ACTION_LABEL)"
                    type="button"
                    :data-testid="`delete-or-disconnect-${card.name}.${dependency.name}`"
                    class="gl-ml-3 oc_requirements_actions"
                    @click.prevent="openDeleteModal(actionLabel)">
                    {{
                        actionLabel
                    }}</gl-button>
            </div>
        </div>
        <!-- TODO get rid of duplication here -->
        <div
            v-else-if="!readonly"
            class="table-section oc-table-section section-wrap d-flex flex-wrap align-items-center justify-content-end">
            <div style="height: 32px;">
                <gl-button
                    v-if="canConnectServices"
                    title="connect"
                    :aria-label="__(`connect`)"
                    type="button"
                    class="oc_requirements_actions"
                    :disabled="validConnections.length == 0"
                    @click.prevent="connectToResource(dependency)"
                >{{ __('Connect') }}</gl-button>

                <gl-button
                    title="create"
                    :aria-label="__(`create`)"
                    type="button"
                    :data-testid="`create-dependency-${card.name}.${dependency.name}`"
                    class="gl-ml-3 oc_requirements_actions"
                    :disabled="availableResourceTypesForRequirement(dependency).length == 0"
                    @click="sendRequirement(dependency)">{{ __('Create') }}</gl-button>
            </div>
        </div>
        <div v-else></div>
    </div>
</template>
<style scoped>
.validation { display: flex; align-items: center; }
.validation > * {margin: 0 0.1em;}

.title {
    height: 16px;
    color: #303030;
    margin-bottom: 0.25em;
}

.oc_table_row {
    display: contents;
}
.oc_requirement_title {
    line-height: 0; 
    font-weight: bold; 
    color: #353545;
}
.gl-dark .oc_requirement_title {
    color: rgba(255, 255, 255) !important;
}
.oc_requirement_description {
    color: #666666;
    height: 1em; /* handle markdown interpreted as paragraph */
}

.gl-dark .oc_requirement_description{
    color: #999;
}
/* TODO fix formily label color
.gl-dark .oc-inputs >>> label {
    color: #999 !important;  
}
*/

.oc-table-section {
    border-bottom-style: solid;
    border-color: #EEEEEE;
    border-width: 1px;
}
.gl-dark .oc-table-section {
    border-color: #777;
    
}
</style>
