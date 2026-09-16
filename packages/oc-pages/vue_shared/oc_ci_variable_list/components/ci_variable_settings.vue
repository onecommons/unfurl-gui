<script>
import { mapState, mapActions } from 'vuex';
import CiVariableDrawer from './ci_variable_drawer.vue';
import CiVariableTable from './ci_variable_table.vue';
import { toStoreVariable, toDrawerVariable } from '../drawer_adapter';
import { ADD_VARIABLE_ACTION, EDIT_VARIABLE_ACTION } from '../constants_19_3';

// The drawer injects these rather than taking props, and validates the value
// against one of the two regexes before it will enable Save. Without them its
// validation has nothing to test, so a value the server will reject -- anything
// under 8 characters, or containing whitespace, while Masked is selected --
// reaches the API and comes back as an opaque "Variables value is invalid".
//
// Both patterns are GitLab's own (Ci::Maskable::REGEX and MASK_AND_RAW_REGEX);
// the dataset supplies maskableRegex, and the raw one has no dataset key.
const MASKABLE_REGEX = '^[a-zA-Z0-9_+=/@:.~-]{8,}$'
const MASKABLE_RAW_REGEX = '^\\S{8,}$'

export default {
  components: {
    CiVariableDrawer,
    CiVariableTable,
  },
  provide() {
    return {
      isProtectedByDefault: this.isProtectedByDefault ?? false,
      maskableRegex: this.maskableRegex || MASKABLE_REGEX,
      maskableRawRegex: MASKABLE_RAW_REGEX,
    }
  },
  props: {
    // From the route, not the dataset: the page navigates without reloading, so
    // a value captured at store construction goes stale and fetchVariables --
    // which filters on it -- then shows another environment's variables.
    environmentName: {
      type: String,
      required: false,
      default: '',
    },
  },
  data() {
    return {
      drawerMode: null,
      selectedVariable: {},
    };
  },
  computed: {
    ...mapState('ci_variables', ['isGroup', 'environments', 'isLoading', 'variables',
      'maskableRegex', 'isProtectedByDefault']),
    drawerOpen() {
      return Boolean(this.drawerMode);
    },
    // The drawer takes environment scopes as plain strings; the store keeps the
    // same list the 15.11 dropdown used.
    environmentScopes() {
      return this.environments || [];
    },
  },
  watch: {
    environmentName: {
      immediate: true,
      handler(name) {
        if (name) this.setEnvironmentName(name);
      },
    },
  },
  mounted() {
    if (!this.isGroup) {
      this.fetchEnvironments();
    }
  },
  methods: {
    ...mapActions('ci_variables', [
      'fetchEnvironments',
      'addVariable',
      'updateVariable',
      'deleteVariable',
      'editVariable',
      'setEnvironmentName',
      'clearModal',
      'resetEditing',
    ]),
    onAdd() {
      this.clearModal();
      this.selectedVariable = {};
      this.drawerMode = ADD_VARIABLE_ACTION;
    },
    onEdit(variable) {
      this.selectedVariable = toDrawerVariable(variable);
      this.drawerMode = EDIT_VARIABLE_ACTION;
    },
    close() {
      this.drawerMode = null;
      this.selectedVariable = {};
      this.resetEditing();
    },
    // The store's add/update/delete all read state.variable rather than taking
    // an argument, so the drawer's payload has to be seated there first.
    seat(variable) {
      this.editVariable(toStoreVariable(variable));
    },
    async onAddVariable(variable) {
      this.seat(variable);
      await this.addVariable();
      this.close();
    },
    async onUpdateVariable(variable) {
      this.seat(variable);
      await this.updateVariable();
      this.close();
    },
    async onDeleteVariable(variable) {
      this.seat(variable);
      await this.deleteVariable();
      this.close();
    },
  },
};
</script>

<template>
  <div class="row">
    <div class="col-lg-12">
      <ci-variable-table @add-variable="onAdd" @edit-variable="onEdit" />
      <ci-variable-drawer
        v-if="drawerOpen"
        :are-environments-loading="isLoading"
        :are-hidden-variables-available="false"
        :are-scoped-variables-available="true"
        :environments="environmentScopes"
        :mode="drawerMode"
        :selected-variable="selectedVariable"
        @add-variable="onAddVariable"
        @update-variable="onUpdateVariable"
        @delete-variable="onDeleteVariable"
        @close-form="close"
      />
    </div>
  </div>
</template>
