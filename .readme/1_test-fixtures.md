# Fixture/spec generation

Most integration tests hosted in this repository are based off of completed deployments or deployment drafts.

The easiest way to generate fixtures is to fill out a blueprint on [unfurl.cloud](https://unfurl.cloud) and export the deployment via Unfurl cli.

1. Navigate to https://unfurl.cloud/home#clone-instructions or `https://unfurl.cloud/<your-username>/dashboard#clone-instructions`
2. Copy and execute the command line snippet for "Clone this Unfurl project if you haven't already"
3. Run `unfurl export --format deployment --file  <path-to-unfurl-gui>/cypress/fixtures/generated/deployments/v2/<export-name>.json <path-to-ensemble-yaml>`
