#!/usr/bin/env bash
# Fork only: builds the release branch from master, the branches of the PRs
# that should ship and the fork branch. Used by .github/workflows/build-release.yml,
# can be run locally (from a copy, it checks out other branches) to reproduce
# or fix a failed run.
#
# usage: build-release.sh <master> <previous release> <branch>...
#
#   <master>            commit the release is based on, e.g. an upstream release tag
#   <previous release>  last release, its merges teach rerere how to resolve
#                       conflicts between the branches
#   <branch>...         local branches to merge in this order, the fork branch last
#
# Every branch is rebased onto <master> first (their bases can be older
# upstream releases), then merged into a fresh release branch. Conflicts that
# were resolved in a previous release are resolved the same way, any other
# conflict stops the build: merge the branches by hand as below, commit the
# resolution and push the release branch, later builds will reuse it.
set -euo pipefail

master=$1
previous=$2
shift 2
branches=("$@")

git config rerere.enabled true
git config rerere.autoUpdate true

for branch in "${branches[@]}"; do
  if ! git rebase --quiet "$master" "$branch"; then
    git rebase --abort
    echo "::error::Rebasing $branch onto $master conflicts, rebase it locally"
    exit 1
  fi
done

# learn the conflict resolutions of the previous release, like git's
# contrib/rerere-train.sh
for merge in $(git rev-list --merges --reverse "$master..$previous" 2>/dev/null || true); do
  git checkout --quiet --detach "$merge^1"
  if git merge --quiet --no-edit "$merge^2" >/dev/null 2>&1; then
    continue
  fi
  if [ -s "$(git rev-parse --git-path MERGE_RR)" ]; then
    git rerere
    git checkout --quiet "$merge" -- .
    git rerere
    echo "Learned the conflict resolutions of $(git log -1 --format='%h %s' "$merge")"
  fi
  git reset --quiet --hard
done

git checkout --quiet -B release "$master"
for branch in "${branches[@]}"; do
  if [ -z "$(git rev-list "release..$branch")" ]; then
    echo "$branch is already in $master, skipping it"
    continue
  fi
  message="Merge $branch"
  if ! git merge --quiet --no-ff -m "$message" "$branch" >/dev/null; then
    unresolved=$(git diff --name-only --diff-filter=U)
    if [ -n "$unresolved" ]; then
      echo "::error::Merging $branch conflicts in: $(echo "$unresolved" | tr '\n' ' ')"
      git merge --abort
      exit 1
    fi
    git commit --quiet --no-edit -m "$message"
    echo "Resolved the conflicts of $branch from a previous release"
  fi
done
