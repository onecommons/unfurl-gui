# oc-pages Vue 3 migration plan

Status: draft, 2026-09-06. Covers the `packages/oc-pages` package as consumed by
both this repo (standalone `unfurl serve --gui`) and the unfurl.cloud GitLab
fork, which is moving from GitLab 15.11 to 19.4.

## Findings that shape the plan

These were verified against the published packages and the GitLab 19.3.0
source (19.4.0 is not tagged yet; every pin below is from 19.3.0).

1. **@gitlab/ui cannot run on pure Vue 3.** The latest release (137.1.1,
   2026-09-03) declares `vue ^2.7.16` as its peer, ships Vue 2 render output
   in `dist/`, and its `src/` uses `$listeners` and `$scopedSlots`. GitLab
   runs it on Vue 3 by aliasing `@gitlab/ui` to `@gitlab/ui/src` and
   compiling it with the `@vue/compat` compiler in MODE 2. Pure Vue 3 would
   mean dropping @gitlab/ui, which is the dominant kit in oc-pages. We keep it.
2. **Target runtime: Vue 3.5 + @vue/compat, configured to mirror the fork.**
   Strictness comes from `compatConfig: { MODE: 3 }` declared on every
   oc-pages component (per-component checks resolve against the component
   that uses the deprecated feature, so gl-* children stay in MODE 2) plus a
   CI grep ban on the Vue 2 global API, which cannot be scoped per component.
3. **@gitlab/ui 60 to 137 is likely more template churn than Vue itself.**
   Utility classes now come from the consumer's Tailwind build using the
   shipped preset, and about half of the 51 distinct `gl-` utilities we use
   were renamed in that move. Every component we use still exists except
   GlPaginatedList. The GlDropdown family (26 uses) is still shipped but has
   named successors.
4. **Element is only supplying leaf widgets.** Formily does the JSON-schema
   to form work (`@formily/core`, `@formily/json-schema`, `@formily/vue`).
   `@formily/element` is a set of ten-line adapters that we already know how
   to write, because `formily-fake-password.js` and `formily-file-selector.js`
   are exactly that. FormItem, ArrayItems, Editable.Popover, and FormLayout
   are the four pieces that need a real port.
5. **Component-level test coverage is effectively zero.** One jest test
   mounts a component. Cypress is deep on one path (template page, formily
   form, deploy) and shallow on the dashboard. There is no screenshot or DOM
   snapshot tooling. Phase 1 exists to fix that before anything moves.

Reference pins from GitLab 19.3.0:

| Package | Vue 2 lane | Vue 3 lane |
|---|---|---|
| vue | 2.7.16 | @vue/compat 3.5.34 |
| @gitlab/ui | 136.1.0 | same, compiled from `src/` |
| vuex | 3.6.2 | vuex 4.1.0 via `vue3compat/vuex.js` facade |
| vue-router | 3.6.5 | vue-router 4.5.1 via `vue3compat/vue_router.js` facade |
| vue-apollo | 3.0.7 | @vue/apollo-option 4 via facade |
| test utils | @vue/test-utils 1.3.6, vue2-jest | @vue/test-utils 2.4.6, vue3-jest 29 |
| tailwindcss | ^3.4.1 | same |

Fork config files to copy or mirror:
`app/assets/javascripts/lib/utils/vue3compat/compat_config.js`,
`config/helpers/context_aliases_shared.js`, the `compilerOptions.compatConfig`
block in `config/webpack.config.js`.

---

## Phase 1: testing strategy

Goal: a baseline suite that runs on today's Vue 2.7 code and runs unchanged on
the migrated code, so every Phase 2 step is gated by the same tests.
Everything in this phase is written against the current stack.

### 1.1 Stable selectors

Add `data-testid` attributes to every surface that Phase 2 replaces, so the
same selectors work before and after:

- el-autocomplete, el-tooltip, el-card, el-select, el-checkbox, el-popover
  usages (21 files, see `grep -rl "<el-" packages/oc-pages`)
- formily field wrappers: the FormItem label, tooltip icon, addonAfter slot,
  ArrayItems add and remove buttons, the Editable popover trigger
- the tree in `file-selector.vue`
- the JSON viewer in `oc-properties-list.vue`

Replace every Element class selector in cypress with a testid:

