#!/bin/bash

# currently only used by cypress due to limitations of cy.exec

cmd=${UNFURL_CMD:-unfurl}
tfdir=$(dirname $(realpath $DASHBOARD_DEST))
export TF_PLUGIN_CACHE_DIR="$tfdir/plugincache"
export TF_DATA_DIR="$tfdir/.terraform"
export TF_PLUGIN_CACHE_MAY_BREAK_LOCK_FILE="1"
export UNFURL_LOGGING='trace'
export UNFURL_HOME=''
export UNFURL_SKIP_SAVE='never'

pushd $DASHBOARD_DEST
# When UNFURL_CMD is a `docker run` invocation, its `-w <dir>` flag was baked
# in with the workflow cwd, not $DASHBOARD_DEST — the shell's pushd doesn't
# carry into the container. Rewrite `-w <dir>` so the container's cwd matches
# the shell's, so relative path args (e.g. the deployment dir) resolve correctly.
adjusted_cmd=$(echo "$cmd" | sed -E "s| -w [^ ]+| -w $(pwd)|")
# Tee output to /tmp/dryrun-unfurl.log so it can be tailed live during the test.
$adjusted_cmd $@ 2>&1 | tee /tmp/dryrun-unfurl.log
popd
