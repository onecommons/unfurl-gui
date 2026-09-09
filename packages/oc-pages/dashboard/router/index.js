import VueRouter from 'vue-router';
import {baseRouteNaive} from './base-route';
import routes from './routes';
import { PageNotFound } from 'oc_vue_shared/components/oc'

routes.push({ path: "*", component: PageNotFound })

const base = baseRouteNaive(window.location.pathname);

// no longer relevant?
const delimiter = /*base.includes('dashboard')? '': */'/-'

// store is passed in rather than reached through router.app: router.app does
// not exist in vue-router 4, and it couples the router to whichever root
// instance registered first
export default function createRouter(store) {
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


    router.name = 'dashboard'

    router.beforeEach((to, from, next) => {
        if(typeof store?.getters?.getRouterHook == 'function') {
            store.getters.getRouterHook(to, from, next)
        }
        else next()

    })
    

    return router;
}
