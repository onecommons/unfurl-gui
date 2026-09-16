# Test status

Which suites are known to pass where. **Only cells with a date were observed;
`unknown` means nobody has run it in that environment, not that it fails.**
Update the cell and its date whenever you run something.

Columns:

- **type** — what the spec drives. Everything reaching `recreateDeployment`
  supports both, since `run-recreate-deployment.js` branches on `DRYRUN` in
  both directions; a `?` marks a guess nobody has confirmed. Empty means the
  spec drives no deployment at all.
- **standalone** — `unfurl serve --gui`, no GitLab. `CI` means
  `.github/workflows/build_test_release.yml` runs it on every PR, so it needs
  no dated observation.
- **gdk** — Unfurl Cloud 19.3 at gdk.test. Start the server *outside* this
  checkout; see "Running against Unfurl Cloud" in the README.
- **staging** — nothing has ever been recorded here.

`skip` means `SPEC_SKIP_GLOBS` drops it by default (`*container-webapp*
*nestedcloud* *draft*`) — it is excluded, not merely unrun. `n/a` for
standalone means the spec needs a GitLab instance and cannot run against
`unfurl serve --gui`. `n/a` for gdk covers two different things: the four
`00_visitor` fixture rows mount a page out of `dist/fixtures/`, whose bundle is
an absolute `/fixtures/js/*.js` that only the standalone server serves -- so
`visitBuiltPage` gets its stubbed document and no application -- while
`yarn test:ufsv-patch` targets no GitLab instance at all.