| File | Selector |
|---|---|
| `cypress/support/run-recreate-deployment.js:189` | `.el-card__body > [class^="formily-element-form"]` |
| `cypress/support/run-recreate-deployment.js:220-223` | `.el-input`, `.el-input-number`, `.el-checkbox` |
| `cypress/support/create-kubernetes-environment.js:81` | `formily-element-array-base-addition` |
| `cypress/e2e/deployments/smorgasbord.cy.js:56` | `.el-popover` |
| `cypress/e2e/deployments/nested-tabs.cy.js:19,21` | `formily-element-form-item-label`, `.el-input__inner` |
| `cypress/e2e/blueprints/k8s__container-webapp5__container-webapp.cy.js:39-49` | `.el-input-group__prepend`, `formily-element-form-item-label`, `.el-input__inner` |

Selector shape matters as much as the testid. Element wraps its `<input>` in
a div, so specs select `[data-testid="oc-input-…"] input` as a descendant.
gl-form-input *is* the `<input>`, so after the swap the testid lands on the
input itself and the descendant selector matches nothing. Convert every
`[testid] input` and `[testid] textarea` in cypress (6 sites) to the existing
`cy.getInputOrTextarea()` helper in `cypress/support/commands.js`, which
accepts both shapes. Apply the same thinking to checkbox `.check()` calls and
the object popover trigger.

Exit: `grep -rE "\.el-|formily-element" cypress/` returns nothing, and
`grep -rE '\]\s+(input|textarea)' cypress/` returns nothing.

### 1.2 Route smoke spec

New spec `cypress/e2e/00_visitor/route_smoke.cy.js`. Against the standalone
fixture project it visits every route in `dashboard/router/routes.js` and
`project_overview/router/routes.js` plus the public_cloud page, waits for the
store to be ready (`cy.withStore`), asserts no `[browser error]` or uncaught
exception was logged by the hooks already in `cypress/support/e2e.js`, asserts
the route's primary testid is visible, and takes a screenshot named after the
route.

This covers the dashboard pages the blueprint specs skip. It is cheap and it
is the first thing that will break when a gl-* component changes shape.

Exit: spec green in the standalone CI job.

### 1.3 Formily widget contract spec

`cypress/e2e/deployments/smorgasbord.cy.js` already fills text, number,
checkbox, textarea, the generate addon, the object popover, and password.
Make it the contract for the formily binding swap:

- confirm it runs standalone (it uses `whenEnvironmentAbsent`, so the setup
  script's pre-created environment should satisfy it; if the smorgasbord
  blueprint is missing from the standalone namespace, add it to
  `testing-shared/unfurl-init-setup.sh`)
- extend the blueprint and the spec to cover every entry in the ComponentMap
  in `oc_inputs.vue`: enum (Select), array (ArrayItems), object with
  additionalProperties (the key/value ArrayItems editor with Addition and
  Remove), and a tooltip-bearing property (EnvironmentTooltip)
- assert values round-trip into `store.state.templateResources` (the spec
  already does this) and that the read-pretty preview renders after save
- screenshot the filled form

The full blueprint matrix in `.github/workflows/dryrun.yml` (47 specs, fake
credentials, standalone) stays as the broad formily regression run. It is
on-demand today and stays on-demand.

Exit: extended spec green standalone; matrix green on a dryrun run.

### 1.4 Pin the baseline and make it the PR gate

- PR gate in `build_test_release.yml`: route smoke, smorgasbord, and the
  existing minecraft recreate spec, all against the container server path.
- Always upload cypress screenshots as a CI artifact, not only on failure.
  Commit the first green run's screenshots to `cypress/baseline/` as the
  reference set.
- Document the standalone subset and the fork-only remainder in
  `cypress/README.md`. Fork-only today: five of the seven
  `01_environments/*` specs (aws, digitalocean, gcp, generic, github_token),
  the four `*container-webapp*` blueprint specs, and
  `deployments/shared-dashboard.cy.js`. `a10.cy.js` and
  `create_dashboard.cy.js` use no GitLab helpers; confirm they run standalone
  and fold them into the gate if they do.

Exit: two consecutive green PR-gate runs from the same commit (flake check).

### 1.5 Screenshot comparison

Keep this deliberately small. Pixel diffing whole pages against generated
names and timestamps will be noisy, so:

- DOM and text assertions in the specs are the gate.
- A non-blocking `scripts/src/compare-screenshots.js` step diffs the
  route-smoke and smorgasbord screenshots against `cypress/baseline/` with
  `pixelmatch` and posts the changed images as a CI artifact for eyeballing.
