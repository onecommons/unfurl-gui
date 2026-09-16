/*
 * 19.3's ci_variable_drawer speaks a different variable shape than the 15.11
 * store this package vendored, and the two disagree on every field name:
 *
 *   drawer   { key, value, protected, masked, hidden, raw, description,
 *              environmentScope, variableType: 'ENV_VAR' | 'FILE' }
 *   store    { key, secret_value, protected_variable, masked,
 *              environment_scope, variable_type: 'Variable' | 'File' }
 *
 * The store's variable_type holds the *display* string, which prepareDataForApi
 * converts on the way out -- so that is what these produce, not 'env_var'.
 */
import { displayText, types } from './constants';
import { variableTypes } from './constants_19_3';

export function toStoreVariable(variable = {}) {
  return {
    // carried through so an update patches the existing row rather than
    // creating a second one
    id: variable.id,
    key: variable.key,
    // Both, and equal: the store's editVariable -- which is how this gets seated
    // -- does `secret_value = value`, so an object carrying only secret_value
    // has it overwritten with undefined and the PATCH goes out with no value at
    // all, which the server rejects as "Variables value is invalid".
    value: variable.value ?? '',
    secret_value: variable.value ?? '',
    protected_variable: Boolean(variable.protected),
    masked: Boolean(variable.masked),
    variable_type:
      variable.variableType === variableTypes.fileType
        ? displayText.fileText
        : displayText.variableText,
    environment_scope: variable.environmentScope || types.allEnvironmentsType,
    // The drawer collects these and the api stores them. Dropping them here
    // discarded what the user typed with nothing said -- prepareDataForApi
    // clones and adds, so anything present is forwarded.
    description: variable.description ?? null,
    raw: variable.raw ?? true,
  };
}

export function toDrawerVariable(variable = {}) {
  return {
    id: variable.id,
    key: variable.key || '',
    // secret_value is what the modal wrote; value is what the list renders
    value: variable.secret_value ?? variable.value ?? '',
    protected: Boolean(variable.protected_variable ?? variable.protected),
    masked: Boolean(variable.masked),
    hidden: false,
    raw: variable.raw ?? true,
    description: variable.description ?? null,
    environmentScope: variable.environment_scope || types.allEnvironmentsType,
    variableType:
      variable.variable_type === displayText.fileText || variable.variable_type === types.fileType
        ? variableTypes.fileType
        : variableTypes.envType,
  };
}
