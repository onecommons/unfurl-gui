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
- **gdk** — the 19.3 fork at gdk.test. Start the server *outside* this
  checkout; see "Running against the fork" in the README.
- **staging** — nothing has ever been recorded here.

`skip` means `SPEC_SKIP_GLOBS` drops it by default (`*container-webapp*
*nestedcloud* *draft*`) — it is excluded, not merely unrun. `n/a` for
standalone means the spec needs a GitLab instance and cannot run against
`unfurl serve --gui`.

| Spec                                                        | type | standalone | gdk | staging |
|-------------------------------------------------------------|------|------------|-----|---------|
| `00_visitor/crawl_blueprints.cy.js`                         |  | unknown | unknown | unknown |
| `00_visitor/dev_settings.cy.js`                             |  | CI | unknown | unknown |
| `00_visitor/fork_inputs.cy.js`                              |  | CI | unknown | unknown |
| `00_visitor/form_fixture.cy.js`                             |  | CI | unknown | unknown |
| `00_visitor/gallery.cy.js`                                  |  | CI | unknown | unknown |
| `00_visitor/light_mode.cy.js`                               |  | CI | unknown | unknown |
| `00_visitor/route_smoke.cy.js`                              |  | CI | unknown | unknown |
| `00_visitor/visit_cloudchart.cy.js`                         |  | CI | unknown | unknown |
| `01_environments/a10.cy.js`                                 |  | n/a | unknown | unknown |
| `01_environments/aws.cy.js`                                 |  | n/a | unknown | unknown |
| `01_environments/aws_role_arn.cy.js`                        |  | n/a | unknown | unknown |
| `01_environments/create_dashboard.cy.js`                    |  | n/a | unknown | unknown |
| `01_environments/digitalocean.cy.js`                        |  | n/a | unknown | unknown |
| `01_environments/gcp.cy.js`                                 |  | n/a | unknown | unknown |
| `01_environments/gcp_sign_in.cy.js`                         | deploy? | n/a | failed 2026-09-14 | unknown |
| `01_environments/generic.cy.js`                             |  | n/a | pass 2026-09-15 | unknown |
| `01_environments/github_token.cy.js`                        |  | n/a | unknown | unknown |
| `blueprints/aws__baserow__baserow.cy.js`                    | dryrun, deploy | CI | unknown | unknown |
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
| `deployments/smorgasbord.cy.js`                             |  | CI | unknown | unknown |
| `yarn test:ufsv-patch`                                      | dryrun | unknown | n/a | n/a |

## Provenance of the dated cells

- **gdk, 2026-09-15** — `aws__minecraft__minecraft` and `generic`, each run
  alone against gdk.test through the rust proxy with redis. Run them one spec
  at a time: specs in one invocation share a user and dashboard, so the second
  one's `UNFURL_SKIP_SAVE` POST 400s with "already been taken".
- **gdk, 2026-09-14** — `gcp_sign_in` was 2/3; not investigated.

## Gaps this table makes visible

- **staging has no evidence at all** — every cell in that column is a claim
  nobody has checked.
- **No spec anywhere is confirmed to have run as `deploy` rather than
  `dryrun`.** The type column says what is supported, not what was exercised.
- **`yarn test:ufsv-patch` runs nowhere automatically** —
  `build_test_release.yml` carries `# TODO add back ufsv-patch -- --runInBand`.

