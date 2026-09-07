# Spike A: does the standalone app build and render on @vue/compat?

Branch `vue3-spike-2.0`, throwaway. vue 3.5.34 + @vue/compat 3.5.34,
vue-loader 17, vuex 4.1.0, vue-router 4.5.1, @gitlab/ui 60 compiled from src/,
the fork's compat_config.js, vuex.js, vue_router.js facades and
vue3_template_compiler.js copied from v19.3.0-ee.

## Result

BUILDS: yes, cleanly.
RENDERS: partly. 3 of 5 dashboard routes render (home, deployments-index,
environments-index). The two parameterized dashboard routes and the project
page do not. Spike A's exit criterion ("both pages mount") is NOT met.

## Build configuration -- resolved, feeds 2B.1

1. thread-loader structured-clones loader options, which strips the template
   compiler's functions: "compiler.compile is not a function". The build has to
   run `parallel: false`. GitLab hits the same limit -- it is why their
   CUSTOM_ELEMENTS is a plain array rather than a predicate.
2. Aliasing `vuex` directly at the facade makes the facade import itself.
   Symptom is "Maximum call stack size exceeded" at load, not a resolution
   error. Keep the fork's `@gitlab/vuex-vue3` / `@gitlab/vue-router-vue3`
   specifiers and alias *those* to the real packages; the facade files then
   stay byte-identical to upstream.
3. `vuex/dist/logger` does not exist in vuex 4 -- createLogger moved to the
   main entry. Two import sites need a shim.
4. @gitlab/ui consumed from src/ needs its own babel-loader rule.

## Application code -- the 2B.4 work list

5. `dashboard.vue:55` reads `$router.options.base`. The router facade consumes
   base into createWebHistory() and sets it undefined, so this throws. Read
   `options.history.base` instead. FIXED in the spike; 3 routes render as a
   result, so this was the single biggest blocker.
6. `Object.freeze` as a reactivity opt-out. A frozen object reaching Vue 3's
   reactive() violates a Proxy invariant:
   "'get' on proxy: property 'metadata' is a read-only and non-configurable
   data property...". Vue 2 treated freeze as "skip reactivity"; Vue 3 wants
   markRaw(). Converting project_application_blueprint.js:585 did not clear it,
   so at least one more frozen object reaches the store -- needs tracing.
   NOTE: template_resources.js carries TODO(#149) comments proposing to add
   more Object.freeze calls. Those should become markRaw or they will add work.
7. `i.call is not a function` inside @vue/compat's _createRoot -- another
   `new Vue()`. Two remain besides the two page entries:
   vue_shared/bus.js (2A.7 replaces it with mitt) and
   vue_shared/oc_ci_variable_list/index.js.
8. `t.call is not a function` from a component's render function. Not yet
   traced to a component.

## Recommendation

Findings 1-4 are settled and should be lifted into 2B.1 as written. Finding 5
is a one-line fix worth doing during 2A since it is version-agnostic.
Findings 6-8 are the real 2B.4 work and want tracing before 2B starts --
6 in particular, because the freeze/markRaw question affects how the store is
written and there is an open TODO pointing the wrong way.

---

# Spike B: does formily render under that build?

`src/pages/form-fixture/` mounts oc_inputs.vue against a synthetic schema
covering every ComponentMap entry with a stub store, served from dist/ and
driven by a cypress spec.

## Result

Split, and the split is the useful part:

- **@formily/vue (the core) works.** FormProvider renders; its Fragment
  component needed one build-config change, below.
- **@formily/element (the Element adapters) does not.** Its components use
  Vue 2's setup context:
  `setup(customProps, { slots, refs })` in form-layout, then
  `useCompatRef(refs)`. Vue 3's context is `{attrs, slots, emit, expose}` --
  there is no `refs` -- so setup throws and nothing below FormLayout renders.

**The plan's fallback is not needed.** Vendoring @formily/vue was the
contingency if the core failed; it does not. What fails is @formily/element,
which 2A.3 already replaces with bindings over @gitlab/ui. So 2A.3 is
confirmed as both necessary and sufficient, and its scope does not grow.

## New build-config requirement

`RENDER_FUNCTION: false` in compat_config.js -- a deliberate deviation from
the fork's, which sets it to 'suppress-warning'.

@formily/vue's Fragment renders `this.$slots.default?.call(this.$slots)`. In
Vue 3 $slots.default is a function; in Vue 2 it is an array of vnodes. With
RENDER_FUNCTION enabled, compat gives every component Vue 2 slot semantics and
that call throws "t.call is not a function". Setting the flag false fixed it.

Two things worth knowing about this:

- Per-component `compatConfig: { MODE: 3 }` does **not** work around it. Tried
  it on the Fragment component directly; the render still went through
  compatRender. Slot shape is decided globally.
- We can afford the flag because @gitlab/ui is compiled from src/ with the
  Vue 3 compiler, so its render functions are already Vue 3. The fork keeps it
  enabled because it has hand-written Vue 2 render functions of its own. We
  have two, both in a test file (public_cloud/cloud-graph-inspector.test.js),
  so the cost is negligible -- but 2B should re-check this if any `render(h)`
  is added to app code.

## Gotcha

webpack-preprocessor-loader parses its directives out of **comments**. Writing
the standalone conditional literally in a docstring makes the build fail with
"Unexpected end of input" while it hunts for the closing directive.
