import Vue from 'vue';
import apolloProvider from './graphql';
import MainComponent from './components/main.vue';
import createRouter from './router';
import store from './store';
import __ from '~/locale';
import ElementUI from 'element-ui'

import './assets/global.css';
import 'element-ui/lib/theme-chalk/index.css'
 
Vue.use(ElementUI)
//export {bus} from 'oc/bus-shim';

export default (elemId='js-oc-project-overview') => {
  const element = document.getElementById(elemId);

  const {
    projectPath,
    treePath,
    ref,
    projectIcon,
    projectName,
    buttonId,
    buttonStarText,
    buttonStarLink,
    buttonStarIcon,
    buttonStarCount,
    buttonStarEndpoint,
    buttonForkPath,
    buttonForkLink,
    buttonForkCount,
    linkDeployment,
  } = element.dataset;

  const base = window.location.pathname.includes('/-/overview') ?
    `${projectPath}/-/overview` : projectPath

  const router = createRouter(base);

  Vue.prototype.$projectGlobal = {
    projectPath,
    projectIcon,
    buttonId,
    treePath,
    projectName,
    ref,
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
    linkDeployment,
  };

  return new Vue({
    el: element,
    apolloProvider,
    store,
    router,
    render(createElement) {
      return createElement(MainComponent);
    },
  });
};
