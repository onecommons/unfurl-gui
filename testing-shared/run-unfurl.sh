#!/bin/bash

cmd=${UNFURL_CMD:-unfurl}
export TF_PLUGIN_CACHE_DIR="$DASHBOARD_DEST/plugincache"
export TF_DATA_DIR="$DASHBOARD_DEST/.terraform"
export TF_PLUGIN_CACHE_MAY_BREAK_LOCK_FILE="1"
export UNFURL_LOGGING='trace'
export UNFURL_HOME=''
export UNFURL_SKIP_SAVE='never'

pushd $DASHBOARD_DEST
$cmd $@
popd
