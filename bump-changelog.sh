#!/bin/bash
###############################################################
#                Unofficial 'Bash strict mode'                #
# http://redsymbol.net/articles/unofficial-bash-strict-mode/  #
###############################################################
set -euo pipefail
IFS=$'\n\t'
###############################################################

cd /src

echo "[bump-changelog] Setting author information..."
git config --global user.name "pi-top"
git config --global user.email "deb-maintainers@pi-top.com"

echo "[bump-changelog] Determining snapshot number..."
since_tag=$(git tag -l v* | sort -V | tail -n1)
if [[ -z "${since_tag}" ]]; then
  echo "[bump-changelog] No version tags found - using number of commits to current branch for snapshot number"
  since_commit=$(git log --pretty=format:%H | tail -n1)
  snapshot_number=$(git rev-list --count HEAD)
else
  echo "[bump-changelog] Found version tag: ${since_tag}"
  since_commit=$(git show-ref -s ${since_tag})
  snapshot_number=$(git rev-list --count ${since_commit}..HEAD)
fi

echo "[bump-changelog] Since: ${since_commit}"
echo "[bump-changelog] Snapshot Number: ${snapshot_number}"

echo "[bump-changelog] Backing up changelog..."
cp ./debian/changelog /tmp/changelog.orig

echo "[bump-changelog] Updating changelog - snapshot mode..."
gbp dch --verbose --git-author --ignore-branch --snapshot \
  --since="${since_commit}" --snapshot-number="${snapshot_number}"

echo "[bump-changelog] DEBUG: Showing changelog diff..."
diff ./debian/changelog /tmp/changelog.orig || true

if [[ "${RELEASE}" -eq 1 ]]; then
  echo "[bump-changelog] Updating changelog - release mode..."
  gbp dch --verbose --git-author --ignore-branch --release \
    --distribution=buster --spawn-editor=snapshot

  echo "[bump-changelog] DEBUG: Showing changelog diff..."
  diff ./debian/changelog /tmp/changelog.orig
else
  echo "[bump-changelog] Not in release mode - finished modifying changelog!"
fi

echo "[bump-changelog] DONE!"
