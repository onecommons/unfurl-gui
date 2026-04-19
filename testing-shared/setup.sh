#!/bin/bash
if [ -z ${UNFURL_SERVER_CWD+x} ]; then echo UNFURL_SERVER_CWD must be set; exit 1; fi
rm -rf $UNFURL_SERVER_CWD/.git*
rm -rf $UNFURL_SERVER_CWD/*
mkdir -p $UNFURL_SERVER_CWD
local_unfurl_yaml=$(realpath $UFSV_LOCAL) #safe with cd

set -e

tar -xvf testing-shared/fixtures/dashboards/$TEST_VERSIONS.tgz -C $UNFURL_SERVER_CWD
mkdir $UNFURL_SERVER_CWD/local
back=$PWD
cd $UNFURL_SERVER_CWD
git checkout .
git remote remove origin || true
if [ -n "$UFSV_LOCAL" ]
then
  cp $local_unfurl_yaml local/unfurl.yaml
else
  cp $back/testing-shared/unfurl.yaml local/
fi
default_oc_url=https://unfurl.cloud
# git remote add origin ${OC_URL:-$default_oc_url}/jest/dashboard
cd $back
