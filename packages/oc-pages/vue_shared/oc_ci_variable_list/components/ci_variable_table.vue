<script>
import { GlTable, GlButton, GlIcon } from '@gitlab/ui';
import { mapState, mapActions } from 'vuex';
import { s__, __ } from '~/locale';
import CiVariablePopover from './ci_variable_popover.vue';

export default {
  trueIcon: 'mobile-issue-close',
  falseIcon: 'close',
  iconSize: 16,
  fields: [
    {
      key: 'variable_type',
      label: s__('CiVariables|Type'),
      customStyle: { width: '70px' },
    },
    {
      key: 'key',
      label: s__('CiVariables|Key'),
      tdClass: 'text-plain',
      sortable: true,
      customStyle: { width: '40%' },
    },
    {
      key: 'value',
      label: s__('CiVariables|Value'),
      customStyle: { width: '40%' },
    },
    {
      key: 'protected',
      label: s__('CiVariables|Protected'),
      customStyle: { width: '100px' },
    },
    {
      key: 'masked',
      label: s__('CiVariables|Masked'),
      customStyle: { width: '100px' },
    },
    {
      key: 'actions',
      label: '',
      tdClass: 'gl-text-right',
      customStyle: { width: '35px' },
    },
  ],
  components: {
    GlTable,
    GlButton,
    GlIcon,
    CiVariablePopover,
  },
  emits: ['edit-variable', 'add-variable'],
  computed: {
    ...mapState('ci_variables', ['variables', 'valuesHidden', 'isGroup', 'isLoading', 'isDeleting']),
    valuesButtonText() {
      return this.valuesHidden ? __('Reveal values') : __('Hide values');
    },
    tableIsNotEmpty() {
      return this.variables && this.variables.length > 0;
    },
    fields() {
      if (this.isGroup) {
        return this.$options.fields.filter((field) => field.key !== 'environment_scope');
      }
      return this.$options.fields;
    },
  },
  mounted() {
    this.fetchVariables();
  },
  methods: {
    ...mapActions('ci_variables', ['fetchVariables', 'toggleValues', 'editVariable']),
  },
};
</script>

<template>
  <div class="ci-variable-table" data-testid="ci-variable-table">
    <!-- stacked="md", not "lg": 19.3 sets .with-gl-container-queries, so this
         breakpoint is measured against the nearest container rather than the
         viewport. That container is `main`, which limit-container-width keeps at
         ~966px -- under `lg` (992px) at every window size, so the table stacked
         permanently and lost its header row. -->
    <gl-table
      :fields="fields"
      :items="variables"
      tbody-tr-class="js-ci-variable-row"
      data-qa-selector="ci_variable_table_content"
      sort-by="key"
      sort-direction="asc"
      stacked="md"
      table-class="text-secondary"
      fixed
      show-empty
      sort-icon-left
      no-sort-reset
    >
      <template #table-colgroup="scope">
        <col v-for="field in scope.fields" :key="field.key" :style="field.customStyle" />
      </template>
      <template #cell(key)="{ item }">
        <div class="gl-flex truncated-container">
          <span :id="`ci-variable-key-${item.id}`" class="gl-inline-block mw-100 gl-truncate">{{
            item.key
          }}</span>
          <ci-variable-popover
            :target="`ci-variable-key-${item.id}`"
            :value="item.key"
            :tooltip-text="__('Copy key')"
          />
        </div>
        <!-- Under the key rather than in a column of its own: descriptions are
             usually a sentence, and a sixth column squeezes the ones that carry
             the data. The drawer has collected this since 19.3 and nothing
             displayed it. -->
        <div
          v-if="item.description"
          :data-testid="`ci-variable-description-${item.id}`"
          class="gl-mt-1 gl-text-sm gl-text-subtle gl-truncate"
        >
          {{ item.description }}
        </div>
      </template>
      <template #cell(value)="{ item }">
        <span v-if="valuesHidden">*********************</span>
        <div v-else class="gl-flex truncated-container">
          <span :id="`ci-variable-value-${item.id}`" class="gl-inline-block mw-100 gl-truncate">{{
            item.value
          }}</span>
          <ci-variable-popover
            :target="`ci-variable-value-${item.id}`"
            :value="item.value"
            :tooltip-text="__('Copy value')"
          />
        </div>
      </template>
      <template #cell(protected)="{ item }">
        <gl-icon v-if="item.protected" :size="$options.iconSize" :name="$options.trueIcon" />
        <gl-icon v-else :size="$options.iconSize" :name="$options.falseIcon" />
      </template>
      <template #cell(masked)="{ item }">
        <gl-icon v-if="item.masked" :size="$options.iconSize" :name="$options.trueIcon" />
        <gl-icon v-else :size="$options.iconSize" :name="$options.falseIcon" />
      </template>
      <template #cell(environment_scope)="{ item }">
        <div class="gl-flex truncated-container">
          <span :id="`ci-variable-env-${item.id}`" class="gl-inline-block mw-100 gl-truncate">{{
            item.environment_scope
          }}</span>
          <ci-variable-popover
            :target="`ci-variable-env-${item.id}`"
            :value="item.environment_scope"
            :tooltip-text="__('Copy environment')"
          />
        </div>
      </template>
      <template #cell(actions)="{ item }">
        <gl-button
          ref="edit-ci-variable"
          icon="pencil"
          :aria-label="__('Edit')"
          data-testid="edit-ci-variable"
          data-qa-selector="edit_ci_variable_button"
          @click="$emit('edit-variable', item)"
        />
      </template>
      <template #empty>
        <p ref="empty-variables" class="gl-text-center empty-variables text-plain">
          {{ __('There are no variables yet.') }}
        </p>
      </template>
    </gl-table>
    <div class="ci-variable-actions" :class="{ 'gl-justify-center': !tableIsNotEmpty }">
      <gl-button
        v-if="tableIsNotEmpty"
        ref="secret-value-reveal-button"
        data-qa-selector="reveal_ci_variable_value_button"
        class="gl-mr-3"
        @click="toggleValues(!valuesHidden)"
        >{{ valuesButtonText }}</gl-button
      >
      <gl-button
        ref="add-ci-variable"
        data-testid="add-ci-variable"
        data-qa-selector="add_ci_variable_button"
        variant="success"
        category="primary"
        @click="$emit('add-variable')"
        >{{ __('Add Variable') }}</gl-button
      >
    </div>
  </div>
</template>