- Promote it to blocking for the smorgasbord form screenshot only once it
  has been stable for a few runs.

### 1.6 Unit-test harness

Nothing to add on Vue 2. Record for Phase 2: only `file-selector.test.js`
and `template_resources.test.js` use `createLocalVue` and `shallowMount` and
need rewriting for @vue/test-utils 2. Everything else is pure functions. Add
a `yarn test:packages` script that matches what CI runs.

### 1.7 Fork-only validation path

Two integration points and ten specs cannot be exercised from this repo:

- the `environments/index.js` mount hook that mounts `oc/dashboard`
- `notes-wrapper.vue`, already broken by the work-items switch
- the fork-only specs listed in 1.4

Decide the environment (GDK on the fork branch, or a built image of the
fork) and get the ten specs running against it on 15.11 before Phase 2
starts. This is its own budget line. The result is the fork-side baseline
that 2C is gated on.

### Phase 1 exit criteria

- PR gate green twice in a row; dryrun matrix green once.
- No Element class selectors left in cypress.
- Baseline screenshots committed.
- Fork-only specs runnable somewhere, with a written recipe.

---

## Phase 2: migration

Principle: do everything that can be done on Vue 2.7 first, because the
Phase 1 harness runs there and each step can be merged on its own. The Vue
switch itself then becomes one short-lived branch. Phase 2 has four parts:
2.0 two throwaway spikes, 2A on Vue 2.7, 2B the switch, 2C the fork.

### 2.0 Gating spikes

Two checks on one throwaway branch, before any 2A work is committed. Their
outcome decides the shape of 2A.3 and 2B, so they run first.

