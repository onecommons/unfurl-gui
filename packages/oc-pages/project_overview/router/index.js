import Vue from 'vue';
import VueRouter from 'vue-router';
import { joinPaths } from '~/lib/utils/url_utility';
import routes from './routes';
import * as routeNames from './constants.js'
import { PageNotFound } from '../../vue_shared/oc-components'
import { filterFromRoutes, createDenyList } from './sign-in-filter'
import { hideLastFlash } from '../../vue_shared/client_utils/oc-flash'

Vue.use(VueRouter);

const isPrivateRoute = createDenyList(
    filterFromRoutes(routes),

    // Deploy flow
    function(to) {
        if(
            to.name != routeNames.OC_PROJECT_VIEW_HOME ||
            !(to.query.ts || to.query.fn || to.query.tn)
        ) return false 

        return true
    }
)

export default function createRouter(base) {
    if(!base)
    throw new Error(`
        Could not initialize router without a projectPath.
        If you are on unfurl-gui, make sure you are running apollo:start before serve so that live/db.json is populated
    `)
    
    const router = new VueRouter({
        mode: 'history',
        base: joinPaths(gon.relative_url_root || '', base),
        routes,
    });


    router.beforeEach((to, from, next) => {
        if(to.name != from.name) {
            hideLastFlash()
        }
        if(!window.gon.current_username) {
            if(isPrivateRoute(to)) {
                setTimeout( () => window.location.href = '/users/sign_in?redirect_to_referer=yes', 1)
                return false
            }
        }
        if(router.app.$store) {
            router.app.$store.getters.getRouterHook(to, from, next)
        }
        else next()
    })

    router.name = 'overview'
    return router;
}
