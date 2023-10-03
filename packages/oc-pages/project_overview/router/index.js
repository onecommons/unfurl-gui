import Vue from 'vue';
import VueRouter from 'vue-router';
import { joinPaths } from '~/lib/utils/url_utility';
import routes from './routes';
import * as routeNames from './constants.js'
import { PageNotFound } from 'oc_vue_shared/components/oc'
import { filterFromRoutes, createDenyList } from './sign-in-filter'
import { FLASH_TYPES, hideLastFlash } from 'oc_vue_shared/client_utils/oc-flash'
import { HIDDEN_OPTION_KEYS, lookupKey, setLocalStorageKey, unfurlServerUrlDev, unfurlServerUrlOverride } from 'oc_vue_shared/storage-keys.js'
import { setTransientUnfurlServerOverride, getTransientUnfurlServerOverride } from 'oc_vue_shared/client_utils/unfurl-server'

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
        setTransientUnfurlServerOverride(null)
        if(to.name != from.name) {
            hideLastFlash()
        }
        if(!window.gon.current_username) {
            if(isPrivateRoute(to)) {
                setTimeout( () => window.location.href = '/users/sign_in?redirect_to_referer=yes', 1)
                return false
            }
        }
        if(typeof router.app.$store?.getters?.getRouterHook == 'function') {
            router.app.$store.getters.getRouterHook(to, from, next)
        }
        else next()
    })

    router.afterEach(to => {
        if(to.query.hasOwnProperty('unfurl-server-url')) {
            const devUrl = to.query['unfurl-server-url']
            if(devUrl) {
                setLocalStorageKey(HIDDEN_OPTION_KEYS.unfurlServerUrlDev, {project: base, url: devUrl})
            } else {
                setLocalStorageKey(HIDDEN_OPTION_KEYS.unfurlServerUrlDev, undefined)
            }
        }

        const editView = [routeNames.OC_PROJECT_VIEW_EDIT_DEPLOYMENT, routeNames.OC_PROJECT_VIEW_DRAFT_DEPLOYMENT].includes(to.name)
        const developmentMode = unfurlServerUrlDev(base) && !unfurlServerUrlOverride()
        const url = unfurlServerUrlDev(base)

        if(developmentMode) {
            const newRoute = router.resolve({...to, query: {...to.query, 'unfurl-server-url': ''}}).href
            const message =  `Developing with Unfurl Server on ${url}`
            const linkTo = newRoute
            const linkTarget = '_self'
            const linkText = 'End development session'
            router.app.$store.dispatch('createFlash', {message, linkTo, linkText, linkTarget, type: FLASH_TYPES.WARNING})

            if(editView) {
                setTransientUnfurlServerOverride(unfurlServerUrlDev(base))
            }

        }

    })
    router.name = 'overview'
    return router;
}
