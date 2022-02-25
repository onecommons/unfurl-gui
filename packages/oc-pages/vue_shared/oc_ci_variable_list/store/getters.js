import { uniq } from 'lodash';

export const joinedEnvironments = (state) => {
  const scopesFromVariables = (state.variables || []).map((variable) => variable.environment_scope);
  const uniqList = uniq(state.environments.concat(scopesFromVariables)).sort();
  return uniqList.filter(i => i === state.environmentName);
};
