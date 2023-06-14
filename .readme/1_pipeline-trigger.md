# Triggering a test pipeline

A test can be triggered via `curl | bash` as below.  The first parameter to the bash script is the test to run (equivalent to the `$TEST` variable mentioned under [Cypress tests](#cypress-tests)).

Example:
`curl https://raw.githubusercontent.com/onecommons/unfurl-gui/cy-tests/scripts/trigger-pipeline.sh | bash -s baserow` will trigger the pipeline with `$TEST` set to `baserow`.

If successful the command will output the pipeline URL.
