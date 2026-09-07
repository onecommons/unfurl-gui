# Cypress suites

This describes which specs run where, how to run them locally, and the
selector conventions the Vue 3 migration depends on. See
`docs/vue3-migration-plan.md` for why.

## Running locally (standalone, no docker)

The integration harness runs `unfurl serve --gui` itself. If
`UNFURL_SERVER_IMAGE` is unset it runs the **locally installed** `unfurl`
rather than a container, which needs no docker and no redis:

```bash
export UNFURL_TEST_TMPDIR=/tmp/unfurl-debug          # must be OUTSIDE this checkout
export UNFURL_SEARCH_ROOT=/tmp/unfurl-debug
export STANDALONE_SETUP_SCRIPT=testing-shared/unfurl-init-setup.sh
export GOOGLE_APPLICATION_CREDENTIALS=testing-shared/fixtures/service-account.json
mkdir -p "$UNFURL_TEST_TMPDIR"

yarn build                                           # unfurl serve --gui serves dist/
yarn integration-test run --namespace onecommons/blueprints -- \
  --browser chrome -e GENERATE_SUBDOMAINS=true \
  -s cypress/e2e/blueprints/aws__minecraft__minecraft.cy.js
```

`UNFURL_TEST_TMPDIR` must be outside the checkout, or unfurl's parent-walk
adopts this repo's own `_unfurl/` as the parent project. `-s` accepts a
comma-separated list of specs.

Only reach for the container path (`UNFURL_SERVER_IMAGE`, redis,
`CACHE_REDIS_URL`) when you specifically need the rust proxy / redis queue
that CI exercises; see the recipe in the root `CLAUDE.md`. Note that a GDK
redis running on this machine is socket-only (`port 0`) and cannot serve it.

## Where the dashboard lives

Standalone and the fork address the dashboard differently, and specs must not
hardcode either:

| | dashboard home | sub-routes |
|---|---|---|
| standalone | `/` | `/-/environments`, `/-/deployments` |
| fork | `/<dashboard project path>` | `/<path>/-/environments` |

`DASHBOARD_DEST` is a **filesystem path** in standalone (e.g.
`local:/tmp/unfurl-debug/ufsv`), not a URL segment. `route_smoke.cy.js`
derives the base from it; copy that logic rather than re-deriving it.

`/home` (the redundant alias in `dashboard/router/routes.js`) 404s in
standalone — the server does not serve the dashboard HTML for it.

## Standalone vs fork-only specs

The PR gate (`build_test_release.yml`) runs:

- `00_visitor/route_smoke.cy.js`
- `deployments/smorgasbord.cy.js`
- `blueprints/aws__minecraft__minecraft.cy.js`

Also runnable standalone:

- `00_visitor/crawl_blueprints.cy.js` and most of `blueprints/`
- `00_visitor/visit_cloudchart.cy.js` — **currently fails standalone**: a bare
  `unfurl init` fixture project has no cloudmap data, so `#chart svg` never
  renders. `route_smoke.cy.js` skips the same route unless
  `UNFURL_CLOUDMAP_PATH` is set.

`deployments/smorgasbord.cy.js` is the formily widget contract (migration plan
1.3). It resolves its own project — `onecommons/testing/smorgasbord`, override
with `SMORGASBORD_PROJECT` — rather than deriving it from `REPOS_NAMESPACE`,
because the blueprint lives in the testing namespace while the run's namespace
points at the deployable blueprints.

It asserts that every `ComponentMap` entry it fills round-trips into
`store.state.templateResources` — that is the part the migration must not
change. The **draft-save** half is skipped standalone: saving writes sensitive
properties to a secrets store (CI variables in the fork,
`secrets/secrets.yaml` standalone), and that write 500s with "Failed to update
secrets -- aborting commit". The contract assertions still run.

Still missing from the blueprint for full ComponentMap coverage: an `enum`
property (Select), an `array` property (ArrayItems), and a property named
`environment` (to exercise `EnvironmentTooltip`). `object` with
`additionalProperties` exists as the "Additional Properties" tab but the spec
does not yet drive it.

Fork-only — these need a GitLab instance and cannot run against
`unfurl serve --gui`:

- `01_environments/aws.cy.js`, `digitalocean.cy.js`, `gcp.cy.js`,
  `generic.cy.js`, `github_token.cy.js`
- `01_environments/create_dashboard.cy.js` — uses the GitLab project-creation
  UI (`[data-qa-title="Create new project"]`, `#project_name`). The migration
  plan listed this as "confirm whether it runs standalone"; it does not.
- `01_environments/a10.cy.js` — still to confirm.
- `blueprints/*container-webapp*` (4 specs) — need the GitHub import flow and
  `GithubMirroredRepoImageSource`, which is inside a `#!if !standalone` block
