#!/bin/bash

if [ -z ${UNFURL_SERVER_CWD+x} ]; then echo UNFURL_SERVER_CWD must be set; exit 1; fi
rm -r $UNFURL_SERVER_CWD/.git*
rm -r $UNFURL_SERVER_CWD/*
mkdir -p $(dirname $UNFURL_SERVER_CWD)

set -e

tar -xvf testing-shared/fixtures/dashboards/$TEST_VERSIONS.tgz -C $UNFURL_SERVER_CWD
back=$PWD
cd $UNFURL_SERVER_CWD
git checkout .
git remote remove origin || true
if [ -n "$UFSV_LOCAL" ]
then
  mkdir local
  cp $UFSV_LOCAL local/unfurl.yaml
fi
default_oc_url=https://unfurl.cloud
# git remote add origin ${OC_URL:-$default_oc_url}/jest/dashboard
cd $back
