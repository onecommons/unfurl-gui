#!/usr/bin/bash

if [ -z ${UNFURL_SERVER_CWD+x} ]; then echo UNFURL_SERVER_CWD must be set; exit 1; fi
rm -r $UNFURL_SERVER_CWD/.*
rm -r $UNFURL_SERVER_CWD/*
tar xvf ufsv-patch/test-dashboard.tgz -C $UNFURL_SERVER_CWD
back=$PWD
cd $UNFURL_SERVER_CWD
git checkout .
git remote remove origin
default_oc_url=https://unfurl.cloud
# git remote add origin ${OC_URL:-$default_oc_url}/jest/dashboard
cd $back
