import Vue from 'vue';
import VueRouter from 'vue-router';
import { joinPaths } from '~/lib/utils/url_utility';
import routes from './routes';
import { PageNotFound } from '../../vue_shared/oc-components'
import * as ROUTES from './constants'

Vue.use(VueRouter);
routes.push({ path: "*", component: PageNotFound })

const navigationElements = {
    dashboard:  document.querySelector('aside.nav-sidebar li a[href="/dashboard"]')?.parentElement,
    environments: document.querySelector('aside.nav-sidebar li a[href="/dashboard/environments"]')?.parentElement,
    deployments: document.querySelector('aside.nav-sidebar li a[href="/dashboard/deployments"]')?.parentElement
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
        base: joinPaths(gon.relative_url_root || '', `dashboard`),
        routes,

    });


    router.name = 'dashboard'

    // #!if false

    router.beforeEach((to, from, next) => {
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
        next()
    })
    
    // #!endif

    return router;
}
