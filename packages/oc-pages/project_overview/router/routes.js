import ProjectPageHome from '../pages/projects/index.vue';
import TemplatesPage from '../pages/templates/index.vue';
import { SIGN_IN, OC_PROJECT_VIEW_HOME, OC_PROJECT_VIEW_CREATE_TEMPLATE, OC_PROJECT_VIEW_EDIT_DEPLOYMENT, OC_PROJECT_VIEW_DRAFT_DEPLOYMENT } from './constants';
import { PageNotFound, SignIn } from '../../vue_shared/oc-components'

export default [
  {
    name: OC_PROJECT_VIEW_HOME,
    path: '/',
    component: ProjectPageHome,
  },
  {
    name: OC_PROJECT_VIEW_CREATE_TEMPLATE,
    path: '/templates/:slug',
    component: TemplatesPage,
    public: false
  },
  {
    name: OC_PROJECT_VIEW_EDIT_DEPLOYMENT,
    path: '/deployments/:environment/:slug',
    component: TemplatesPage,
    public: false,
  },
  {
    name: OC_PROJECT_VIEW_DRAFT_DEPLOYMENT,
    path: '/deployment-drafts/:environment/:slug',
    component: TemplatesPage,
    public: false
  },
  {
    name: SIGN_IN,
    path: '/users/sign_in', // not being used
    component: SignIn
  },
  { path: '*', component: PageNotFound },
];