- `deployments/shared-dashboard.cy.js`
- `deployments/nested-tabs.cy.js` — uses a container-webapp fixture

The `#!if !standalone` preprocessor blocks in
`project_overview/components/shared/oc_inputs/index.js` are the reason: the
file selector and the image-source widgets are compiled out of the standalone
bundle entirely.

## Creating environments standalone

There is no environment-creation UI in `unfurl serve --gui`, and no
external-resource (DNS/mail) UI. `createAWSEnvironment` and
`createGCPEnvironment` branch on `STANDALONE_UNFURL` and write the environment
straight into the dashboard project with

```bash
testing-shared/ufhome-add-environment.sh <provider> "$UNFURL_TEST_TMPDIR/ufsv" <name>
```

which copies `testing-shared/fixtures/environments/<provider>.yaml` in and runs
`unfurl init --empty --use-environment`. `shouldCreateExternalResource` is
skipped standalone. The other providers (azure, digitalocean, kubernetes,
generic) still take the GUI path only and are therefore fork-only.

## Fork-only validation path (migration plan 1.7)

Two integration points and the specs above cannot be exercised from this
repo, and they gate migration step 2C:

- the `environments/index.js` mount hook that mounts `oc/dashboard`
- `notes-wrapper.vue`, already broken by the work-items switch

There is a GDK at `/Users/adam/_dev/gdk-oc`, but as of this writing its
`gitlab/` checkout is on upstream `master` (19.4.0-premaster) with no `oc*`
directories — it is a vanilla GitLab, not the unfurl.cloud fork. **Deciding
the fork environment is still open** and is its own budget line: either check
the fork branch out into that GDK, or build an image of the fork. Once one
exists, run the fork-only specs listed above against it on 15.11 first, to
produce the fork-side baseline that 2C is compared against.

## Selector conventions

The migration replaces element-ui and bumps @gitlab/ui by ~77 major versions,
so specs must not depend on either library's DOM.

**Never** use `.el-*` or `.formily-element-*` classes. Two greps guard this:

```bash
grep -rE "\.el-|formily-element" cypress/     # must be empty
grep -rE '\]\s+(input|textarea)' cypress/     # must be empty
```

The second one matters because the testid lands in a different place
depending on the library. With element-ui it appears on **both** the
`.el-input` wrapper and the inner `<input>` (element's `inheritAttrs: false`
puts it on the input, and Vue 2 attribute fall-through puts it on the
wrapper). `gl-form-input` *is* the input, so it appears once. Use
`cy.getInputOrTextarea(selector)`, which matches either shape.

### Test ids on generated form fields

`oc_inputs.vue` `convertProperties()` is the single choke point for every
formily field's testid. Names are `oc-input-<card>-<dotted property path>`:

| element | testid |
|---|---|
| the widget | `oc-input-the_app-text` |
| its FormItem (label, tooltip, addon) | `oc-input-the_app-text-item` |
| a nested object's field | `oc-input-the_app-object_inputs.text` |
| a nested tab's field | `oc-input-the_app-container.ports` |
| ArrayItems add / remove | `…-add` / `…-remove` |
| key/value editor cells | `…-key` / `…-value` |
| the generate directive's button | `…-generate` |
| the rendered form | `oc-inputs-form` |

The dotted path is why specs no longer scope by `.el-popover` to reach the
object popover's fields, and why a nested tab's `ports` cannot collide with a
top-level one (both stay in the DOM under `v-show`).

`data-input-type` carries the **schema** type (`string`, `number`, `boolean`,
`object`, `array`) next to `data-testid`, so `run-recreate-deployment.js` can
decide whether to type or click without reading library classes.

### Route landmarks

Each route asserts one landmark testid: `dashboard-home-page`,
`dashboard-deployments-page`, `dashboard-environments-page`,
`dashboard-deployment-page`, `dashboard-environment-page`,
`project-home-page`, `project-templates-page`.

## Screenshots and the baseline

`route_smoke.cy.js` writes `route-smoke/<route>.png` and `smorgasbord.cy.js`
writes `formily/*.png`. The viewport is pinned in `cypress.config.mjs`
(1280x800), and captures are **full page** via `cy.screenshotPage()` /
`cy.screenshotElement()` rather than viewport-limited.

Two things those helpers exist for:

- A fullPage capture scrolls and stitches, so anything `position: fixed` is
  redrawn in every slice — the nav bar repeated three times down the taller
  pages, *covering real content* (a whole deploy-blueprint row on
  project-home). The helpers hide fixed elements for the shot. They do **not**
  set `position: static`: that puts the element into flow, which grew every
  page by 40px and re-parented absolutely-positioned descendants, landing the
  environment page's credential card on top of the provider row.
