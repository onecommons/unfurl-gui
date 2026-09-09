import {createApp, h} from 'vue';
import { parseBoolean } from '~/lib/utils/common_utils';
import CiVariableSettings from './components/ci_variable_settings.vue';
import createStore from './store';
import {mountReplacing} from '../lib/mount-app';

const mountCiVariableListApp = (containerEl) => {
  const {
    endpoint,
    projectId,
    group,
    maskableRegex,
    protectedByDefault,
    awsLogoSvgPath,
    awsTipDeployLink,
    awsTipCommandsLink,
    awsTipLearnLink,
    protectedEnvironmentVariablesLink,
    maskedEnvironmentVariablesLink,
    environmentName
  } = containerEl.dataset;
  const isGroup = parseBoolean(group);
  const isProtectedByDefault = parseBoolean(protectedByDefault);

  const store = createStore({
    endpoint,
    projectId,
    isGroup,
    maskableRegex,
    isProtectedByDefault,
    awsLogoSvgPath,
    awsTipDeployLink,
    awsTipCommandsLink,
    awsTipLearnLink,
    protectedEnvironmentVariablesLink,
    maskedEnvironmentVariablesLink,
    environmentName
  });

  const app = createApp({render: () => h(CiVariableSettings)})
  app.use(store)

  return mountReplacing(app, containerEl);
};

export default () => {
  const el = document.querySelector('#js-oc-ci-variables');
  return !el ? {} : mountCiVariableListApp(el);
};
