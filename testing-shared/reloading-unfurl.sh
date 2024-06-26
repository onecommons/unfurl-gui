#!/bin/bash

if [[ "$1" == "serve" ]]; then
  unfurl_init="$(python -c "import importlib.util; print(importlib.util.find_spec('unfurl').origin)")"
  unfurl_dir=$(dirname $unfurl_init)

  exec find "$unfurl_dir" | entr -r unfurl "$@"
else
  exec unfurl "$@"
fi
