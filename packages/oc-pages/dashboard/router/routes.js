import DashboardHome from '../components/table.vue'
import Hello from '../components/hello-router.vue'
import * as constants from './constants';

export default [
  {
    name: constants.OC_DASHBOARD_HOME,
    path: '/',
    component: DashboardHome,
  },
  {
    name: constants.OC_DASHBOARD_ENVIRONMENTS_INDEX,
    path: '/environments',
    component: Hello
  },
  {
    name: constants.OC_DASHBOARD_ENVIRONMENTS,
    path: '/environments/:name',
    component: Hello
  },
  {
    name: constants.OC_DASHBOARD_DEPLOYMENTS,
    path: '/deployments/:name',
    component: Hello
  },
  {
    name: constants.OC_DASHBOARD_APPLICATIONS,
    path: '/applications/:name',
    component: Hello
  }



  /*
  {
    name: constants.OC_DASHBOARD_ENVIRONMENTS_INDEX,
    path: '/environments',
  },
  {
    name: OC_PROJECT_VIEW_EDIT_DEPLOYMENT,
    path: '/deployments/:environment/:slug',
    component: TemplatesPage,
  },
  {
    name: OC_PROJECT_VIEW_DRAFT_DEPLOYMENT,
    path: '/deployment-drafts/:environment/:slug',
    component: TemplatesPage,
  },
  {
    path: "*",
    redirect: "/"
  }
  */
];
