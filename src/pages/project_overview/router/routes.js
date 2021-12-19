import ProjectPageHome from '../pages/projects/index.vue';
import TemplatesPage from '../pages/templates/index.vue';
import { OC_PROJECT_VIEW_HOME, OC_PROJECT_VIEW_CREATE_TEMPLATE } from './constants';

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
  },
  {
    path: "*",
    redirect: "/"
  }
];
