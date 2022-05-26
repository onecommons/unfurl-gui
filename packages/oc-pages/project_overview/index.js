import Vue from 'vue';
import apolloProvider from './graphql';
import MainComponent from './components/main.vue';
import createRouter from './router';
import store from './store';
import {GlTooltipDirective} from '@gitlab/ui';
import __ from '~/locale';
import ElementUI from 'element-ui'
import {setupTheme} from 'oc_vue_shared/theme'

import './assets/global.css';

Vue.use(ElementUI)
Vue.directive('gl-tooltip', GlTooltipDirective)

setupTheme(Vue)

export default (elemId='js-oc-project-overview') => {
  const element = document.getElementById(elemId);

  const {
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
