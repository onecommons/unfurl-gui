#!/usr/bin/env bash

PAYLOAD='{"operationName":null,"variables":{},"query":"{\n  applicationBlueprint(fullPath: \"demo/apostrophe-demo\") {\n    json\n  }\n}\n"}'
ENDPOINT=$1
GITLAB_SESSION=$2

curl \
    -X POST \
    -H "Content-Type: application/json" \
    -H "cookie: _gitlab_session=$GITLAB_SESSION;" \
    -d "$PAYLOAD" \
    $ENDPOINT

