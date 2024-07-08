import Vue from 'vue';
import VueRouter from 'vue-router';
import { joinPaths } from '~/lib/utils/url_utility';
import routes from './routes';
import * as routeNames from './constants.js'
import _ from 'lodash'
import { PageNotFound } from 'oc_vue_shared/components/oc'
import { filterFromRoutes, createDenyList } from './sign-in-filter'
import { FLASH_TYPES, hideLastFlash } from 'oc_vue_shared/client_utils/oc-flash'
import { HIDDEN_OPTION_KEYS, lookupKey, setLocalStorageKey, clearMatchingStorage, unfurlServerUrlDev, unfurlServerUrlOverride } from 'oc_vue_shared/storage-keys.js'
import { setTransientUnfurlServerOverride, getTransientUnfurlServerOverride, healthCheckIfNeeded } from 'oc_vue_shared/client_utils/unfurl-server'

Vue.use(VueRouter);

const PERSISTED_QUERY_PARAMS = ['blueprintPath']

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
    `)

    const router = new VueRouter({
        mode: 'history',
        base: joinPaths(gon.relative_url_root || '', base),
        routes,
    });

    router.onReady(() => {
        // hack to share router
        if(sessionStorage['unfurl-gui:route']) {
            const route = JSON.parse(sessionStorage['unfurl-gui:route'])

            router.replace(route)
            delete sessionStorage['unfurl-gui:route']
        }

    })

    const { isNavigationFailure, NavigationFailureType } = VueRouter

    router.og = {
        push: router.push.bind(router),
        replace: router.replace.bind(router),
        resolve: router.resolve.bind(router)
    }

    for(const fn of ['push', 'replace']) {
        router[fn] = _.debounce(function(...args) {
            console.log(fn, ...args)
            return router.og[fn](...args).catch(e => {
                if (!isNavigationFailure(e, NavigationFailureType.redirected)) {
                    Promise.reject(e)
                }
            })
        }, 10)
    }

    router.resolve = function(to, ...args) {
        const from = router.currentRoute
        for(const param of PERSISTED_QUERY_PARAMS) {
            if(from.query.hasOwnProperty(param) && !to.query.hasOwnProperty(param)) {
                to.query[param] = from.query[param]
            }
        }
        return router.og.resolve(to, ...args)
    }

    router.beforeEach((to, from, next) => {
        let modified = false
        const modifiedTo = {...to}
        for(const param of PERSISTED_QUERY_PARAMS) {
            if(from.query.hasOwnProperty(param) && !to.query.hasOwnProperty(param)) {
                modifiedTo.query[param] = from.query[param]
                modified = true
            }
        }

        setTransientUnfurlServerOverride(null)
        if(to.name != from.name) {
            hideLastFlash()
        }
        if(!window.gon.current_username && !window.gon.unfurl_gui) {
            if(isPrivateRoute(to)) {
                setTimeout( () => window.location.href = '/users/sign_in?redirect_to_referer=yes', 1)
                next(false)
                return false
            }
        }

        let _next
        if(modified) _next = (_a, ...rest) => next(modifiedTo, ...rest)
        else _next = next


        if(typeof router.app.$store?.getters?.getRouterHook == 'function') {
            router.app.$store.getters.getRouterHook(to, from, _next)
        }
        else _next()
    })

    router.afterEach(async (to) => {
        if(to.query.hasOwnProperty('unfurl-server-url') || to.query.hasOwnProperty('unfurl-server')) {
            const devUrl = to.query['unfurl-server-url'] || to.query['unfurl-server']
            if(devUrl) {
                let currentUrl
                try {
                    currentUrl = JSON.parse(lookupKey(HIDDEN_OPTION_KEYS.unfurlServerUrlDev)).url
                } catch(e) {}

                // currently not clearing session for switching users
                if(currentUrl != devUrl) {
                    if(currentUrl) {
                        clearMatchingStorage(/ufsv_dev/)
                    }

                    setLocalStorageKey(HIDDEN_OPTION_KEYS.unfurlServerUrlDev, {project: base, url: devUrl})

                    if(!unfurlServerUrlDev(base)) {
                        router.app.$store.commit('createError', {
                            message: `Failed to set Unfurl Server URL - '${devUrl}' is likely an invalid URL`,
                            severity: 'major'
                        })
                        setLocalStorageKey(HIDDEN_OPTION_KEYS.unfurlServerUrlDev, undefined)
                    }
                }
            } else {
                clearMatchingStorage(/ufsv_dev/)
                setLocalStorageKey(HIDDEN_OPTION_KEYS.unfurlServerUrlDev, undefined)
            }
        }


        const developmentMode = unfurlServerUrlDev(base) && !unfurlServerUrlOverride()
        const url = unfurlServerUrlDev(base)

        if(developmentMode) {
            try {
                await healthCheckIfNeeded(base)
                const newRoute = router.resolve({...to, query: {...to.query, 'unfurl-server-url': '', 'unfurl-server': undefined}}).href
                const message =  `Developing with Unfurl Server on ${url}`
                const linkTo = newRoute
                const linkTarget = '_self'
                const linkText = 'End development session'
                router.app.$store.dispatch('createFlash', {message, linkTo, linkText, linkTarget, type: FLASH_TYPES.WARNING})

                // Uncomment to restore previous behavior of using local server only while editing.
                // const editView = [routeNames.OC_PROJECT_VIEW_EDIT_DEPLOYMENT, routeNames.OC_PROJECT_VIEW_DRAFT_DEPLOYMENT].includes(to.name)
                // if(editView) {
                if(true) {
                    setTransientUnfurlServerOverride(unfurlServerUrlDev(base))
                }
            } catch(e) {
                console.error(e)
                router.app.$store.commit('createError', {
                    // e.message is useless
                    message: `An error occurred while connecting to Unfurl Server: ${e.message}`,
                    // message: `An error occurred while connecting to Unfurl Server`,
                    context: {
                        'Unfurl Server URL': url,
                    },
                    severity: 'critical'
                })
                clearMatchingStorage(/ufsv_dev/)
                clearMatchingStorage(/unfurl-server-url-dev/)
            }
        }

    })
    router.name = 'overview'
    return router;
}