| Spec                                                        | type | standalone | gdk | staging |
|-------------------------------------------------------------|------|------------|-----|---------|
| `00_visitor/crawl_blueprints.cy.js`                         |  | unknown | unknown | unknown |
| `00_visitor/dev_settings.cy.js`                             |  | CI | n/a | unknown |
| `00_visitor/fork_inputs.cy.js`                              |  | CI | n/a | unknown |
| `00_visitor/form_fixture.cy.js`                             |  | CI | n/a | unknown |
| `00_visitor/gallery.cy.js`                                  |  | CI | n/a | unknown |
| `00_visitor/light_mode.cy.js`                               |  | CI | pass 2026-09-15 | unknown |
| `00_visitor/route_smoke.cy.js`                              |  | CI | pass 2026-09-15 | unknown |
| `00_visitor/visit_cloudchart.cy.js`                         |  | CI | pass 2026-09-15 | unknown |
| `01_environments/a10.cy.js`                                 |  | n/a | failed 2026-09-15 | unknown |
| `01_environments/aws.cy.js`                                 |  | n/a | pass 2026-09-15 | unknown |
| `01_environments/aws_role_arn.cy.js`                        |  | n/a | pass 2026-09-15 | unknown |
| `01_environments/create_dashboard.cy.js`                    |  | n/a | n/a | unknown |
| `01_environments/digitalocean.cy.js`                        |  | n/a | pass 2026-09-15 | unknown |
| `01_environments/gcp.cy.js`                                 |  | n/a | pass 2026-09-15 | unknown |
| `01_environments/gcp_sign_in.cy.js`                         | deploy? | n/a | pass 2026-09-15 | unknown |
| `01_environments/generic.cy.js`                             |  | n/a | pass 2026-09-16 | unknown |
| `01_environments/github_token.cy.js`                        |  | n/a | failed 2026-09-15 | unknown |
| `blueprints/aws__baserow__baserow.cy.js`                    | dryrun, deploy | CI | n/a | unknown |
| `blueprints/aws__container-webapp__container-webapp.cy.js`  | dryrun, deploy | skip | skip | unknown |
| `blueprints/aws__container-webapp__dockerhub.cy.js`         | dryrun, deploy | skip | skip | unknown |
| `blueprints/aws__mediawiki__mariadb.cy.js`                  | dryrun, deploy | unknown | unknown | unknown |
| `blueprints/aws__minecraft__minecraft.cy.js`                | dryrun, deploy | CI | pass 2026-09-15 | unknown |
| `blueprints/aws__nestedcloud__nestedcloud.cy.js`            | dryrun, deploy | skip | skip | unknown |
| `blueprints/aws__nextcloud__floatingip.cy.js`               | dryrun, deploy | unknown | unknown | unknown |
| `blueprints/aws__nextcloud__memorydb.cy.js`                 | dryrun, deploy | unknown | unknown | unknown |
| `blueprints/aws__nextcloud__postgres.cy.js`                 | dryrun, deploy | unknown | unknown | unknown |
| `blueprints/aws__nextcloud__sh.cy.js`                       | dryrun, deploy | unknown | unknown | unknown |
| `blueprints/aws__nextcloud__volume.cy.js`                   | dryrun, deploy | unknown | unknown | unknown |
| `blueprints/aws__wordpress__mysql.cy.js`                    | dryrun, deploy | unknown | unknown | unknown |
| `blueprints/aws__wordpress__sh.cy.js`                       | dryrun, deploy | unknown | unknown | unknown |
| `blueprints/az__container-webapp__container-webapp.cy.js`   | dryrun, deploy | skip | skip | unknown |
| `blueprints/az__nestedcloud__nestedcloud.cy.js`             | dryrun, deploy | skip | skip | unknown |
| `blueprints/az__nextcloud__nextcloud.cy.js`                 | dryrun, deploy | unknown | unknown | unknown |
| `blueprints/az__nextcloud__sh.cy.js`                        | dryrun, deploy | unknown | unknown | unknown |
| `blueprints/do__nestedcloud__nestedcloud.cy.js`             | dryrun, deploy | skip | skip | unknown |
| `blueprints/do__nextcloud__mail.cy.js`                      | dryrun, deploy | unknown | unknown | unknown |
| `blueprints/gcp__baserow__sh.cy.js`                         | dryrun, deploy | unknown | unknown | unknown |
| `blueprints/gcp__cachet__cachet.cy.js`                      | dryrun, deploy | unknown | unknown | unknown |
| `blueprints/gcp__container-webapp__container-webapp.cy.js`  | dryrun, deploy | skip | skip | unknown |
| `blueprints/gcp__cronicle__cronicle.cy.js`                  | dryrun, deploy | unknown | unknown | unknown |
| `blueprints/gcp__discourse__discourse.cy.js`                | dryrun, deploy | unknown | unknown | unknown |
| `blueprints/gcp__etherpad__etherpad.cy.js`                  | dryrun, deploy | unknown | unknown | unknown |
| `blueprints/gcp__ghost__ghost.cy.js`                        | dryrun, deploy | unknown | unknown | unknown |
| `blueprints/gcp__mediawiki__mariadb.cy.js`                  | dryrun, deploy | unknown | unknown | unknown |
| `blueprints/gcp__memos__memos.cy.js`                        | dryrun, deploy | unknown | unknown | unknown |
| `blueprints/gcp__minecraft__minecraft.cy.js`                | dryrun, deploy | unknown | unknown | unknown |
| `blueprints/gcp__nestedcloud__nestedcloud.cy.js`            | dryrun, deploy | skip | skip | unknown |
| `blueprints/gcp__nextcloud__fullsh.cy.js`                   | dryrun, deploy | unknown | unknown | unknown |
| `blueprints/gcp__nextcloud__memorystore.cy.js`              | dryrun, deploy | unknown | unknown | unknown |
| `blueprints/gcp__nextcloud__postgres.cy.js`                 | dryrun, deploy | unknown | unknown | unknown |
| `blueprints/gcp__nextcloud__volume.cy.js`                   | dryrun, deploy | unknown | unknown | unknown |
| `blueprints/gcp__openvscode-server__openvscode-server.cy.js`| dryrun, deploy | unknown | unknown | unknown |
| `blueprints/k8s__container-webapp5__container-webapp.cy.js` | dryrun, deploy | skip | skip | unknown |
| `blueprints/k8s__ghost__ghost.cy.js`                        | dryrun, deploy | unknown | unknown | unknown |
| `blueprints/k8s__wordpress__wordpress.cy.js`                | dryrun, deploy | unknown | unknown | unknown |
| `deployments/clone-draft.cy.js`                             | dryrun, deploy | skip | skip | unknown |
| `deployments/drafts.cy.js`                                  | dryrun, deploy | skip | skip | unknown |
| `deployments/k8s-secondary-provider.cy.js`                  | dryrun, deploy | unknown | unknown | unknown |
| `deployments/multiple-workflows.cy.js`                      | dryrun, deploy | unknown | unknown | unknown |
| `deployments/nested-tabs.cy.js`                             | dryrun, deploy | unknown | unknown | unknown |
| `deployments/node-filter.cy.js`                             | dryrun, deploy | unknown | unknown | unknown |
| `deployments/shared-dashboard.cy.js`                        | dryrun, deploy | n/a | unknown | unknown |
| `deployments/shared-redis.cy.js`                            | dryrun, deploy | unknown | unknown | unknown |
| `deployments/shared-volume-aws.cy.js`                       | dryrun, deploy | unknown | unknown | unknown |
| `deployments/shared-volume-gcp.cy.js`                       | dryrun, deploy | unknown | unknown | unknown |
| `deployments/smorgasbord.cy.js`                             |  | CI | pass 2026-09-15 | unknown |
| `yarn test:ufsv-patch`                                      | dryrun | unknown | n/a | n/a |

