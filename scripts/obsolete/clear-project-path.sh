#!/usr/bin/env bash

ENDPOINT=$1

PAYLOAD='{"operationName":null,"variables":{},"query":"mutation {\n  updateDeploymentObj(projectPath: \"'$2'\", typename: \"*\", patch: \"null\") {\n    errors\n    __typename\n  }\n}\n"}'

curl -g \
    -X POST \
    -H "Content-Type: application/json" \
    -d "$PAYLOAD" \
    $ENDPOINT

