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


if ! grep -q "^+?include-$name_or_type:" "$ufhome/unfurl.yaml"; then
  nl=$'\n'
  tmp=$(mktemp)
  sed -E "s|((# )?environments:)|+?include-$name_or_type: local/$name_or_type.yaml\\${nl}\1|" "$ufhome/unfurl.yaml" > "$tmp"
  mv "$tmp" "$ufhome/unfurl.yaml"
fi

if [ ! -z "$environment_name" ]; then
  tmp=$(mktemp)
  sed "s|$environment_type:|$environment_name:|" "$ufhome/local/$name_or_type.yaml" > "$tmp"
  mv "$tmp" "$ufhome/local/$name_or_type.yaml"
fi

if [ ! -z "$dashboard_project" ]; then
  # Pass the project path explicitly instead of cd'ing into it. UNFURL_CMD
  # (when set) is a `docker run ... -w $PWD ...` line whose -w is baked at
  # the caller's environment setup time — bash won't re-expand $PWD when
  # the value is later interpolated, so `pushd $dashboard_project` doesn't
  # change the docker container's cwd. Passing the project path positionally
  # lets `init --existing` target it regardless of the container's cwd.
  $unfurl -vv init --existing "$dashboard_project" --use-environment $name_or_type || true
fi
