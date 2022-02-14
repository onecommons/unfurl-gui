import DashboardHome from '../pages/home.vue'
import DeploymentsIndex from '../pages/deployments-index.vue'
import Hello from '../components/hello-router.vue'
import * as constants from './constants';

export default [
  {
    name: constants.OC_DASHBOARD_HOME,
    path: '/',
    component: DashboardHome,
  },
  {
    name: constants.OC_DASHBOARD_ENVIRONMENTS,
    path: '/environments/:name',
    component: Hello
  },
  {
    name: constants.OC_DASHBOARD_DEPLOYMENTS,
    path: '/deployments/:environment/:name',
    component: Hello
  },
  {
    name: constants.OC_DASHBOARD_APPLICATIONS,
    path: '/applications/:name',
    component: Hello
  },
  {
    name: constants.OC_DASHBOARD_DEPLOYMENTS_INDEX,
    path: '/deployments',
    component: DeploymentsIndex
  },
  {
    name: constants.OC_DASHBOARD_APPLICATIONS_INDEX,
    path: '/applications',
    component: Hello
  },
  {
    name: constants.OC_DASHBOARD_ENVIRONMENTS_INDEX,
    path: '/environments',
    component: Hello
  },

];
