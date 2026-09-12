#!/bin/bash

if [ -z ${UNFURL_SERVER_CWD+x} ]; then echo UNFURL_SERVER_CWD must be set; exit 1; fi
rm -rf $UNFURL_SERVER_CWD
mkdir -p $(dirname $UNFURL_SERVER_CWD)
if [ -n "$UFSV_LOCAL" ]; then
  local_unfurl_yaml=$(realpath "$UFSV_LOCAL") #safe with cd
fi
unfurl_cmd=${UNFURL_CMD:-unfurl}

$unfurl_cmd init $UNFURL_SERVER_CWD

if [ -n "$UFSV_LOCAL" ]
then
  # $UNFURL_SERVER_CWD-relative: cwd here is the checkout, not the project, so
  # the bare `local/unfurl.yaml` this used to name never existed.
  cp "$local_unfurl_yaml" "$UNFURL_SERVER_CWD/local/unfurl.yaml"
fi
