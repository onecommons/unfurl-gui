import Vue from 'vue';
import apolloProvider from './graphql';
import MainComponent from './components/main.vue';
import createRouter from './router';
import store from './store';
import __ from '~/locale';

import './assets/global.css';

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

  const router = createRouter(projectPath);

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
