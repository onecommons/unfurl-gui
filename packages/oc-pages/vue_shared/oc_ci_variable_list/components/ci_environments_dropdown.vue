<script>
import { GlDropdown, GlDropdownItem, GlDropdownDivider, GlSearchBoxByType } from '@gitlab/ui';
import { mapGetters, mapState } from 'vuex';
import { __, sprintf } from '~/locale';

export default {
  name: 'CiEnvironmentsDropdown',
  components: {
    GlDropdown,
    GlDropdownItem,
    GlDropdownDivider,
    GlSearchBoxByType,
  },
  props: {
    value: {
      type: String,
      required: false,
      default: '',
    },
    // 19.3's drawer names the same thing differently and passes the list in
    // rather than reading the store. Accept both so this stays usable from
    // either caller.
    selectedEnvironmentScope: {
      type: String,
      required: false,
      default: '',
    },
    environments: {
      type: Array,
      required: false,
      default: null,
    },
    areEnvironmentsLoading: {
      type: Boolean,
      required: false,
      default: false,
    },
  },
  emits: ['selectEnvironment', 'select-environment', 'createClicked', 'search-environment-scope'],
  data() {
    return {
      searchTerm: '',
    };
  },
  computed: {
    ...mapGetters('ci_variables', ['joinedEnvironments']),
    ...mapState('ci_variables', [
      'environmentName',
    ]),
    composedCreateButtonLabel() {
      return sprintf(__('Create wildcard: %{searchTerm}'), { searchTerm: this.searchTerm });
    },
    shouldRenderCreateButton() {
      return this.searchTerm && !this.availableEnvironments.includes(this.searchTerm);
    },
    // whichever the caller supplied
    currentValue() {
      return this.selectedEnvironmentScope || this.value;
    },
    availableEnvironments() {
      return this.environments ?? this.joinedEnvironments;
    },
    filteredResults() {
      const lowerCasedSearchTerm = this.searchTerm.toLowerCase();
      return this.availableEnvironments.filter((resultString) =>
        resultString.toLowerCase().includes(lowerCasedSearchTerm),
      );
    },
  },
  created() {
    this.selectEnvironment(this.environmentName);
  },
  methods: {
    selectEnvironment(selected) {
      // Vue 3 does not map a camelCase emit onto a kebab-case listener, and the
      // drawer listens for the kebab one -- emit both rather than break either
      // caller.
      this.$emit('selectEnvironment', selected);
      this.$emit('select-environment', selected);
      this.searchTerm = '';
    },
    createClicked() {
      this.$emit('createClicked', this.searchTerm);
      this.searchTerm = '';
    },
    isSelected(env) {
      return this.currentValue === env;
    },
    clearSearch() {
      this.searchTerm = '';
    },
  }
};
</script>
<template>
  <gl-dropdown :text="currentValue" :loading="areEnvironmentsLoading" @show="clearSearch">
    <gl-search-box-by-type v-model.trim="searchTerm" data-testid="ci-environment-search" />
    <gl-dropdown-item
      v-for="environment in filteredResults"
      :key="environment"
      :is-checked="isSelected(environment)"
      is-check-item
      @click="selectEnvironment(environment)"
    >
      {{ environment }}
    </gl-dropdown-item>
    <gl-dropdown-item v-if="!filteredResults.length" ref="noMatchingResults">{{
      __('No matching results')
    }}</gl-dropdown-item>
    <template v-if="shouldRenderCreateButton">
      <gl-dropdown-divider />
      <gl-dropdown-item data-testid="create-wildcard-button" @click="createClicked">
        {{ composedCreateButtonLabel }}
      </gl-dropdown-item>
    </template>
  </gl-dropdown>
</template>
