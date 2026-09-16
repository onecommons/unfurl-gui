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
FIXTURE_BUILD=1 yarn build                           # dist/fixtures/, mounted by 00_visitor
yarn integration-test run --namespace onecommons/blueprints -- \
  --browser chrome -e GENERATE_SUBDOMAINS=true \
  -s cypress/e2e/blueprints/aws__minecraft__minecraft.cy.js
```

`UNFURL_TEST_TMPDIR` must be outside the checkout, or unfurl's parent-walk
adopts this repo's own `_unfurl/` as the parent project. `-s` accepts a
comma-separated list of specs.

**The second build is a prerequisite, not an optional extra.** The fixture
pages compile on their own so the app's chunk graph is computed over the app's
entries alone -- sharing one compilation put whatever they imported into the
app's shared chunks. `yarn build` by itself leaves `dist/fixtures/` absent and
the `gallery`, `dev_settings`, `fork_inputs` and `form_fixture` specs fail. It
only needs rerunning when a fixture page or something it mounts changes. See
`scripts/src/fixture-pages.js`.

Only reach for the container path (`UNFURL_SERVER_IMAGE`, redis,
`CACHE_REDIS_URL`) when you specifically need the rust proxy / redis queue
that CI exercises; see the recipe in the root `CLAUDE.md`. Note that a GDK
redis running on this machine is socket-only (`port 0`) and cannot serve it.

## Where the dashboard lives

Standalone and Unfurl Cloud address the dashboard differently, and specs must not
hardcode either:

| | dashboard home | sub-routes |
|---|---|---|
| standalone | `/` | `/-/environments`, `/-/deployments` |
| unfurl cloud | `/<dashboard project path>` | `/<path>/-/environments` |

`DASHBOARD_DEST` is a **filesystem path** in standalone (e.g.
`local:/tmp/unfurl-debug/ufsv`), not a URL segment. `route_smoke.cy.js`
derives the base from it; copy that logic rather than re-deriving it.

`/home` (the redundant alias in `dashboard/router/routes.js`) 404s in
standalone — the server does not serve the dashboard HTML for it.

## Standalone vs Unfurl Cloud-only specs

`test-status.md` records which specs are known to pass where, and is the place
to update after a run.

The PR gate (`build_test_release.yml`) runs ten specs. Keep this list in step
with the `-s` argument there:

- `00_visitor/route_smoke.cy.js`
- `00_visitor/light_mode.cy.js`
- `00_visitor/gallery.cy.js`
- `00_visitor/dev_settings.cy.js`
- `00_visitor/fork_inputs.cy.js`
- `00_visitor/form_fixture.cy.js`
- `00_visitor/visit_cloudchart.cy.js`
- `deployments/smorgasbord.cy.js`
- `blueprints/aws__minecraft__minecraft.cy.js`
- `blueprints/aws__baserow__baserow.cy.js`

Also runnable standalone:

- `00_visitor/crawl_blueprints.cy.js` and most of `blueprints/`

`visit_cloudchart.cy.js` passes standalone and is in the gate. Its
`Application` category case is commented out: no `<text>` renders for that
category, and whether the cloudmap lacks it or the layout drops the label is
unresolved. The chart also renders `Repository` and `Self-Hosted` labels the
spec's list does not name, so the list and the data have drifted apart in both
directions.

`deployments/smorgasbord.cy.js` is the formily widget contract (migration plan
1.3). It resolves its own project — `onecommons/testing/smorgasbord`, override
with `SMORGASBORD_PROJECT` — rather than deriving it from `REPOS_NAMESPACE`,
because the blueprint lives in the testing namespace while the run's namespace
points at the deployable blueprints.

It asserts that every `ComponentMap` entry it fills round-trips into
`store.state.templateResources` — that is the part the migration must not
change. The **draft-save** half is skipped standalone: saving writes sensitive
properties to a secrets store (CI variables on Unfurl Cloud,
`secrets/secrets.yaml` standalone), and that write 500s with "Failed to update
secrets -- aborting commit". The contract assertions still run.

Still missing from the blueprint for full ComponentMap coverage: an `enum`
property (Select), an `array` property (ArrayItems), and a property named
`environment` (to exercise `EnvironmentTooltip`). `object` with
`additionalProperties` exists as the "Additional Properties" tab but the spec
does not yet drive it.

Unfurl Cloud only — these need a GitLab instance and cannot run against
`unfurl serve --gui`:

- `01_environments/aws.cy.js`, `digitalocean.cy.js`, `gcp.cy.js`,
  `generic.cy.js`, `github_token.cy.js` — drive the environment-creation UI,
  which `unfurl serve --gui` does not have
- `01_environments/aws_role_arn.cy.js`, `gcp_sign_in.cy.js` — the two provider
  methods that talk to Unfurl Cloud's `/-/environments/:name/provider` endpoints.
  Both stub the third party (`cy.intercept` on the provider endpoints) and stop
  at Google's consent screen; everything up to it is real.
- `01_environments/create_dashboard.cy.js` — uses the GitLab project-creation
  UI. The migration plan listed this as "confirm whether it runs standalone";
  it does not.
- `01_environments/a10.cy.js` — imports a GitLab project export through
  `/projects/new`, so it is Unfurl Cloud-only. (Previously "still to confirm".)
- `blueprints/*container-webapp*` (5 specs, including
  `k8s__container-webapp5__container-webapp.cy.js`) — need the GitHub import
  flow and `GithubMirroredRepoImageSource`, which is inside a
  `#!if !standalone` block
- `deployments/shared-dashboard.cy.js`
- `deployments/nested-tabs.cy.js` — uses a container-webapp fixture

The container-webapp five are not dryrun tests and are excluded by default
twice over: `SPEC_SKIP_GLOBS` defaults to `*container-webapp* *nestedcloud*
*draft*`, and three of them additionally wrap their `describe` in
`if(!DRYRUN)` or `if(!NO_FLAKY)`, both of which `STANDALONE_UNFURL` sets.
Running them costs real resources -- the `before()` hook deletes every
`buildpack-test-app-*` repo on the GitHub account, forks
`AjBreidenbach/buildpack-test-app` and renames it, and the deployment that
follows is real. Schedule them deliberately; do not fold them into a
verification pass.

Three of these cannot pass on 19.3 as written. They navigate GitLab's own UI
by `data-qa-selector`, which 19 removed, and none of the hooks they name still
exist: `a10.cy.js` (`data-qa-panel-name="import_project"`,
`gitlab_import_button`, `project_name_field`, `import_project_button`),
`create_dashboard.cy.js` (`data-qa-title="Create new project"`, `panel_link`,
`project_name` -- now `data-testid="project-name"`), and
`shared-dashboard.cy.js` (`mr_widget_content`, `description_content`). Half of
what `create_dashboard` needs is `oc/`-patched UI, so port them against a
running 19.3 instance rather than by reading markup. The assertions in all
three are ours; only the setup navigation is stale, so driving that setup
through the API instead would make them immune to the next redesign.

Running them today gets as far as the page and no further: the oc-pages
dashboard app does not finish its mount on an Unfurl Cloud dashboard page, so
`withStore` times out waiting for `environmentsAreReady`. The console carries a
`Cannot read properties of undefined (reading '_base')` from `<GlModal>` inside
upstream's `<SuperSidebar>`. Auth, user creation and the dashboard push all
work, so start there rather than re-deriving them.

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
generic) still take the GUI path only and are therefore Unfurl Cloud-only.

## Running against Unfurl Cloud (gdk.test)

`<GDK_OC>` -- a GDK checkout running Unfurl Cloud 19.3 -- serves gdk.test, and
`aws__minecraft__minecraft` passes end to end against it. Paths and values in
angle brackets below are placeholders; substitute your own. Two integration
points still cannot be exercised from this repo and gate migration step 2C:
the `environments/index.js` mount hook that mounts `oc/dashboard`, and
`notes-wrapper.vue`, already broken by the work-items switch.

```bash
env -u OC_USERNAME -u OC_PASSWORD OC_INVITE_CODE=cypress-e2e DRYRUN=1 \
  AWS_ACCESS_KEY_ID=foobarbaz AWS_SECRET_ACCESS_KEY=... AWS_DEFAULT_REGION=eu-central-1 \
  UNFURL_TEST_TMPDIR=<SCRATCH_DIR> \
  GOOGLE_APPLICATION_CREDENTIALS=testing-shared/fixtures/service-account.json \
  OC_URL=http://gdk.test:3000 \
  yarn integration-test run --namespace onecommons/blueprints -- \
    -e GENERATE_SUBDOMAINS=true --browser chrome \
    -s cypress/e2e/blueprints/aws__minecraft__minecraft.cy.js
```

**`OC_USERNAME` and `OC_PASSWORD` must be unset.** With both set,
`create-user.js:133` takes the admin path (`POST /admin/users`), which creates
no dashboard — `create_dashboard_project!` is enqueued by the signup controller
alone. Unsetting them routes through `createUserBySignup`, and the dashboard is
built from Unfurl Cloud's own `unfurl_dashboard` project template. Do not substitute
`--dashboard testing-shared/fixtures/dashboards/v2.tgz`: that fixture is the
**standalone** dashboard, and pushing it at Unfurl Cloud tests the wrong artifact.

The import runs in a worker, so the harness waits for the project page before
starting cypress. Nothing else should be waited on: the repository is populated
slightly before GitLab marks the import finished, and until it does every
project page redirects to `/-/import`.

### What the instance needs

- **A running unfurl-server** on the port `gon.unfurl_server_url` names (8081),
  started from a directory **outside this checkout** and with a **dedicated**
  home — never `~/.unfurl_home`, whose `defaults.connections` are inherited into
  every exported environment and arrive as base types that
  `declareAvailableProviders` rejects:

  ```bash
  cd <SCRATCH_DIR>          # NOT the unfurl-gui checkout -- see below
  UNFURL_HOME=<THROWAWAY_UNFURL_HOME> \
  UNFURL_PACKAGE_RULES='gitlab.com/onecommons/* unfurl.cloud/onecommons/* unfurl.cloud/onecommons/* http://gdk.test:3000/onecommons/*' \
    unfurl -vvv serve --port 8081 --cloud-server http://gdk.test:3000
  ```

  **The cwd is load-bearing, and getting it wrong fails silently.** Started
  inside this checkout, unfurl's parent-walk adopts `unfurl-gui/_unfurl` as the
  local project; that path has no `.git` of its own, so the repository it
  resolves to is *unfurl-gui's*. Whenever that is dirty — any uncommitted work —
  every write logs

  ```
  WARNING  UNFURL.SERVER local repository at .../unfurl-gui/_unfurl was dirty, not committing or pushing
  ```

  and is applied but never committed. The write still answers **200**, so the
  client reports success; the dashboard repo stays at its import commit, the
  environments export is legitimately empty, and specs fail far downstream with
  `expected to find content 'Amazon Web Services'` or an empty environments
  store. `UNFURL_SEARCH_ROOT=<SCRATCH_DIR>` caps the parent-walk if you must run
  from here. The server's clone root (`repos/`) also lands in the cwd, which is
  why it is gitignored.

  The package rules are not optional: without them blueprints resolve from real
  unfurl.cloud and pick the highest *tag* rather than gdk.test's `main`.
  **Restart the server after editing unfurl** — python loads modules once, so a
  running server serves the old code and the export quietly returns stale
  results.

### `be.visible` on Unfurl Cloud: three failures, one Cypress rule

`should('be.visible')` does **not** scroll -- only actionability commands like
`click` do -- and Cypress reports an element clipped by a scrollable ancestor
as hidden. Unfurl Cloud's nav, breadcrumb and welcome banner push content past
the fold that standalone keeps within it, so the same assertion passes there and
fails here. Three separate failures on 2026-09-15 were this and nothing else:

- `route_smoke` / `light_mode`, the blueprint's deploy buttons at y=985 in an
  800px viewport;
- `create-gcp-environment.js`, asserting on the provider title after a save
  that lands back on the long blueprint overview.

**How to recognise it rather than re-derive it.** The element is present in the
DOM, has no inline `display:none` or `aria-hidden`, and computes
`visibility: visible` with a real width and height when you query it *after* the
failure -- and its ancestor chain ends in a `gl-truncate` / `.table-section`
inside a long page. Cypress's own `Cypress.dom.getReasonIsHidden($el)` says
"clipped by one of its parent elements" outright; reach for that before
inspecting computed styles by hand, because the styles look innocent.

The fix is `.scrollIntoView()` before the assertion (`.first()` first when the
subject can match several). It does not weaken anything: the content had
rendered correctly in every one of these cases.

### A spec that passes as root and fails on signup is not flaky

It is testing a different user than the product has. Unfurl Cloud sets
`user_default_external` instance-wide, and upstream's `user.rb` forces
`projects_limit: 0` and `can_create_group: false` on any external user in a
`before_save`, so a signup user cannot create GitLab projects. `EXTERNAL=0`
reaches `Cypress.env` but never reaches GitLab: `--external` is only passed on
the admin `POST /admin/users` path (`integration-test.js`), which
`create-user.js` takes only when `OC_USERNAME` and `OC_PASSWORD` are set.

The signup form's own field is `oc_interface` ("What would you like to do?",
`deploy` or `develop`) -- 19.3 replaced 15.11's `role` with it, so a fixture
still posting `role` chooses nothing and takes the form's default of `deploy`.
`create-user.js` now sends `oc_interface` on both the sign-up form and the
welcome step, `develop` when `EXTERNAL=0`. That is necessary but **not
sufficient on its own**: `user.rb` applies `external` as an attribute default
from the instance's `user_default_external` at `User.new`, and the signup path
only ever assigns `external = true` (for `deploy`) -- it never assigns false,
unlike the profile controller, which sets it both ways. So where
`user_default_external` is true, choosing `develop` at signup leaves the
account external regardless. Changing it later in the user's profile does work.

A fix for that asymmetry is with Adam. Note when reading it that `oc_params`
returns `{}` for an absent field, so a bare `resource.external =
simple_interface?` maps **absence to internal** rather than to the form's
default -- the form's default only ever reaches browsers, since a `select`
always posts something. Guarding it with `if oc_params.key?(:oc_interface)`
fixes the reported behaviour without changing what silence means for callers
that send nothing. Either way this fixture now sends the field explicitly.

Three separate failures on 2026-09-15 came down to this axis, so check it
before assuming a regression:

- `01_environments/create_dashboard.cy.js` and `a10.cy.js` 403 on
  `/projects/new`. Correct product behaviour -- a dashboard user is not meant
  to create raw GitLab projects -- so they are `n/a` here rather than failing.
  They can be made to pass as an admin, but an admin is not the user the
  product has, and the admin path now stalls anyway: it creates no dashboard
  and `waitForDashboardRepo` waits for one.
- `01_environments/digitalocean.cy.js` passed on 2026-09-10 and fails now. The
  spec is unchanged; those runs pushed `--dashboard`, the **standalone**
  fixture that pre-declares five environments, so a DigitalOcean provider
  already existed. On a dashboard Unfurl Cloud builds there is none, and
  nothing in the UI creates one -- aws and gcp have inline `*-provider-setup`
  panels, DigitalOcean has none.

The corollary: a pass obtained by pushing `--dashboard` at Unfurl Cloud is not
evidence about Unfurl Cloud. It tests the standalone artifact on the wrong
instance, and it hides exactly this class of gap.

- **Instance CI variables** `UNFURL_VALID_INVITE_CODES` (`cypress-e2e`) and
  `UNFURL_APPROVE_MATCHING_CODES` (`\Acypress-e2e\z`), both protected. The code
  list alone leaves the user `active` with `confirmed_at` NULL, and an
  unconfirmed user cannot authenticate over git HTTP. Both are in gdk-oc's
  documented instance-setup script.

- **`registry.enabled: true`** in `config/gitlab.yml`, or the access-token
  request 400s and no deployment can be triggered; and **`onecommons/ci`
  seeded**, since every dashboard's `.gitlab-ci.yml` is only an `include:` of it.

- **Import sources.** `01_environments/a10.cy.js` imports a project export
  through the GitLab-export pane, which `_import_project_pane.html.haml` guards
  with `- if gitlab_project_import_enabled?` -- so with `gitlab_project` missing
  from the instance's import sources the button is not rendered at all, and the
  spec fails looking for a selector rather than reporting a disabled feature.
  gdk.test now carries production's full set: `github, bitbucket,
  bitbucket_server, fogbugz, git, gitlab_project, gitea, manifest`. Note 19.3
  removed `gitlab` (the GitLab.com importer) and `phabricator` **upstream**, so
  no setting brings those back -- a spec depending on either needs rewriting,
  not configuring.

- **The instance CI variable `UNFURL_CLOUDMAP_JSON`**, for
  `00_visitor/visit_cloudchart.cy.js`. `PublicCloudController#cloudmap` reads
  it and `oc/app/views/public_cloud/index.html.haml` renders
  `#chart{ data: { cloudmap: cloudmap } }`, so an unset variable emits
  `<div id="chart">` with no attribute and the chart never draws -- all seven
  of that spec's cases time out on `#chart svg` or a category label. Confirmed
  on gdk.test 2026-09-15 by reading the served HTML.

- **The blueprint projects the specs deploy.** Only `onecommons/blueprints/
  minecraft` is seeded on gdk.test today, so `blueprints/aws__baserow__baserow`
  -- in the PR gate standalone -- cannot run there at all.

## Specs in one run share a user and a dashboard

The harness creates **one** user and **one** dashboard per invocation, not per
spec. Everything a spec writes -- environments, deployments, CI variables --
is still there for the specs that follow it in the same run.

So a spec can pass alone and fail in a batch. Worked example:
`01_environments/digitalocean.cy.js` passes on its own, and fails reproducibly
when run after `01_environments/generic.cy.js`, because a selector that matches
one element against a dashboard with one environment matches two against a
dashboard with two. The failure reads `cy.click() can only be called on a
single element. Your subject contained 2 elements`, which says nothing about
the real cause.

Two practical consequences:

- **Before believing a batch failure, re-run the spec alone.** A 29-spec
  blueprint batch here failed entirely, including
  `blueprints/aws__minecraft__minecraft`, which passes on its own in the PR
  gate. That result was worthless; the control is the single-spec run.
- **Scope selectors to the thing under test.** `cy.contains('a', 'Resources')`
  is fine; a bare `cy.contains(environmentName)` is not, once a second
  environment exists whose name contains the first as a substring.

The gate's ten specs are ordered so this does not bite them, which is why it
stays invisible until you run something new.

### On Unfurl Cloud the shared dashboard is a dependency, not just a hazard

The standalone harness pushes `testing-shared/fixtures/dashboards/v2.tgz`,
which already contains environments and deployments. Unfurl Cloud builds its
dashboard from its own `unfurl_dashboard` project template, and that one is
**empty** -- so a spec that asserts on dashboard content has nothing to find
until an earlier spec in the same invocation puts it there.

`home.vue` renders its table under `v-if="totalDeploymentsCount > 0"`, so
`.oc-table-row` does not exist on a fresh Unfurl Cloud dashboard at all. That makes
`00_visitor/route_smoke.cy.js` and `00_visitor/light_mode.cy.js` runnable on Unfurl Cloud
only after something has deployed: put `blueprints/aws__minecraft__minecraft`
first in the `-s` list. Creating an *environment* is not enough -- the counter
that gates the table counts deployments.

Batching on Unfurl Cloud used to be impossible for an unrelated reason: the
`UNFURL_SKIP_SAVE` before-each in `support/e2e.js` sent `variables_attributes`
with no `id`, which GitLab treats as a create, so spec 2 failed with
`Variables key (UNFURL_SKIP_SAVE) has already been taken`. It now reads the
variable first and updates it by id.

## What the provider specs do not cover

`aws.cy.js`, `gcp.cy.js` and `digitalocean.cy.js` all passed on gdk through a
run of provider bugs that made the feature unusable by hand. They were green
and the feature was broken because they test a narrower thing than their names
suggest. Three gaps, all found on 2026-09-16:

- **They only ever created a provider, never edited one.** Every assertion ran
  on first-time setup, which is the path that works. Editing an existing aws or
  gcp provider had no entry point at all (`editableProviders` excludes their
  primary; `providerRecorded` suppressed the panel) and no spec noticed.
  `aws.cy.js` now has `Can edit an existing aws provider`, which covers the
  round trip -- reopen, assert the stored values came back, change one field,
  save with the write-only ones blank, reload, assert they survived. gcp has no
  equivalent yet.
- **`aws.cy.js` only uses the access-key method.** `selectAuthenticationMethod`
  picks "Enter your AWS Access Key" every time, so the ARN/role path -- which
  calls `provider/aws/role` and can 404 -- is never exercised.
- **`digitalocean.cy.js` reloads before asserting.** It `cy.visit`s
  `?provider` rather than asserting on the page creation navigated to, so it
  only tested the reloaded state. That hid a bug where the provider's inputs
  rendered empty on the first render and only appeared after a refresh -- the
  exact thing a user hits first. A `cy.visit` between the action and the
  assertion is worth suspecting for this reason, not just for speed.

### "Add a provider connection" is hidden

`ADD_PROVIDER_ENABLED` in `dashboard/pages/environment.vue` is false: the modal
does not work well enough on an environment that already has a provider
(2026-09-16, Adam). The modal, its handlers and `availableProviderTypes` are all
still wired -- only the button is hidden, so turning it back on is that one
flag.

Two things follow for the specs. `route_smoke` guards its screenshot of that
modal behind a `body.find` existence check rather than asserting the button, so
it passes either way -- and `screenshotOverlay` has no other caller, so deleting
that block would quietly drop the only coverage of it. And the list the modal
offers was three of five hardcoded until it was pointed at
`CLOUD_PROVIDER_TYPES`; that fix is real but unreachable while the flag is off.

Generic is deliberately not in that list. It is not the absence of a provider --
a Generic environment gets a `_default_provider` of type
`unfurl.relationships.ConnectsTo.ComputeMachines` -- but that type is absent
from `CLOUD_PROVIDER_ALIASES`, and `isProvider()` resolves through that map, so
offering it without adding the alias would file the connection under Resources
instead of Cloud Provider. Adding the alias reaches seven other call sites that
map a provider to a logo and a friendly name it has neither of.

### The overview-page tests are the ones that catch navigation

`Can create a {aws,gcp} env from the overview page` is the only coverage of the
cross-page hand-off: the deploy dialog sends the user away to build an
environment and expects to land back on the blueprint with it preselected
(`instantiate_env`). Both broke together on 2026-09-16 when
`redirectOnProviderSaved` stopped defaulting to the current URL, and both
failed on the same `deployment-environment-selection-*` assertion.

Two of those failures had been written off as flake on the strength of a
1-of-5 pass rate. They were deterministic. **Two specs failing on the same
assertion is a regression, not flake** -- the pass rate came from runs that
predated the change, not from nondeterminism.

The shape to recognise: a spec that drives a feature through its happy path,
once, on a freshly created object. Prefer asserting on the state the app
navigated to, and cover the second visit -- reopening, editing, re-saving --
because that is where the store is warm and the seeded data is not.

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
  rely on it on Unfurl Cloud.
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
