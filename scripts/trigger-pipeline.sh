#!/bin/bash

var_if_set () { test -z "${!1}" || echo -n "-F 'variables[$1]=${!1}' " ; }

VARIABLE_LIST=https://raw.githubusercontent.com/onecommons/unfurl-gui/cy-tests/scripts/src/forwarded-variables.json
PROJECT_PATH=${UNFURL_GUI_PROJECT_PATH:-"onecommons/unfurl-gui"}
GITLAB_SERVER_URL=${GITLAB_SERVER_URL:-"$OC_URL"}

curl -i -X POST \
  -F "ref=cy-tests" \
  -F "token=$TOKEN" \
  -F "variables[TEST]=$1" \
  $( for var in $(curl -sSL "$VARIABLE_LIST" | jq '.[]' -r) ; do var_if_set "$var" ; done ) \
  $GITLAB_SERVER_URL/api/v4/projects/$(echo -n $PROJECT_PATH | sed 's|/|%2F|g')/trigger/pipeline
