import Vue from 'vue';
import VueRouter from 'vue-router';
import { joinPaths } from '~/lib/utils/url_utility';
import routes from './routes';

Vue.use(VueRouter);

export default function createRouter(base) {
    const router = new VueRouter({
      mode: 'history',
      base: joinPaths(gon.relative_url_root || '', `${base}/-/overview`),
      routes,
      
    });


    router.beforeEach((to, from, next) => {
        if(router.app.$store) {
            router.app.$store.getters.getRouterHook(to, from, next)
        }
        else next()
    })

    return router;
}
