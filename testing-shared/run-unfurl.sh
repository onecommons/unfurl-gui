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
$cmd $@
popd
