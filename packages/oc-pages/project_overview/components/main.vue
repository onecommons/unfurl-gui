<script>
import { FLASH_TYPES } from 'oc_vue_shared/client_utils/oc-flash';
import { __ } from '~/locale';
import gql from 'graphql-tag'
import graphqlClient from '../graphql';


const ERROR_CONTEXT = {
    fetchProjectInfo: 'Failed to load project'
}

export default {
    name: 'MainComponent',
    // TODO move this into page level components
    async beforeCreate() {
        let errorContext

        this.$store.commit('initUserSettings', {username: this.$store.getters.getUsername})

        this.$store.dispatch('syncGlobalVars', this.$projectGlobal)

        let dashboard
        if(dashboard = this.$route.params.dashboard) {
          dashboard = decodeURIComponent(dashboard)

          const pathComponents = dashboard.split('/')
          const namespace = pathComponents.slice(0, -1).join('/')
          const dashboardName = pathComponents[pathComponents.lastIndex]
          this.$store.commit('setCurrentNamespace', namespace)
          this.$store.commit('setDashboardName', dashboardName)
        }

        if(gon.current_user_id) {
            this.$store.dispatch('populateCurrentUser').catch(() => {})
            errorContext = 'ocFetchEnvironments'
            this.$store.dispatch('ocFetchEnvironments', {projectPath: this.$store.getters.getHomeProjectPath, branch: this.$route.query.branch || 'main'})
                .catch((err) => {
                    console.error('@main.vue', err)
                    this.$store.dispatch(
                        'createFlash',
                        {
                            message: err.message,
                            type: FLASH_TYPES.ALERT,
                            issue: ERROR_CONTEXT[errorContext] || errorContext,
                            projectPath: this.$projectGlobal?.projectPath
                        },
                        {root: true}
                    );
                })

            /*
             * This shouldn't be needed, but this will load additional dashboards the user has access to in the background
             * for users with a higher number of dashboard memberships, this will slow down requests that are needed to render the view
            this.$store.dispatch('loadAdditionalDashboards')
                .catch(() => {})
             */
        }
        try {
            const {projectPath} = this.$projectGlobal
            // TODO do everything in one query?
            errorContext = 'handleResize'
            this.$store.dispatch('handleResize')
        } catch(err) {
            console.error('@main.vue', err)
            return this.$store.dispatch(
              'createFlash',
              {
                message: err.message,
                type: FLASH_TYPES.ALERT,
                issue: ERROR_CONTEXT[errorContext] || errorContext,
                projectPath: this.$projectGlobal?.projectPath
              }
            );
        } finally { 
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
        <router-view />
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
