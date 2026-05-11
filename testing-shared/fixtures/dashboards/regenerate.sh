#!/bin/bash
# Regenerate a dashboard fixture tarball from the working-copy repo
# the integration-test harness created.
#
# The integration-test harness extracts
# `testing-shared/fixtures/dashboards/$TEST_VERSIONS.tgz` into
# $UNFURL_SERVER_CWD (defaults to $UNFURL_TEST_TMPDIR/ufsv), then runs
# `git checkout .` to materialize the working tree from HEAD. So the
# fixture is just the .git directory; after running the tests (or
# committing locally), you can reuse the same repo as the new fixture.
#
# Usage:
#   ./testing-shared/fixtures/dashboards/regenerate.sh [VERSION] [SRC_REPO]
#
# Defaults:
#   VERSION   = v2
#   SRC_REPO  = ${UNFURL_TEST_TMPDIR:-./tmp}/ufsv
#
# Example (default — regenerate v2.tgz from ./tmp/ufsv):
#   ./testing-shared/fixtures/dashboards/regenerate.sh
#
# Example (custom version and source):
#   ./testing-shared/fixtures/dashboards/regenerate.sh v3 /path/to/repo

set -euo pipefail

VERSION="${1:-v2}"
SRC_REPO="${2:-${UNFURL_TEST_TMPDIR:-./tmp}/ufsv}"

# Resolve paths
SRC_REPO="$(cd "$SRC_REPO" && pwd)"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEST="$SCRIPT_DIR/$VERSION.tgz"

if [ ! -d "$SRC_REPO/.git" ]; then
  echo "Error: $SRC_REPO is not a git working copy (.git missing)" >&2
  exit 1
fi

# Match the format of the existing v2.tgz: only the .git directory,
# paths relative to the repo root. Tests extract into their
# UNFURL_SERVER_CWD then `git checkout .` to materialize files.
echo "Packing .git from $SRC_REPO → $DEST"
tar czf "$DEST" -C "$SRC_REPO" .git

echo "Done."
echo "  Size: $(du -h "$DEST" | cut -f1)"
echo "  Entries: $(tar tzf "$DEST" | wc -l | tr -d ' ')"
