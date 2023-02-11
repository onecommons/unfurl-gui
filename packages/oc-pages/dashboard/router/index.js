import Vue from 'vue';
import VueRouter from 'vue-router';
import {baseRouteNaive} from './base-route';
import { joinPaths } from '~/lib/utils/url_utility';
import routes from './routes';
import { PageNotFound } from 'oc/vue_shared/components/oc'
import * as ROUTES from './constants'

Vue.use(VueRouter);
routes.push({ path: "*", component: PageNotFound })

const base = baseRouteNaive(window.location.pathname);

// no longer relevant?
const delimiter = /*base.includes('dashboard')? '': */'/-'


const navigationElements = {
    dashboard:  document.querySelector(`aside.nav-sidebar li a[href$="${base}"]`)?.parentElement,
    environments: document.querySelector('aside.nav-sidebar li a[href$="environments"]')?.parentElement,
    deployments: document.querySelector('aside.nav-sidebar li a[href$="deployments"]')?.parentElement
}

const navigationElementRouteMapping = {
    dashboard: ROUTES.OC_DASHBOARD_HOME,
    environments: ROUTES.OC_DASHBOARD_ENVIRONMENTS_INDEX,
    deployments: ROUTES.OC_DASHBOARD_DEPLOYMENTS_INDEX
}


export default function createRouter() {
    /*
    if(!base)
    throw new Error(`
        Could not initialize router without a projectPath.
        If you are on unfurl-gui, make sure you are running apollo:start before serve so that live/db.json is populated
    `)
    */


    const router = new VueRouter({
        mode: 'history',
        base: base,
        routes: routes.map(route => ({...route, path: route.path.replace('$DELIMITER', delimiter)})),
    });


    try {
        for(const [key, navigationElement] of Object.entries(navigationElements)) {
            navigationElement.onclick = e => {
                e.preventDefault()
                router.push({name: navigationElementRouteMapping[key]})
            }
        }
    } catch(e) {
        console.error('Could not create router links on side navigation;', e.message)
    }


    router.name = 'dashboard'

    // #!if false

    router.beforeEach((to, from, next) => {
        try {
            let navigationElement
            switch(to.name) {
                case ROUTES.OC_DASHBOARD_DEPLOYMENTS_INDEX:
                case ROUTES.OC_DASHBOARD_DEPLOYMENTS:
                    navigationElement = 'deployments'
                    break
                case ROUTES.OC_DASHBOARD_ENVIRONMENTS_INDEX:
                case ROUTES.OC_DASHBOARD_ENVIRONMENTS:
                    navigationElement = 'environments'
                    break
                default:
                    navigationElement = 'dashboard'
            }

            Object.entries(navigationElements).forEach(([name, value]) => {
                if(name == navigationElement) {
                    value.className = 'active'
                } else {
                    value.className = ''
                }
            })
        } catch(e) {
            console.error("Couldn't set class on side navigation;", e.message)
        }
        if(typeof router.app.$store?.getters?.getRouterHook == 'function') {
            router.app.$store.getters.getRouterHook(to, from, next)
        }
        else next()

    })
    
    // #!endif

    return router;
}