**Spike A: the standalone app builds and renders on compat.** Apply the
2B.1 build config only (vue 3.5 + @vue/compat, vue-loader 17, the aliases,
GitLab's compiler wrapper and compat config). Change nothing in oc-pages.
Goal is the dashboard and project pages rendering with @gitlab/ui 60
compiled from `src/`, however many console warnings that produces.

Exit: both pages mount and the route smoke spec passes or fails only on
known Vue 2 patterns. Record every failure category; that list is the 2B.4
work list.

**Spike B: formily renders under that build.** `src/pages/form` is dead
code (its `main.ts` imports a `src/components/` directory that does not
exist, and it is not a `vue.config.js` page). Write a minimal
`src/pages/form-fixture/` entry that mounts `oc_inputs.vue` against a
synthetic schema covering every ComponentMap entry, with a stub store. Run
it on the Spike A build with `@formily/vue` 2.3.7 resolved through the
vue-demi v3 alias and `@formily/element` still present.

Exit: the form renders and values round-trip into the form model. If it
does not, the fallback decision is made here, before 2A.3: vendor
`@formily/vue` and `@formily/reactive-vue`, or replace the form layer. Either
way the fixture page stays; 1.3 and 2A.3 use it too.

### 2A. Vue 2 compatible modernization

Every 2A step is gated by the Phase 1 PR gate and, for form changes, the
dryrun matrix. Steps are independent enough to land as separate PRs in this
order.

**2A.1 @gitlab/ui 60 to 137, Tailwind, utility renames.** The library's
peer range includes Vue 2.7.16, so this is a Vue 2 change.

- bump `vue` and `vue-template-compiler` to 2.7.16, `@gitlab/svgs` to the
  fork's pin
- add `tailwindcss@3` with `@gitlab/ui/tailwind.defaults.js` as the preset
  and content globs over `packages/oc-pages/**/*.{vue,js}` and `src/`
- rename the utility classes that moved (`gl-display-flex` to `gl-flex`,
  `gl-align-items-center` to `gl-items-center`,
  `gl-justify-content-space-between` to `gl-justify-between`,
  `gl-font-weight-normal` to `gl-font-normal`, `gl-flex-direction-row` to
  `gl-flex-row`, `gl-line-height-normal` to `gl-leading-normal`, and the
  rest of the ~25; derive the list by building Tailwind and diffing)
- replace the one GlPaginatedList
- fix prop and variant changes surfaced by console warnings and the route
  smoke screenshots (GlButton variants, GlBadge variants, GlModal action
  props are the usual suspects between these versions)
- decision to record: leave GlDropdown, GlDropdownItem, GlDropdownDivider
  in place (26 uses) or move to GlCollapsibleListbox and
  GlDisclosureDropdown now. Recommendation: leave, unless a component is
  being rewritten anyway.

Exit: PR gate green; screenshot review of every route; `gl-dark` still
works.

**2A.2 Direct Element usage to @gitlab/ui.** 21 files, 53 template tags.

| Element | Replacement |
|---|---|
| el-button (13) | gl-button |
| el-tooltip (12) | `v-gl-tooltip` directive or gl-popover for rich content |
| el-autocomplete (6) | gl-form-combobox (already used once) |
| el-card (5) | gl-card |
| el-input (5) | gl-form-input |
| el-select / el-option (7) | gl-form-select, or gl-collapsible-listbox where searchable |
| el-checkbox (2) | gl-form-checkbox |
| el-tag (1) | gl-badge |
| el-popover (1) | gl-popover |
| el-date-picker (1) | gl-datepicker |
| `v-loading` directive (1) | gl-loading-icon with `v-if` |

Also: remove the `ElLoading` directive and `el-popover` global registrations
in `dashboard/index.js` and `project_overview/index.js` once 2A.3 lands.

Exit: PR gate green; `grep -r "element-ui" packages/oc-pages --include=*.vue`
matches only the formily adapters until 2A.3.

**2A.3 Formily bindings over @gitlab/ui.** New directory
`project_overview/components/shared/oc_inputs/formily-gl/`.

Adapters, written with `connect`, `mapProps`, `mapReadPretty` exactly like
`formily-fake-password.js`:
Input (plus TextArea), InputNumber, Checkbox, Select, Space, PreviewText.

Ports, using `@formily/element/src` as the behavioural reference, with el-*
swapped for gl-* and Element theme classes replaced by our own scss:

- FormItem: label, `tooltip`, `addonAfter` (the generate directive), feedback
  text and status, the layout props oc_inputs.vue sets (`className`,
  `labelWidth`). Note there are two tooltip paths and only one needs porting:
  a property with `tab_title` (261 of 304 `environment` declarations in the
  fixtures) renders through oc_inputs.vue's own `tabTooltip` computed and is
  plain Vue, but an inline one (the other 43) goes through FormItem's
  `tooltip` prop, which @formily/element renders with Element's `Tooltip`.
  smorgasbord's `environment` property covers the second
- ArrayItems with Item, Addition, Remove, and the sortable handle if we use
  it (check `vue-slicksort` usage; drop if not)
- Editable.Popover
- FormLayout

Write the ports against `@formily/vue`'s `h` and `defineComponent`, which
are dual-version, rather than copying the Vue 2 idioms (`$scopedSlots`,
`on:`) in `@formily/element/src`. `@formily/element-plus` ships the same four
components written for Vue 3 and is the reference for the Vue 3 side. Done
this way the ports need no second pass in 2B.4.

Then:

- replace the `.formily-element-form-item-extra` query in `oc_inputs.vue`'s
  `form.onMount` (it runs descriptions through `parseMarkdown`) with a hook on
  our own FormItem. Phase 1 left it in place because @formily/element renders
  that node and there is nowhere to put a testid; it fails silently, so it
  will not show up as a test failure
- copy `composeExport` and `transformComponent` from
  `@formily/element/lib/__builtins__/shared` into `formily-gl/shared.js`
- point the map in `oc_inputs/index.js` at the new components
- remove the whole `setupTheme` mixin in `vue_shared/theme.js`, not only the
  Element imports. It watches `$el` to add `gl-dark` per component, and
  `$el` is not reactive in Vue 3, so that watcher would be silently dead.
  @gitlab/ui 137 handles `gl-dark` on the root; confirm the per-component
  class was only there for Element's theme
- remove `element-ui`, `element-theme-dark`, `@formily/element` from both
  package.json files and the `peerDependencies` in `packages/oc-pages`

Exit: smorgasbord contract spec green; dryrun matrix green; `grep -r
element-ui` across the repo matches nothing outside `node_modules`.

**2A.4 Tree.** Replace `vuejs-tree` in `file-selector.vue` with a small
recursive component of our own. The only API the component relies on is the
`nodes`, `custom-options`, `custom-styles` props and whatever
`this.$refs.stupidTree` is called for at line 128. Fork-only, so it is
validated in 2C; write a jest test for it now since it has no store
dependency.

**2A.5 vue-apollo.** No component in oc-pages has an `apollo:` option. The
only reference is `$apollo.loading` in `vue_shared/components/oc/table.vue`,
which would throw at render once the provider is gone, so delete that
reference first, then `src/vue-apollo.js` and the `apolloProvider` option in
both page entries, and hand the ApolloClient to the store module that queries
with it. This removes the only facade we would otherwise need in the fork's
Vue 3 lane.

**2A.6 Router guards.** Both `dashboard/router/index.js` and
`project_overview/router/index.js` read `router.app.$store` inside guards.
`router.app` does not exist in vue-router 4. Pass the store into
`createRouter()` and close over it. Works on both versions.

**2A.7 Event bus.** `vue_shared/bus.js` is `new Vue()`. Replace with `mitt`
(or a ten-line emitter) with the same `$on`/`$off`/`$emit` names so the seven
importers change only their import. Works on both versions. Leave the
`Vue.extend` calls in `public_cloud/index.js` for 2B; they need `createApp`.

**2A.8 Dead standalone scaffolding.** `src/views/*.vue`, `src/App.vue`,
`src/main.ts`, `src/router/`, and `src/pages/form/` are the vue-cli template
and an abandoned demo, and none are entries in `vue.config.js`. Delete them
and drop `vue-class-component`, `vue-property-decorator`,
`@vue/composition-api`. Confirm nothing imports them first.

### 2B. The Vue 3 switch

One branch. Everything below lands together because the build cannot be half
switched.

**2B.1 Build and runtime.**

- `vue@3.5.x` pinned to the fork's version, `@vue/compat` same version,
  `vue-loader@17`, `@vue/compiler-sfc`; remove `vue-template-compiler`
- `vue.config.js`: alias `vue$` to `@vue/compat`, `@gitlab/ui$` to
  `@gitlab/ui/src` and `@gitlab/ui/dist/charts$` to `@gitlab/ui/src/charts`
  (and transpile `@gitlab/ui/src`), `vue-demi` to `vue-demi/lib/v3/index.mjs`
- vue-loader `compilerOptions.compatConfig`: MODE 2 plus the four
  `COMPILER_*` suppressions from the fork's webpack config
- copy the fork's `config/vue3migration/vue3_template_compiler.js` and use
  it as the vue-loader `compiler`. It is not just flags: it wraps
  `@vue/compiler-dom` with AST rewrites (hoisting `key` from children onto
  `<template v-for>`, stripping comment nodes, `slot` attribute handling,
  `isCustomElement`) that the fork relies on. Stock vue-loader plus flags
  will produce different output from the fork for the same template
- runtime: copy the fork's `compat_config.js` into
  `src/assets/javascripts/vue3compat/` and call `configureCompat` in each
  page entry before anything else
- copy the fork's `vuex.js` and `vue_router.js` facades alongside it and
  alias `vuex` and `vue-router` to them, with `vuex@4` and `vue-router@4`
  installed. oc-pages keeps the `new VueRouter({mode, base, routes})` and
  `new Vuex.Store()` construction shape so the same code compiles in the fork
  (which aliases to the same facades) and here.

**2B.2 Entry points.** Convert the four `new Vue(` sites
(`dashboard/index.js`, `project_overview/index.js`,
`vue_shared/oc_ci_variable_list/index.js`, `public_cloud/index.js`) to
`createApp` with `app.use(store)` and `app.use(router)`, and the four
`Vue.extend` tooltip and pane constructors in `public_cloud/index.js` to
`createApp` + `mount`. Keep the `window.$store` assignment; cypress reads it.

**2B.3 Jest.** `@vue/vue3-jest`, `@vue/test-utils@2`, `moduleNameMapper` for
`vue` to `@vue/compat` and the same aliases as the build. Rewrite the two
tests noted in 1.6.

**2B.4 MODE 3 on every oc-pages component.** Add
`compatConfig: { MODE: 3 }` to every component with a codemod over the 109
`.vue` files. Not a global mixin: a mixin cannot be scoped to oc-pages and
would put every @gitlab/ui component in MODE 3 too, which breaks them. Add a
CI grep that fails on `import Vue from 'vue'` anywhere under
`packages/oc-pages` (25 files today). One rule catches `Vue.set`,
`Vue.extend`, `Vue.component`, `Vue.prototype`, `Vue.nextTick` and `new
Vue(` at once, forces named imports such as `import { nextTick } from
'vue'`, and is safe in the fork because its `vue` facade re-exports
everything from `@vue/compat`. Fix what surfaces; the inventory says:

| Pattern | Count | Fix |
|---|---|---|
| `$set` / `$delete` / `Vue.set` | 28 in 8 files | direct assignment; reactive arrays and objects no longer need it |
| `$listeners` | 3 | `$attrs` |
| `$children` | 1 (`oc-tab.vue`) | a ref on the gl-tab, or expose state via slot props |
| `slot="title"` / `slot="prepend"` | 2 | `v-slot:` / `#` syntax |
| `value` prop + `input` event v-model | 5 components | `modelValue` + `update:modelValue`, with `emits` declared |
| `beforeDestroy` / `destroyed` | 5 | `beforeUnmount` / `unmounted` |
| `$on` on the bus | 14 | done in 2A.7 |
| `watch` on arrays | check | add `deep: true` where the intent was mutation tracking |

**2B.5 JSON viewer.** `vue-json-component` (2020) to `vue-json-pretty@2`
in `oc-properties-list.vue`; it needs Vue 3, so it waits for this step.

**2B.6 Validate.** Run the Phase 1 PR gate and the dryrun matrix. Diff
screenshots. Run the dev build with compat warnings enabled and confirm no
warning originates from an oc-pages component (warnings from `@gitlab/ui/src`
are expected and stay suppressed). Switch CI to the Vue 3 build.

Exit: PR gate and matrix green on Vue 3; the CI grep passes; the Vue 2
build config is deleted.

### 2C. Fork integration on 19.4

- Wire the oc-pages page entries into the fork's Vue 3 lane: the
  `vue3_migrate_*` flag for each entry, or the `?vue3` import marker for the
  `environments/index.js` mount hook. Keep the flags off until this step is
  green.
- Fork Tailwind content globs must include the oc-pages paths or the utility
  classes silently disappear.
- Fork jest and webpack aliases already resolve `vue`, `vuex`, `vue-router`,
  `vue-demi` to the facades 2B.1 mirrored; confirm `@gitlab/ui` is at the
  fork's pin, not ours.
- Mount `oc/dashboard` from the environments hook with the fork's
  `initVueApp` helper.
- Redo `notes-wrapper.vue` against work items. Independent of Vue; it is
  broken today.
- Run the fork-only specs from 1.7 against the fork dev environment.

Exit: full cypress suite green against the fork with the flags on; flags
flipped on in the fork's instance config.

### Sequencing summary

| Step | Vue version | Gate | Size |
|---|---|---|---|
| 1.1 selectors | 2.7 | grep | S |
| 1.2 route smoke | 2.7 | new spec | S |
| 1.3 widget contract | 2.7 | extended spec + matrix | M |
| 1.4 PR gate + baseline | 2.7 | CI | S |
| 1.5 screenshot compare | 2.7 | CI report | S |
| 1.7 fork-only path | 2.7 | ten specs on fork | M, separate budget |
| 2.0 spikes A and B | 3.5 compat, throwaway | dashboard renders; fixture form renders | S |
| 2A.1 @gitlab/ui 137 + Tailwind | 2.7 | PR gate | L |
| 2A.2 direct Element to gl-* | 2.7 | PR gate | M |
| 2A.3 formily bindings | 2.7 | contract spec + matrix | L |
| 2A.4 tree | 2.7 | jest + 2C | S |
| 2A.5 to 2A.8 cleanups | 2.7 | PR gate | S each |
| 2B switch | 3.5 compat | PR gate + matrix + grep | L |
| 2C fork | 3.5 compat | fork suite | M plus notes-wrapper |

## Risks and open decisions

- **@gitlab/ui stays compat-only for the foreseeable future.** The MODE 3
  discipline in 2B.4 keeps our side ready so a later switch to a pure Vue 3
  build is small if GitLab UI ever ships a native Vue 3 build.
- **Formily maintenance.** Last release May 2025; it depends on `vue-demi`,
  which has been proposed for deprecation. Our bindings only depend on
  `connect`, `mapProps`, `mapReadPretty`, `createSchemaField`, and
  `RecursionField` from `@formily/vue`. Fallback is vendoring `@formily/vue`.
  Spike B in 2.0 settles this before 2A.3 starts.
- **GlDropdown successors.** Deferred by default; revisit when a dropdown is
  touched for another reason.
- **Screenshot noise.** Kept non-blocking except for the form screenshot.
- **19.4 pins may move** between now and the fork upgrade landing. Re-check
  the table at the top when 19.4.0 is tagged.
- **Dark mode.** Element's dark theme goes away with 2A.3; confirm the
  `gl-dark` handling in `theme.js` still covers everything that Element was
  styling.