- Screenshot only after asserting on content, never on a page wrapper. See
  below.

The `smoke()` helper takes both a `landmark` (the page wrapper) and a
`content` selector that only exists once data has rendered — `.oc-table-row`,
set by `table.vue`/`table_list_row.vue` on data rows only, or
`[data-testid^="deploy-template-"]`. Asserting only the wrapper passes the
instant the component mounts, which screenshots a blank page and detects
nothing; that is exactly what the first version of this spec did.

Baselines are **per platform** — `cypress/baseline/darwin/` and
`cypress/baseline/linux/` — because font rendering moves ~4-6% of pixels
between macOS and Linux, which would swamp a real regression. Raising the
threshold past that is the wrong fix: it would also hide any regression
smaller than 6%. The comparison always runs same-platform, so the diff means
"did this change break something", not "which OS am I on".

```bash
./scripts/src/compare-screenshots.js               # report only, always exits 0
SCREENSHOT_PLATFORM=linux ./scripts/src/compare-screenshots.js   # check CI's set
./scripts/src/compare-screenshots.js --strict 'formily/the_app-filled.png'
SCREENSHOT_DIFF_THRESHOLD=0 ./scripts/src/compare-screenshots.js # true determinism
```

CI runs the report non-blocking, then gates `formily/the_app-filled.png`,
which guards every widget 2A.3 rewrites. Only that one is gated, because at
`SCREENSHOT_DIFF_THRESHOLD=0` three images are not deterministic between runs:
both deployment tables carry a `Last Update` timestamp, and `object-popover`
the random deployment-title suffix. They pass today only because 0.01% falls
under the 0.5% threshold — masked, not stable. The other four route-smoke
images are pixel-identical across runs and are candidates for the gate once
they have proven so on CI too.

The platform comes from `process.platform`, overridable with
`SCREENSHOT_PLATFORM`. If no per-platform directory exists it falls back to a
flat `cypress/baseline/`. Both sets are from full-page captures and have identical dimensions, so only
text rendering differs between them: 0.5-3% of pixels, against a 0.5%
threshold. Same-platform comparisons should sit at 0%.

Refresh a platform's set from a green run:

```bash
gh run download <run-id> -n cypress-screenshots -D /tmp/ci-shots
rm -rf cypress/baseline/linux/route-smoke
cp -R /tmp/ci-shots/00_visitor/route_smoke.cy.js/route-smoke cypress/baseline/linux/
```

It tolerates a missing baseline and a dimension change rather than throwing,
and writes `<name>.png` (diff mask), `.current.png` and `.baseline.png` into
`cypress/screenshot-diffs/` for anything that moved. Keep it non-blocking
until an image has been stable for several runs.

## Gotchas

- `e2e.js`'s `before` hook tries to skip login for visitor specs with
  `Cypress.spec.name.startsWith('00_visitor')`, but `Cypress.spec.name` is the
  **basename** (`route_smoke.cy.js`), so the check never matches and the hook
  runs for every spec. Harmless standalone (there is no login), but do not
  rely on it in the fork.
- `e2e.js` pipes browser `console.*`, window errors and unhandled rejections
  into `cy.task('log')` as `[browser …]` lines, and its `uncaught:exception`
  handler returns `false` — so it never fails a test. A spec that wants to
  assert on page errors must collect them itself, as `route_smoke.cy.js` does.
- Cypress 11 throws `Cannot read properties of undefined (reading 'set')` from
  its own `ProxyLogging.logIncomingRequest`. Filter it by stack; it is not an
  application error.
- `/home` (declared in `dashboard/router/routes.js`, and already commented
  `// redundant`) 404s on a page load. `unfurl/server/gui.py` splits the path on
  `/-/` and treats everything before it as a project path, so `/home` is looked
  up as a project named "home" and misses. It works only as in-app client-side
  navigation. Pre-existing; not a migration issue.
- One app-code coupling to element/formily classes survives Phase 1:
  `oc_inputs.vue`'s `form.onMount` queries
  `.formily-element-form-item-extra` to run descriptions through
  `parseMarkdown`. There is nowhere to hang a testid because @formily/element
  renders that node, so it has to wait for migration step 2A.3. Unlike the
  `GenerateDirective` coupling (which threw), this one fails silently —
  descriptions would just stop being markdown-rendered.
- Cypress clears `cypress/screenshots` before each run
  (`trashAssetsBeforeRuns`), so a baseline must be captured from a single run.
  `cy.screenshot('route-smoke/x')` writes to
  `cypress/screenshots/<spec file>/route-smoke/x.png`; the compare script walks
  recursively, so the spec directory in the path does not matter.