## Provenance of the dated cells

- **gdk, 2026-09-16** -- re-ran minecraft, `route_smoke`, `light_mode`,
  `visit_cloudchart` and `smorgasbord` against a rebuilt unfurl-server carrying
  the queue fix: 17 pass, 2 pending, 0 fail. A first attempt without minecraft
  cost four `.oc-table-row` timeouts -- the ordering rule below is load-bearing
  per invocation, because each one signs up a new user whose dashboard is empty.

- **gdk, 2026-09-15** — the CI gate specs against gdk.test through the rust
  proxy with redis. Two ordering facts, both learned the hard way:

  - **Put a deploying spec first.** Unfurl Cloud's dashboard is built from its own
    `unfurl_dashboard` template and starts empty, and `home.vue` only renders
    its table when `totalDeploymentsCount > 0`, so `route_smoke` and
    `light_mode` find no `.oc-table-row` until something has deployed. Running
    `aws__minecraft__minecraft` ahead of them turns three 30s timeouts into
    three passes. Standalone never hits this: its `v2.tgz` fixture dashboard
    ships with deployments.
  - **Specs can share an invocation now.** They could not before: the
    `UNFURL_SKIP_SAVE` before-each sent `variables_attributes` with no `id`,
    which GitLab treats as a create, so spec 2 died with "has already been
    taken". It now reads the variable and updates it by id.

- **gdk, 2026-09-15** — `aws__minecraft__minecraft` was 4 pass / 2 fail until
  the deploy-trigger race was fixed, then 3 / 3. The two failures were not
  flake: `triggerSave()` resolves when the proxy *queues* a write (2-4ms), not
  when it commits (~3s later), and the pipeline GitLab then creates pins the
  SHA the branch had at creation time -- so the job checked out a commit
  predating the deployment and died on `Can't find an Unfurl ensemble or
  project in folder`. Waiting in the runner could not have helped. Fixed by
  `awaitQueuedWrite()` before `triggerAtomicDeployment`; the proxy was already
  answering 503 + Retry-After and nothing on the client was retrying.

- **gdk, 2026-09-15** — `route_smoke` and `light_mode` went green once three
  separate defects were fixed; each was hiding the next, which is why the cells
  read `failed` for most of the day:

  1. **`yourDeployments` wrote to store objects** (`project_overview/store/
     modules/project.js`). `store/index.js:33` is `strict: development`, so
     Unfurl Cloud's dev build throws out of the getter while our production
     build does not -- the page landmark rendered and the body did not. Fixed
     by spreading into copies.
  2. **The cells dereferenced an undefined `deploymentItem` during render.**
     `deploymentItemDirect` returns undefined until `populateDeploymentItems`
     has run, which happens after a jobs fetch; `no-router` (which the project
     overview passes and the dashboard does not) sends `resource-cell` down the
     `deploymentItem.viewableLink` branch. The resulting TypeError killed the
     renderer, destroying its own evidence -- it is neither a recursion nor an
     OOM, though it imitates both. Fixed with optional chaining in the three
     render-path cells.
  3. **`be.visible` does not scroll** and reports content clipped by a
     scrollable ancestor as hidden. Unfurl Cloud's nav, breadcrumb and welcome
     banner put the blueprint's deploy buttons at y=985 in an 800px viewport,
     so a correctly rendered page failed. Fixed with `.first().scrollIntoView()`
     in both specs. Standalone has less chrome and never hit it.

