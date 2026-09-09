import {createApp, h} from 'vue';
import MainComponent from './components/main.vue';
import createRouter from './router';
import store from './store';
import {GlTooltipDirective} from '@gitlab/ui';
import __ from '~/locale';
import {OcComponents} from 'oc_vue_shared/components/oc/plugin'
import {normpath} from '../vue_shared/lib/normalize'
import {mountReplacing} from '../vue_shared/lib/mount-app'

import './assets/global.css';


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

  // force /-/overview for route consistence with standalone
  if(window.gon.unfurl_gui && !window.location.pathname.includes('/-/overview')) {
    window.history.replaceState(
      {},
      '',
      window.location.pathname.replace(projectPath, `${projectPath}/-/overview`) + window.location.search + window.location.hash
    )
  }

  const base = window.location.pathname.includes('/-/overview') ?
    `${projectPath}/-/overview` : projectPath

  const router = createRouter(base, store);

  const projectGlobal = {
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

  const app = createApp({render: () => h(MainComponent)})

  app.use(store)
  app.use(router)
  app.use(OcComponents)
  app.directive('gl-tooltip', GlTooltipDirective)
  app.config.globalProperties.$projectGlobal = projectGlobal

  const vm = mountReplacing(app, element)

  if(window.Cypress || sessionStorage['debug']) {
    window.$store = store
  }

  return vm

};
