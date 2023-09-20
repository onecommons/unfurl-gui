[//]: # (README.md is generated, do not edit directly)

**Node LTS is recommended**

# Notes

`src/gitlab-oc` is a symlink to `packages/oc-pages`.   The oc-pages package is also used in the gitlab-oc repo, so take care when making changes and make sure the code stays portable between gitlab-oc and unfurl-gui.  When importing modules from inside oc-pages/ to other locations inside the src/ directory, use the appropriate aliases to prevent resolver errors on gitlab-oc.  Check `vue.config.js` to see what the current aliases resolve to.

See Apollo boilerplate added with `vue add apollo`... see https://apollo.vuejs.org/

Need to run `yarn run apollo:start` first to start the apollo graphql server (runs on port 4000).

see https://gitlab-org.gitlab.io/gitlab-ui/ and https://gitlab-org.gitlab.io/gitlab-svgs/

gitlab-ui wraps https://bootstrap-vue.org/ which wraps bootstrap 4

It also depends on https://portal-vue.linusb.org/ which we could use to build a vs-code like minimap of a view using http://asvd.github.io/syncscroll/ or similar.


# Triggering a test pipeline

A test can be triggered via `curl | bash` as below.  The first parameter to the bash script is the test to run (equivalent to the `$TEST` variable mentioned under [Cypress tests](#cypress-tests)).

Example:
`curl https://raw.githubusercontent.com/onecommons/unfurl-gui/cy-tests/scripts/trigger-pipeline.sh | bash -s baserow` will trigger the pipeline with `$TEST` set to `baserow`.

If successful the command will output the pipeline URL.


# Cypress tests

 Cypress tests can be automatically run through gitlab ci by setting the `$TEST` pipeline variable

| Pattern | Spec | Description |
| ------- | ---- | ----------- |
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
| <code>$TEST == "multiple_workflows"</code> | <code>cypress/e2e/deployments/multiple-workflows&#42;.js</code> | Tries to run multiple deployments simultaneously (flakey) |
| <code>$TEST == "shared_volumes" &#124;&#124; $TEST == "all"</code> | <code>cypress/e2e/deployments/shared-volume&#42;.js</code> | Runs all nextcloud shared volume tests<br>The test does the following:<br>1. Deploys nextcloud with a volume<br>2. Shares the volume<br>3. Tears down the first deployment<br>4. Creates a new nextcloud deployment with the shared volume<br>5. Asserts that admin credentials are the same on the new instance<br> |
| <code>$TEST == "command"</code> | N/A | evals <code>$CY_COMMAND</code>

## Running an arbitrary test examples with `$CY_COMMAND`

* Run a single spec by setting `$CY_COMMAND` to : <code>yarn run integration-test run --namespace onecommons/blueprints -- --browser chrome -s cypress/e2e/deployments/drafts.cy.js</code>

