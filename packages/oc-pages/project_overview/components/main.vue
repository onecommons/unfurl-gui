<script>

import { FLASH_TYPES } from 'oc_vue_shared/client_utils/oc-flash';
import { __ } from '~/locale';
import * as routes from '../router/constants'
import {getOrFetchDefaultBranch} from 'oc_vue_shared/client_utils/projects'

export default {
    name: 'MainComponent',
    // TODO move this into page level components
    async beforeCreate() {

        let completePromise
        this.$store.commit('initUserSettings', {username: this.$store.getters.getUsername})

        this.$store.dispatch('syncGlobalVars', this.$projectGlobal)

        let dashboard
        if(dashboard = this.$route.params.dashboard) {
            dashboard = decodeURIComponent(dashboard)

            const pathComponents = dashboard.split('/')
            const namespace = pathComponents.slice(0, -1).join('/')
            const dashboardName = pathComponents[pathComponents.lastIndex]

            if(!window.gon.home_project) {
                this.$store.commit('setCurrentNamespace', namespace)
                this.$store.commit('setDashboardName', dashboardName)
            }
        }

        if(
            gon.current_user_id &&
            this.$store.getters.getHomeProjectPath &&
            this.$route.name != routes.OC_PROJECT_VIEW_CREATE_TEMPLATE
        ) {
            this.$store.dispatch('populateCurrentUser').catch(() => {})

            const includeDeployments = ![
                routes.OC_PROJECT_VIEW_DRAFT_DEPLOYMENT, routes.OC_PROJECT_VIEW_EDIT_DEPLOYMENT
            ].includes(this.$route.name)

            const projectPath = this.$store.getters.getHomeProjectPath
            const branch = this.$route.query.branch || await getOrFetchDefaultBranch(encodeURIComponent(projectPath))

            const fetchEnvironments = this.$store.dispatch('ocFetchEnvironments', {projectPath, branch, includeDeployments, only: !includeDeployments && this.$route.params.environment})
                .catch(err => {
                    console.error('@main.vue', err)
                    this.$store.commit(
                        'createError',
                        {
                            message: err.message,
                            context: {
                                projectPath,
                                branch,
                                includeDeployments
                            },
                            severity: 'critical'
                        },
                        {root: true}
                    )
                })

            completePromise = fetchEnvironments

            if(!includeDeployments) {
                const environmentName = this.$route.params.environment
                const deploymentName = this.$route.params.slug
                completePromise = fetchEnvironments
                    .then(() => {
                        if(this.$store.getters.lookupDeployPath(deploymentName, environmentName)) {
                            return this.$store.dispatch('fetchDeployment', {projectPath, branch, deploymentName, environmentName})
                        }
                    })
                    .catch(err => {
                        console.error('@main.vue', err)
                        this.$store.commit(
                            'createError',
                            {
                                message: err.message,
                                context: {
                                    projectPath,
                                    branch,
                                    includeDeployments,
                                    environmentName,
                                    deploymentName
                                },
                                severity: 'critical'
                            },
                            {root: true}
                        )
                    })
            }
        }
        try {
            const {projectPath} = this.$projectGlobal
            // TODO do everything in one query?
            this.$store.dispatch('handleResize')
        } catch(err) {
            console.error('@main.vue', err)
            return this.$store.commit(
              'createError',
              {
                message: err.message,
                severity: 'major'
              }
            );
        } finally {
            await completePromise

            // declare environment as ready
            // environment readiness doesn't make sense in the context of editing a blueprint
            // this should be refactored
            if(this.$route.name == routes.OC_PROJECT_VIEW_CREATE_TEMPLATE) {
                this.$store.commit('setReady', true)
            }

            this.fetchingComplete = true
        }
    },

    data() {
        return {
            fetchingComplete: false
        }
    },
    mounted() {
        const flash = sessionStorage['oc_flash']
        if(flash) {
            this.$store.dispatch('createFlash', JSON.parse(flash))
            delete sessionStorage['oc_flash']
        }
    }
}
</script>
<template>
    <!-- <gl-loading-icon v-if="!fetchingComplete" label="Loading" size="lg" style="margin-top: 5em;" /> -->
    <div id="OcAppDeployments">
        <oc-experimental-settings-indicator />
        <oc-unfurl-gui-errors />
        <router-view v-if="fetchingComplete"/>
    </div>
</template>
<style>
#OcAppDeployments {
    font-style: normal;
}
button.dropdown-item:disabled {
    color: #9b9b9b;
}

.container-limited.limit-container-width:not(.gl-banner-content) {
    max-width: min(1100px, max(60%, 990px));
    display: flex;
    justify-content: center;
}

.container-limited.limit-container-width:not(.gl-banner-content) > * {
    width: 100%;
}

main {
    min-width: min(990px, 100%);
    max-width: 100vw;
}
</style>