- **gdk, 2026-09-15** — the `01_environments` specs, each run alone.
  `aws_role_arn` passes 3/3. `aws` and `gcp` pass their environment-creation
  halves and fail their overview halves, which visit
  `onecommons/testing/simple-blueprint` -- that blueprint imports the obsolete
  `onecommons/unfurl-types`, so its export 500s with a `FatalToscaImportError`
  and the page renders no template rows. It is a stale fixture, not a seeding
  gap: unfurl-types is not coming back (Adam, 2026-09-15).

  **Both now pass, and neither needed anything seeded.** `SIMPLE_BLUEPRINT` is
  configurable, so pointing it at a blueprint that is not stale is enough:

      SIMPLE_BLUEPRINT=minecraft

  whose overview renders all five cloud rows. **Set it for `aws` and `gcp` or
  they fail on the default blueprint.** Two spec defects surfaced behind it,
  both of which had been masked by the pushed `--dashboard` fixture:

  - `cy.contains('button', ENVIRONMENT_NAME).should('be.visible')` -- the only
    button carrying the name is the entry in the environment dropdown, a closed
    menu, so this asserted that a correctly hidden menu item was showing. Both
    specs now assert `[data-testid="deployment-environment-selection-<name>"]`
    exists, which is the durable outcome and uses a testid rather than the
    `.dropdown-toggle.btn-default` the file's own TODO complains about.
  - `create-gcp-environment.js`'s `cy.contains('Google Cloud Platform')` ran
    after a save that lands back on the long blueprint overview, where the text
    sits below the fold -- the same clipped-by-a-scrollable-ancestor rule as
    `route_smoke`. Fixed with `.scrollIntoView()`.

  `create_dashboard` and `a10` 403d on `/projects/new` until Adam made the
  signup controller honour `oc_interface` (option c, committed and live
  2026-09-16): an explicit `develop` now clears the external default, while a
  client that omits the field is unaffected. With `EXTERNAL=0` the harness sends
  `develop` and the user can create projects. Verified end to end -- the first
  real signup through it.

  **`create_dashboard` then fails because it cannot run on this path at all.**
  `The form contains the following error: Path has already been taken` -- it
  asks for a *second dashboard for the same user*. The signup controller
  enqueues `CreateDashboardProjectWorker`, so the user already has
  `<user>/dashboard`, and the spec's project name must be exactly `dashboard`
  because oc-pages resolves a dashboard by convention rather than by id.

  **Unfurl Cloud has always created a dashboard at signup, for every user**
  (Adam, 2026-09-16) -- so this is not a premise that went stale. The spec can
  only ever have worked on the **admin path**, where `create-user.js` creates no
  dashboard unless `--dashboard` is passed. That matches the 2026-09-10 runs,
  which used `OC_USERNAME=root`. It is written for the
  **built-in `root` admin**, the one account that starts without a dashboard --
  every other user gets one at signup. Hence `n/a`: skipped by decision (Adam,
  2026-09-16), not broken. It also stalls on the admin path today, because
  `waitForDashboardRepo` waits for a dashboard that path never creates.

  The original 403 analysis, kept because it explains the mechanism: Unfurl Cloud sets `user_default_external`, and
  `user.rb:3211` forces `projects_limit: 0` on any external user, so a signup
  user cannot create GitLab projects. `EXTERNAL=0` reaches Cypress but never
  reaches GitLab, because `--external` is only passed on the admin
  `POST /admin/users` path. Those two specs can therefore only pass as an
  admin -- and an admin is not the user the product has, so a green cell from
  that path would be worth little. The admin path also stalls now: it creates
  no dashboard, and `waitForDashboardRepo` waits for one.

  `digitalocean` now passes, after **two product bugs and a defaulted
  variable** -- each of which hid the next:

  1. **No DigitalOcean provider was created at all.**
     `environment-creation-dialog.vue`'s `PROVIDER_TEMPLATE_AT_CREATION` listed
     only Kubernetes, GCP and AWS, so selecting Digital Ocean (or Azure) wrote
     no `primary_provider` and the environment got the generic
     `_default_provider` (`ComputeMachines`, whose only input is `credential`).
     DO and Azure belong with K8s -- their type is all the template needs, the
     credentials being ordinary formily inputs -- so they were added to it.
  2. **The inputs form was gated on values rather than on the schema.**
     `oc_inputs.vue` rendered only `v-if="card.properties?.length"`, but
     `getMainInputs()` builds its fields from `schemaFields`; `card.properties`
     only supplies *values*. A provider that was just created has none, so the
     form was hidden -- an `Inputs 4` tab over an empty body (Adam's
     screenshot). This affects Azure and K8s equally, and is **not** a Vue 3
     regression: the previous `!card.properties.length == 0` means the same
     thing. It stayed invisible while the harness pushed the standalone
     `--dashboard` fixture, whose providers already had values.
  3. `DIGITALOCEAN_TOKEN` had no fallback here, unlike `environments.js`, so an
     unset variable surfaced as `cy.type() ... You passed in: undefined` several
     steps after the real cause. Defaulted.

  Fixing (1) then exposed a fourth thing, reported by Adam from the UI and
  invisible to this spec: creating a DigitalOcean environment threw up an
  **empty dialog** first. The dialog redirects to a bare `?provider`, which
  opens the generic provider modal -- and that modal exists to collect inputs
  *before* there is a template to write, so once the template is written at
  creation it has nothing to show. It now redirects without `?provider` when it
  created the template and no extra instances, which sends the user straight to
  the environment page where the Edit button holds those fields. Kubernetes
  still opens it: it creates a `k8sDefaultIngressController` alongside, which
  the modal is how you configure. **Note the spec could not have caught this** --
  `create-digitalocean-environment.js` navigates to `?provider` itself, so it
  never sees the post-creation redirect.

