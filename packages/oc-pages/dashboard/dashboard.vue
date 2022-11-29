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
            'updateEnvironment',
            'populateJobsList',
            'populateDeploymentItems',
            'populateCurrentUser',
            'populateDashboardProject',
            'deployInto',
            'createFlash'
        ]),
        ...mapMutations([
            'setCurrentNamespace',
            'setDashboardName',
            'initUserSettings',
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
          } else {
            throw(e)
          }
        }
        this.populateDeploymentItems(this.getDashboardItems)
        this.handleResize()
        
        const flash = sessionStorage['oc_flash']
        if(flash) {
            this.createFlash(JSON.parse(flash))
            delete sessionStorage['oc_flash']
        }

        this.initUserSettings({username: this.getUsername})

        if(sessionStorage['trigger-deployment']) {
          this.deployInto(JSON.parse(sessionStorage['trigger-deployment']))
          delete sessionStorage['trigger-deployment']
        }

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
