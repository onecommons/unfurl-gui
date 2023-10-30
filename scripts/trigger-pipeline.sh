#!/bin/bash

USAGE=https://raw.githubusercontent.com/onecommons/unfurl-gui/cy-tests/scripts/src/trigger-pipeline-usage.txt

function usage() {
  curl -sSL $USAGE 1>&2
  exit 1
}

TEST=$1
shift

if [[ -z "$TEST" ]] || [[ $TEST ==  "--help" ]]; then
  usage
fi

if [[ -z "${TOKEN}" ]] && [[ -z "${OC_URL}" ]]; then
  echo "\$TOKEN and \$OC_URL are required for this script to function." 1>&2
  echo "\$TOKEN must be a trigger token for the unfurl gui project" 1>&2
  echo "\$OC_URL must point to an Unfurl Cloud instance such as https://staging.unfurl.cloud" 1>&2
  echo "For usage information run 'curl https://raw.githubusercontent.com/onecommons/unfurl-gui/cy-tests/scripts/trigger-pipeline.sh | bash -s -- --help'" 1>&2
  exit
fi


while getopts "n:-:" o; do
  case $o in
    -)
      case ${OPTARG} in
        namespace)
          namespace="${!OPTIND}"; OPTIND=$(( $OPTIND + 1 ))
          ;;
        namespace=*)
          namespace=${OPTARG#*=}
          ;;
        *)
          usage
          ;;
      esac
      ;;
    n)
      namespace=${OPTARG}
      ;;
    *)
      usage
      ;;
  esac
done

VARIABLE_LIST=https://raw.githubusercontent.com/onecommons/unfurl-gui/cy-tests/scripts/src/forwarded-variables.json
PROJECT_PATH=${UNFURL_GUI_PROJECT_PATH:-"onecommons/unfurl-gui"}
GITLAB_SERVER_URL=${GITLAB_SERVER_URL:-"$OC_URL"}
OC_NAMESPACE=${OC_NAMESPACE:-"onecommons/blueprints"}
NAMESPACE=${namespace:-"$OC_NAMESPACE"}

TEST_VARIABLES=""

var_if_set () {
  test -z "${!1}" || TEST_VARIABLES="$TEST_VARIABLES -F 'variables[$1]=${!1}'"
}

for var in $(curl -sSL "$VARIABLE_LIST" | jq '.[]' -r)
  do var_if_set "$var"
done

OUTPUT=$(xargs curl -sSL -X POST \
  $GITLAB_SERVER_URL/api/v4/projects/$(echo -n $PROJECT_PATH | sed 's|/|%2F|g')/trigger/pipeline \
  -F "ref=cy-tests" \
  -F "token=$TOKEN" \
  -F "variables[TEST]=$TEST" \
  -F "variables[OC_NAMESPACE]=$NAMESPACE" \
  <<< $TEST_VARIABLES
)

DETAILS_PATH=$(jq '.detailed_status.details_path' -r <<< $OUTPUT)

if [[ $DETAILS_PATH == "null" ]]; then
  echo $OUTPUT
else
  echo $GITLAB_SERVER_URL$DETAILS_PATH
fi