- **gdk, 2026-09-15** — `github_token` had never been run anywhere. It failed
  first on `[data-qa-selector="personal_access_token_field"]`, another casualty
  of GitLab 19 dropping those hooks product-wide -- `import/github/new.html.haml`
  now renders `data-testid="personal-access-token-field"` (underscores to
  hyphens), and the authenticate button likewise. `support/github.js` accepts
  both spellings now, since gdk-ee is still 15.11.

  With the selector fixed it reaches the field and fails on an unset
  `GITHUB_ACCESS_TOKEN`. **Not defaulted, deliberately**: the spec's whole
  purpose is authenticating against GitHub, and its helper asserts nothing
  afterwards, so a placeholder would make it pass while testing nothing. It
  needs a real token to mean anything. (The PAT embedded in this checkout's
  `github` remote is flagged for rotation and must not be used for this.)

- **gdk, 2026-09-16** — `a10` gets past the 403 now that signup honours
  `oc_interface`, and past its three dead `data-qa-selector` hooks
  (`gitlab_import_button` -> `gitlab-import-button`, `project_name_field` ->
  `project-name`, `import_project_button` -> `import-project-button`; the spec
  accepts both spellings since gdk-ee is still 15.11). It now stops because the
  **`gitlab_project` import source is disabled on the instance**:
  `_import_project_pane.html.haml` guards that button with
  `- if gitlab_project_import_enabled?`, so it is not rendered at all rather
  than renamed. Needs `gitlab_project` added to the instance's import sources --
  instance configuration, like `UNFURL_CLOUDMAP_JSON` was.

- **gdk, 2026-09-15** — `generic` alone, before the above was understood.
- **gdk, 2026-09-14** — `gcp_sign_in` was 2/3; not investigated.

## Gaps this table makes visible

- **staging has no evidence at all** — every cell in that column is a claim
  nobody has checked.

- **No spec anywhere is confirmed to have run as `deploy` rather than
  `dryrun`.** The type column says what is supported, not what was exercised.

- **`yarn test:ufsv-patch` runs nowhere automatically** —
  `build_test_release.yml` carries `# TODO add back ufsv-patch -- --runInBand`.

- **`blueprints/aws__baserow__baserow` is out of scope on gdk, by decision.**
  It is in the PR gate standalone, but `onecommons/blueprints` there holds only
  `minecraft` and baserow will not be seeded (Adam, 2026-09-15) -- hence `n/a`
  rather than `unknown`. The repository exists and is clonable at unfurl.cloud;
  that has no bearing on what gdk serves.

- **Standalone CI cannot see a whole class of bug.** `store/index.js:33` is
  `strict: development`, so vuex strict is on in Unfurl Cloud's build and off in
  our production one: a getter that mutates store state passes standalone and
  throws there. That is how the `yourDeployments` defect survived. Either build
  the standalone gate with strict on, or accept that Unfurl Cloud is the only
  place this class surfaces -- and that it surfaces only in states the specs
  reach late, since it needs the user to already have a deployment.

- **A render-time TypeError reads as a renderer crash, not as an error.** The
  `deploymentItem` defect killed the tab with no stack, no console error and no
  DOM snapshot -- it imitates both a stack overflow and an OOM, and every probe
  that ran *inside* the page died with it. `errorCaptured` on the nearest
  component is what surfaced it; reach for that first next time rather than
  bisecting structure.
