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
    // redundant
  {
    //name: constants.OC_DASHBOARD_HOME,
    path: '/home',
    component: DashboardHome,
  },
  {
    name: constants.OC_DASHBOARD_ENVIRONMENTS,
    path: '$DELIMITER/environments/:name',
    component: Environment
  },
  {
    name: constants.OC_DASHBOARD_DEPLOYMENTS,
    path: '$DELIMITER/deployments/:environment/:name',
    component: Deployment
  },
  {
    name: constants.OC_DASHBOARD_APPLICATIONS,
    path: '$DELIMITER/applications/:name',
    component: Hello
  },
  {
    name: constants.OC_DASHBOARD_DEPLOYMENTS_INDEX,
    path: '$DELIMITER/deployments',
    component: DeploymentsIndex
  },
  {
    name: constants.OC_DASHBOARD_APPLICATIONS_INDEX,
    path: '$DELIMITER/applications',
    component: Hello
  },
  {
    name: constants.OC_DASHBOARD_ENVIRONMENTS_INDEX,
    path: '$DELIMITER/environments',
    component: EnvironmentsIndex
  },

];
