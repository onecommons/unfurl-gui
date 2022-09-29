<script>
import createFlash, { FLASH_TYPES } from 'oc_vue_shared/client_utils/oc-flash';
import { __ } from '~/locale';
import gql from 'graphql-tag'
import graphqlClient from '../graphql';
import {GlLoadingIcon} from '@gitlab/ui'


const ERROR_CONTEXT = {
    fetchProjectInfo: 'Failed to load project'
}

export default {
    name: 'MainComponent',
    components: {GlLoadingIcon},
    async beforeCreate() {
        let errorContext

        this.$store.dispatch('populateCurrentUser').catch(() => {})

        let dashboard
        if(dashboard = this.$route.params.dashboard) {
          dashboard = decodeURIComponent(dashboard)

          const namespace = dashboard.split('/').slice(0, -1).join('/')
          console.log({namespace})
          this.$store.commit('setCurrentNamespace', namespace)
        }

        errorContext = 'ocFetchEnvironments'
        this.$store.dispatch('ocFetchEnvironments', {projectPath: this.$store.getters.getHomeProjectPath})
            .catch((err) => {
                console.error('@main.vue', err)
                return createFlash({
                    message: err.message,
                    type: FLASH_TYPES.ALERT,
                    issue: ERROR_CONTEXT[errorContext] || errorContext,
                    projectPath: this.$projectGlobal?.projectPath
                });
            })

        this.$store.dispatch('loadAdditionalDashboards')

        try {
            const {projectPath} = this.$projectGlobal
            // TODO do everything in one query?
            errorContext = 'handleResize'
            this.$store.dispatch('handleResize')
            errorContext = 'fetchProjectInfo'
            await this.$store.dispatch('fetchProjectInfo', { projectPath, defaultBranch: this.$projectGlobal.defaultBranch})
        } catch(err) {
            console.error('@main.vue', err)
            return createFlash({
                message: err.message,
                type: FLASH_TYPES.ALERT,
                issue: ERROR_CONTEXT[errorContext] || errorContext,
                projectPath: this.$projectGlobal?.projectPath
            });
        } finally { 
            this.fetchingComplete = true 
        }
    },

    computed: {
        shouldTestQueries() {
            return location.search == '?test-queries'
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
            createFlash(JSON.parse(flash))
            delete sessionStorage['oc_flash']
        }
    }
}
</script>
<template>
    <gl-loading-icon v-if="!fetchingComplete" label="Loading" size="lg" style="margin-top: 5em;" />
    <div v-else-if="!shouldTestQueries" id="OcAppDeployments">
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
