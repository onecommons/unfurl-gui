[//]: # (README.md is generated, do not edit directly)

**Node LTS is recommended**

# Notes

`src/gitlab-oc` is a symlink to `packages/oc-pages`.   The oc-pages package is also used in the gitlab-oc repo, so take care when making changes and make sure the code stays portable between gitlab-oc and unfurl-gui.  When importing modules from inside oc-pages/ to other locations inside the src/ directory, use the appropriate aliases to prevent resolver errors on gitlab-oc.  Check `vue.config.js` to see what the current aliases resolve to.

See Apollo boilerplate added with `vue add apollo`... see https://apollo.vuejs.org/

Need to run `yarn run apollo:start` first to start the apollo graphql server (runs on port 4000).

see https://gitlab-org.gitlab.io/gitlab-ui/ and https://gitlab-org.gitlab.io/gitlab-svgs/

gitlab-ui wraps https://bootstrap-vue.org/ which wraps bootstrap 4

It also depends on https://portal-vue.linusb.org/ which we could use to build a vs-code like minimap of a view using http://asvd.github.io/syncscroll/ or similar.


# Fixture/spec generation

Most integration tests hosted in this repository are based off of completed deployments or deployment drafts.

The easiest way to generate fixtures is to fill out a blueprint on [unfurl.cloud](https://unfurl.cloud) and export the deployment via Unfurl cli.

1. Navigate to https://unfurl.cloud/home#clone-instructions or `https://unfurl.cloud/<your-username>/dashboard#clone-instructions`
2. Copy and execute the command line snippet for "Clone this Unfurl project if you haven't already"
3. Run `unfurl export --format deployment --file  <path-to-unfurl-gui>/cypress/fixtures/generated/deployments/v2/<export-name>.json <path-to-ensemble-yaml>`


# Jest patch/dryrun test

The test titled `ufsv-patch` mimics the workflow of a user filling out a deployment blueprint and triggering a dryrun deployment.

## Required envvars and params
**SPEC_GLOBS:** Whitespace separated globs indicating which deployments to be run. Spec are found in `cypress/fixtures/generated/deployments/v2` by default, but a different path will be searched depending on `TEST_VERSIONS`.

**GOOGLE_APPLICATION_CREDENTIALS:** Even dryrun tests fail when this variable is missing.

**--runInBand:** For now we do **NOT** want to try running tests in parallel.

## Supported envvars
All Unfurl environment variables pass through to `unfurl serve` and `unfurl deploy`.

**TEST_VERSIONS:** Which version of specs to run (default: v2)

**CI:** If present, log commands to curl artifacts, write deploy logs to `/tmp/${testName}-ufdryrun.log`.  Outputs will be optimized for this test's companion `.gitlab-ci.yml` workflow.

**PORT:** The port to run `unfurl serve` on (default: 5001)

**OC_URL:** Base url for jest.  Also used for `--cloud-server` (default https://unfurl.cloud)

**OC_NAMESPACE:** Namespace to run tests against; in other words - where the blueprints are located. (default: onecommons/blueprints)


## Example invocation
```bash
env TF_PLUGIN_CACHE_DIR=/tmp/plugincache/ TF_DATA_DIR=/tmp/.terraform TF_PLUGIN_CACHE_MAY_BREAK_DEPENDENCY_LOCK_FILE=1 GOOGLE_APPLICATION_CREDENTIALS=/home/onecommons/oc-staging1-6aeb4c6ec6bc.json SPEC_GLOBS='*baserow*' yarn test ufsv-patch -- --runInBand
```

## Default Unfurl envvars
```javascript
const UNFURL_DEFAULT_ENV = {
  UNFURL_LOGGING: 'trace',
  UNFURL_HOME: '',
}
```

## Test directory structure and outputs:
- `/tmp/ufsv`: The location of the test dashboard.  Will be used as the working directory for `unfurl serve` and `unfurl deploy`.
- `/tmp/repos`: The location of `--clone-root` for `unfurl serve`.
- `/tmp/ufartifacts`: All deployments will be moved here between test runs, so as to not wipe debug information when the next spec is run.  All `ensemble.yaml` files and artifacts will be present here after the suite has finished running.
- `/tmp/${testName}-ufsv.log`: Pattern for where `unfurl serve` logs will be written.
- `/tmp/${testName}-ufdryrun.log`: Pattern for where `unfurl deploy` logs will be written when in CI (otherwise stdio).


# Triggering a test pipeline

A test can be triggered via `curl | bash` as below.  The first parameter to the bash script is the test to run (equivalent to the `$TEST` variable mentioned under [Cypress tests](#cypress-tests)).

Example:
`curl https://raw.githubusercontent.com/onecommons/unfurl-gui/cy-tests/scripts/trigger-pipeline.sh | bash -s baserow` will trigger the pipeline with `$TEST` set to `baserow`.

If successful the command will output the pipeline URL.


# Cypress tests

 Cypress tests can be automatically run through gitlab ci by setting the `$TEST` pipeline variable

| Pattern | Spec | Description |
| ------- | ---- | ----------- |
| <code>$TEST == "sanity" &#124;&#124; $TEST == "visitor" &#124;&#124; $TEST == "all"</code> | <code>./cypress/e2e/00_visitor/&#42;.js</code> | Sanity checks for signed out users |
| <code>$TEST == "nestedcloud" &#124;&#124; $TEST == "all"</code> | <code>./cypress/e2e/blueprints/&#42;nestedcloud&#42;.js</code> | Run nestedcloud tests (must be &lt;namespace&gt;/nestedcloud) |
| <code>$TEST == "nextcloud" &#124;&#124; $TEST == "nextcloud_aws" &#124;&#124; $TEST == "all"</code> | <code>./cypress/e2e/blueprints/aws&#42;nextcloud&#42;.js</code> | Runs all nextcloud tests on aws |
| <code>$TEST == "nextcloud" &#124;&#124; $TEST == "nextcloud_gcp" &#124;&#124; $TEST == "all"</code> | <code>./cypress/e2e/blueprints/gcp&#42;nextcloud&#42;.js</code> | Runs all nextcloud tests on gcp |
| <code>$TEST == "nextcloud" &#124;&#124; $TEST == "nextcloud_do" &#124;&#124; $TEST == "all"</code> | <code>./cypress/e2e/blueprints/do&#42;nextcloud&#42;.js</code> | Runs all nextcloud tests on digital ocean |
| <code>$TEST =~ /baserow/ &#124;&#124; $TEST == "all"</code> | <code>./cypress/e2e/blueprints/&#42;baserow&#42;.js</code> | Runs all baserow tests |
| <code>$TEST =~ /minecraft/ &#124;&#124; $TEST == "all"</code> | <code>./cypress/e2e/blueprints/&#42;minecraft&#42;.js</code> | Runs all minecraft tests |
| <code>$TEST == "container_webapp" &#124;&#124; $TEST == "all"</code> | <code>./cypress/e2e/blueprints/&#42;container-webapp&#42;.js</code> | Runs all container-webapp tests |
| <code>$TEST == "container_webapp_gcp"</code> | <code>./cypress/e2e/blueprints/gcp__container-webapp&#42;.js</code> | Runs container-webapp tests for gcp |
| <code>$TEST == "container_webapp_aws"</code> | <code>./cypress/e2e/blueprints/aws__container-webapp&#42;.js</code> | Runs container-webapp tests for aws |
| <code>$TEST =~ /ghost/ &#124;&#124; $TEST == "all"</code> | <code>./cypress/e2e/blueprints/&#42;ghost&#42;.js</code> | Runs all ghost tests |
| <code>$TEST =~ /mediawiki/ &#124;&#124; $TEST == "all"</code> | <code>./cypress/e2e/blueprints/&#42;mediawiki&#42;.js</code> | Runs all mediawiki tests |
| <code>$TEST =~ /wordpress/ &#124;&#124; $TEST == "all"</code> | <code>./cypress/e2e/blueprints/&#42;wordpress&#42;.js</code> | Runs all wordpress tests |
| <code>$TEST =~ /k8s/ &#124;&#124; ($TEST == "all" && $SKIP !~ /k8s/)</code> | <code>./cypress/e2e/blueprints/k8s&#42;.js</code> | Runs all kubernetes tests |
| <code>$TEST =~ /uc_dns/ &#124;&#124; $TEST == "all"</code> | <code>./cypress/e2e/blueprints/aws__nextcloud__only-mail&#42;.js</code> | Runs aws nextcloud with unfurl cloud dns |
| <code>$TEST == "cloud_redis"</code> | <code>cypress/e2e/blueprints/gcp__nextcloud__memorystore&#42;.js</code><br><code>cypress/e2e/blueprints/aws__nextcloud__memorydb&#42;.js</code> | Runs all cloud redis tests |
| <code>$TEST == "multiple_workflows" &#124;&#124; $TEST == "misc"</code> | <code>cypress/e2e/deployments/multiple-workflows&#42;.js</code> | Tries to run multiple deployments simultaneously |
| <code>$TEST == "smorgasbord"</code> | <code>cypress/e2e/deployments/smorgasbord&#42;.js</code> | Test inputs in smorgasbord blueprint |
| <code>$TEST == "node_filter" &#124;&#124; $TEST == "misc"</code> | <code>cypress/e2e/deployments/node-filter&#42;.js</code> | Test node filter on baserow |
| <code>$TEST == "clone_draft" &#124;&#124; $TEST == "misc"</code> | <code>cypress/e2e/deployments/clone-draft&#42;.js</code> | Clone and deploy a draft |
| <code>$TEST == "drafts" &#124;&#124; $TEST == "misc"</code> | <code>cypress/e2e/deployments/draft&#42;.js</code> | Try to trigger a state desync with drafts |
| <code>$TEST == "dryrun"</code> | <code>cypress/e2e/blueprints/aws&#42;</code><br><code>cypress/e2e/blueprints/az&#42;</code> | DRYRUN aws and azure |
| <code>$TEST == "dryrun"</code> | <code>cypress/e2e/blueprints/gcp&#42;</code><br><code>cypress/e2e/blueprints/do&#42;</code> | DRYRUN aws and azure |
| <code>$TEST == "shared_volumes" &#124;&#124; $TEST == "all"</code> | <code>cypress/e2e/deployments/shared-volume&#42;.js</code> | Runs all nextcloud shared volume tests<br>The test does the following:<br>1. Deploys nextcloud with a volume<br>2. Shares the volume<br>3. Tears down the first deployment<br>4. Creates a new nextcloud deployment with the shared volume<br>5. Asserts that admin credentials are the same on the new instance<br> |
| <code>$TEST == "command"</code> | N/A | evals <code>$CY_COMMAND</code>

## Running an arbitrary test examples with `$CY_COMMAND`

* Run a single spec by setting `$CY_COMMAND` to : <code>yarn run integration-test run --namespace onecommons/blueprints -- --browser chrome -s cypress/e2e/deployments/drafts.cy.js</code>

