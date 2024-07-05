import Vue from 'vue';
import apolloProvider from './graphql';
import MainComponent from './components/main.vue';
import createRouter from './router';
import store from './store';
import {GlTooltipDirective} from '@gitlab/ui';
import __ from '~/locale';
import {OcComponents} from 'oc_vue_shared/components/oc/plugin'
import {setupTheme} from 'oc_vue_shared/theme'
import {Popover as ElPopover, Loading as ElLoading} from 'element-ui'
import {normpath} from '../vue_shared/lib/normalize'

import './assets/global.css';

Vue.use(OcComponents)
Vue.directive('gl-tooltip', GlTooltipDirective)
Vue.directive('loading', ElLoading) // when we're able to tree shake, this can go in async components that need it
Vue.component('el-popover', ElPopover) // needed for formily to have tooltips

setupTheme(Vue)

export default (elemId='js-oc-project-overview') => {
  const element = document.getElementById(elemId);

  let {
    projectPath,
    buttonStarText,
    buttonStarLink,
    buttonStarIcon,
    buttonStarCount,
    buttonStarEndpoint,
    buttonForkPath,
    buttonForkLink,
    buttonForkCount,
  } = element.dataset;

  projectPath = normpath(projectPath)
  window.gon.home_project = normpath(window.gon.home_project)
  window.gon.working_dir_project = normpath(window.gon.working_dir_project)
  const base = window.location.pathname.includes('/-/overview') ?
    `${projectPath}/-/overview` : projectPath

  const router = createRouter(base);

  Vue.prototype.$projectGlobal = {
    projectPath,
    buttonStar : {
      text: buttonStarText,
      link: buttonStarLink,
      icon: buttonStarIcon,
      count: buttonStarCount,
      endpoint: buttonStarEndpoint
    },
    buttonFork: {
      path: buttonForkPath,
      link: buttonForkLink,
      count: buttonForkCount
    },
    ...element.dataset
  };

  const vm =  new Vue({
    el: element,
    apolloProvider,
    store,
    router,
    render(createElement) {
      return createElement(MainComponent);
    },
  });

  if(window.Cypress || sessionStorage['debug']) {
    window.$store = vm.$store
  }

  return vm

};
