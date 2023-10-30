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
