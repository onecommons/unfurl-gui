<script>
import { FLASH_TYPES } from 'oc_vue_shared/client_utils/oc-flash';
import {mapActions, mapMutations, mapGetters, mapState} from 'vuex'
import {lookupCloudProviderAlias} from 'oc_vue_shared/util.mjs'
import {deleteEnvironmentByName} from 'oc_vue_shared/client_utils/environments'
import {notFoundError} from 'oc_vue_shared/client_utils/error'
import {GlLoadingIcon} from '@gitlab/ui'
import * as routes from './router/constants'
const USER_TOURED_EXPLORE_PAGE = 'USER_TOURED_EXPLORE_PAGE'
export default {
    name: 'Dashboard',
    data() {return {isLoaded: false, doNotRender: false}},
    components: {GlLoadingIcon},
    methods: {
        ...mapActions([
            'loadDashboard',
            'handleResize',
            'populateJobsList',
            'populateDeploymentItems',
            'populateCurrentUser',
            'populateDashboardProject',
            'fetchMergeRequests',
            'deployInto',
            'createFlash'
        ]),
        ...mapMutations([
            'setCurrentNamespace',
            'setDashboardName',
            'initUserSettings',
            'createError',
        ])
    },
    computed: {
        ...mapGetters([
            'isDashboardLoaded',
            'getDashboardItems',
            'getHomeProjectPath',
            'getUsername',
        ]),
    },
    async mounted() {
        this.initUserSettings({username: this.getUsername})

        const pathComponents = this.$router.options.base.split('/').filter(s => s);
        const currentNamespace = pathComponents.slice(0, -1).join('/')

        this.setCurrentNamespace(currentNamespace);
        this.setDashboardName(pathComponents[pathComponents.lastIndex])
        this.populateCurrentUser()
        this.populateDashboardProject()



        try {
            await Promise.all([this.loadDashboard(), this.populateJobsList()])
        } catch(e) {
            if(currentNamespace != this.getUsername) {
                notFoundError()
                console.error('displaying 404 for ', e)
            } else {
                throw(e)
            }
        }

        this.fetchMergeRequests() // not awaiting

        this.populateDeploymentItems(this.getDashboardItems)
        this.handleResize()
        
        const flash = sessionStorage['oc_flash']
        if(flash) {
            this.createFlash(JSON.parse(flash))
            delete sessionStorage['oc_flash']
        }


        if(sessionStorage['trigger-deployment']) {
            // we need to await this because our updates all have a shared global state
            // the user can potentially initiate other update operations while one or more of this trigger's subrequests are in flight
            try {
                const context = JSON.parse(sessionStorage['trigger-deployment'])
                await this.deployInto(context)
                delete sessionStorage['trigger-deployment']
            } catch(e) {
                this.createError({
                    message: `Failed to trigger queued deployment: ${e.message}`,
                    context,
                })
            }
        }

        this.isLoaded = true
    }
}
</script>
<template>
    <div>
        <oc-experimental-settings-indicator />
        <oc-unfurl-gui-errors />
        <gl-loading-icon v-if="!isLoaded" label="Loading" size="lg" style="margin-top: 5em;" />
        <router-view v-else-if="!doNotRender"/>
    </div>
</template>
