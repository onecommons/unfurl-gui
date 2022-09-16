<script>
import createFlash, { FLASH_TYPES } from 'oc_vue_shared/client_utils/oc-flash';
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
            'updateEnvironment',
            'populateJobsList',
            'populateDeploymentItems',
            'populateCurrentUser',
            //'applyUserSetting'
        ]),
        ...mapMutations([
            'setCurrentNamespace',
            'initUserSettings',
        ])
    },
    computed: {
        ...mapGetters([
            'isDashboardLoaded',
            'getDashboardItems',
            'getHomeProjectPath',
            'getUsername',
            //'totalDeploymentsCount',
            //'environmentsCount',
        ]),
        /*
        ...mapState([
            'user_settings'
        ])
         */
    },
    async mounted() {
        const pathComponents = this.$router.options.base.split('/');
        while(pathComponents.length > 0 && pathComponents[0] == '') pathComponents.shift();
        const currentNamespace = pathComponents.includes('dashboard')? 
            pathComponents.slice(0, Math.max(0, pathComponents.lastIndexOf('dashboard'))).join('/'):
            pathComponents.slice(1).join('/');
        this.setCurrentNamespace(currentNamespace);
        this.populateCurrentUser()

        try {
          await Promise.all([this.loadDashboard(), this.populateJobsList()])
        } catch(e) {
          if(currentNamespace != this.getUsername) {
            notFoundError()
          } else {
            throw(e)
          }
        }
        this.populateDeploymentItems(this.getDashboardItems)
        this.handleResize()
        
        const flash = sessionStorage['oc_flash']
        if(flash) {
            createFlash(JSON.parse(flash))
            delete sessionStorage['oc_flash']
        }

        this.initUserSettings({username: this.getUsername})

        /*
        const shouldRedirectToExplore = (
            this.totalDeploymentsCount + this.environmentsCount == 0 &&
            !this.user_settings[USER_TOURED_EXPLORE_PAGE] &&
            !window.gon.unfurl_gui
        )
        if(shouldRedirectToExplore) {
            createFlash({message: 'Redirecting to our blueprints catalog...', type: FLASH_TYPES.NOTICE})
            window.location.href = '/explore'

            this.applyUserSetting({key: USER_TOURED_EXPLORE_PAGE, value: true})
        }
         */

        this.isLoaded = true
    }
}
</script>
<template>
    <div>
        <gl-loading-icon v-if="!isLoaded" label="Loading" size="lg" style="margin-top: 5em;" />
        <router-view v-else-if="!doNotRender"/>
    </div>
</template>
<style>

@media (min-width: 768px) {
    .layout-page.hide-when-top-nav-responsive-open.page-with-contextual-sidebar.page-with-icon-sidebar {
        padding-left: 3em;
    }
}

.container-fluid.limit-container-width .flash-container.sticky, .limit-container-width.container-sm .flash-container.sticky, .limit-container-width.container-md .flash-container.sticky, .limit-container-width.container-lg .flash-container.sticky, .limit-container-width.container-xl .flash-container.sticky {
    max-width: 100%;
}

.container-limited.limit-container-width:not(.gl-banner-content) {
    max-width: min(100vw, max(80%, 990px));
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
