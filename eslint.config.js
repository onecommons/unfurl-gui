// Replaces .eslintrc.js, packages/oc-pages/.eslintrc.js and .eslintignore.
// The two directories keep the rules they had: src/ the Vue 3 essential set,
// oc-pages the Vue 2 one, which is all its old config enabled.
const vue = require('eslint-plugin-vue')
const globals = require('globals')
const babelParser = require('@babel/eslint-parser')
const tsParser = require('@typescript-eslint/parser')

// eslint-plugin-vue's presets leave their rules block unscoped; pin every
// block to one directory so neither set reaches the other's files
const scoped = (blocks, dir) => blocks.map(block => ({
  ...block,
  files: block.files
    ? block.files.map(pattern => `${dir}/${pattern.replace(/^(\*\*\/)?/, '**/')}`)
    : [`${dir}/**/*.{js,ts,vue}`],
}))

const diagnostics = {
  // warn/error/assert are diagnostics we want to keep; console.log is not
  'no-console': process.env.NODE_ENV === 'production'
    ? ['warn', {allow: ['warn', 'error', 'assert']}]
    : 'off',
  'no-debugger': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
  'semi': 'off',
}

module.exports = [
  {
    ignores: [
      '**/node_modules/',
      'dist/',
      // src/gitlab-oc is a symlink to packages/oc-pages: linting through it
      // would report every file twice. Lint packages/oc-pages directly.
      'src/gitlab-oc/',
      // type declarations only
      'src/**/*.d.ts',
      // Verbatim copies of the fork's @vue/compat shims (see the header in
      // each). They lint against gitlab's own plugin set, not ours -- there is
      // no @gitlab/require-i18n-strings here, and eslint errors on the disable
      // comment for a rule it cannot find. Editing them to suit would defeat
      // the point of copying.
      'src/assets/javascripts/vue3compat/',
    ],
  },
  {
    // no-console is on only in production, so outside it a disable comment for
    // it looks unused; report unused comments where every rule is on
    linterOptions: {reportUnusedDisableDirectives: process.env.NODE_ENV === 'production' ? 'warn' : 'off'},
  },
  {
    // vendored from GitLab and kept close to upstream: its disable comments
    // stay even where no rule here would report
    files: ['packages/oc-pages/vue_shared/oc_ci_variable_list/**'],
    linterOptions: {reportUnusedDisableDirectives: 'off'},
  },

  ...scoped(vue.configs['flat/essential'], 'src'),
  {
    files: ['src/**/*.{js,vue}'],
    languageOptions: {
      parser: babelParser,
      sourceType: 'module',
      globals: globals.node,
    },
    rules: diagnostics,
  },
  {
    // vue-eslint-parser for the template, Babel for the script
    files: ['src/**/*.vue'],
    languageOptions: {
      parser: require('vue-eslint-parser'),
      parserOptions: {parser: babelParser},
    },
  },

  ...scoped(vue.configs['flat/vue2-essential'], 'packages/oc-pages'),
  {
    files: ['packages/oc-pages/**/*.{js,ts,vue}'],
    languageOptions: {
      sourceType: 'module',
      globals: globals.node,
    },
    rules: {
      ...diagnostics,
      'vue/multi-word-component-names': 'off',
      'vue/no-v-text-v-html-on-component': 'off',
    },
  },
  {
    // the vue rules need vue-eslint-parser on top; it hands the script to the
    // TypeScript parser
    files: ['packages/oc-pages/**/*.ts'],
    languageOptions: {
      parser: require('vue-eslint-parser'),
      parserOptions: {parser: tsParser},
    },
  },
  {
    // <script lang="ts"> to the TypeScript parser; plain <script> keeps espree
    files: ['packages/oc-pages/**/*.vue'],
    languageOptions: {
      parserOptions: {parser: {ts: tsParser}},
    },
  },
]
