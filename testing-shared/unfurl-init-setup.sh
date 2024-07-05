#!/bin/bash

if [ -z ${UNFURL_SERVER_CWD+x} ]; then echo UNFURL_SERVER_CWD must be set; exit 1; fi
rm -rf $UNFURL_SERVER_CWD
mkdir -p $(dirname $UNFURL_SERVER_CWD)
local_unfurl_yaml=$(realpath $UFSV_LOCAL) #safe with cd
unfurl_cmd=${UNFURL_CMD:-unfurl}

$unfurl_cmd init $UNFURL_SERVER_CWD

if [ -n "$UFSV_LOCAL" ]
then
  cp $local_unfurl_yaml local/unfurl.yaml
fi
