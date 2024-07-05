#!/bin/bash

environment_type=$1
dashboard_project=$2
environment_name=$3

echo $@

name_or_type=${environment_name:-$environment_type}

echo $name_or_type

unfurl=${UNFURL_CMD:-unfurl}
ufhome=${UNFURL_HOME:-$HOME/.unfurl_home}

set -x

# if [ ! -d "$ufhome" ]; then
#   $unfurl home --init
# fi

if [ -z "$dashboard_project" ]; then
  exit 1
fi
# ufhome can't reload yet

ufhome=$dashboard_project

cp testing-shared/fixtures/environments/$1.yaml $ufhome/local/$name_or_type.yaml


sed -E -i "s|((# )?environments:)|+?include-$name_or_type: local/$name_or_type.yaml\n\1|" $ufhome/unfurl.yaml

if [ ! -z "$environment_name" ]; then
  sed -i "s|$environment_type:|$environment_name:|" "$ufhome/local/$name_or_type.yaml"
fi

if [ ! -z "$dashboard_project" ]; then
  # pushd $ufhome
  pushd $dashboard_project
  $unfurl init --existing --use-environment $name_or_type
  popd
fi
