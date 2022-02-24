import DashboardHome from '../pages/home.vue'
import DeploymentsIndex from '../pages/deployments-index.vue'
import EnvironmentsIndex from '../pages/environments-index.vue'
import Deployment from '../pages/deployment.vue'
import Environment from '../pages/environment.vue'
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
    component: Environment
  },
  {
    name: constants.OC_DASHBOARD_DEPLOYMENTS,
    path: '/deployments/:environment/:name',
    component: Deployment
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
    component: EnvironmentsIndex
  },

];
