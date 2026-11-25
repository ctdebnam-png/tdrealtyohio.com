#!/bin/bash
#
# Install dependencies for a session, from the lockfile, without rewriting it.
#
# WHY npm ci AND NOT npm install
# A cloud container's npm can be older than the npm that generated
# package-lock.json. An older npm does not understand the `libc` field on
# optional platform packages, so `npm install` rewrote the lockfile and dropped
# those fields -- 24 deletions, no additions, every single session. That left
# the tree dirty before any work started, and the Stop hook then asked for a
# commit of churn nobody made. Committing it would have pushed a silent
# lockfile downgrade and changed how optional deps resolve on musl vs glibc.
# `npm ci` installs from the lockfile and never writes to it.
#
# WHY THE INSTALL IS GUARDED
# `npm ci` replaces node_modules wholesale, so it is slower than `npm install`
# and this hook is synchronous -- it holds the first message of every start,
# resume, clear and compact. The guard runs it only when this script,
# package.json or package-lock.json has changed since the last install
# succeeded. The hash file lives inside node_modules, so it disappears with the
# packages: a new container always reinstalls, and node_modules/ is gitignored
# so the file is never committed.
#
# WHY THERE IS NO UNCONDITIONAL SUCCESS MESSAGE
# This previously ran `npm install 2>/dev/null; echo 'Dependencies installed'`,
# which printed success even when the install had failed and swallowed the
# reason. `npm ci` has a real failure mode `npm install` papers over -- it
# refuses to run when package.json and package-lock.json disagree -- so a false
# success here is worse, not merely untidy. set -e ends the script on a failed
# install and the success line is never reached.
set -euo pipefail

cd "${CLAUDE_PROJECT_DIR:-.}"

hashes=node_modules/.session-start.sha256
manifest=(.claude/hooks/session-start.sh package.json package-lock.json)

if sha256sum --check --status "$hashes" 2>/dev/null; then
  echo "Dependencies already installed; no manifest change since the last install."
  exit 0
fi

# Clear the old hashes first, so an install that dies partway through is retried
# next session instead of being recorded as done.
rm -f "$hashes"

npm ci

sha256sum "${manifest[@]}" > "$hashes" || rm -f "$hashes"
echo "Dependencies installed from the lockfile (npm ci)."
