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
tag=$(git tag -l v* | sort -V | tail -n1)
commit=$(git show-ref -s ${tag})
commit_diff=$(git rev-list --count ${commit}..HEAD)

echo "[bump-changelog] ${commit}: ${tag}"
echo "[bump-changelog] Snapshot Number: ${commit_diff}"

echo "[bump-changelog] Backing up changelog..."
cp ./debian/changelog /tmp/changelog.orig

echo "[bump-changelog] Updating changelog - snapshot mode..."
gbp dch --verbose --git-author --ignore-branch --snapshot \
  --since="${commit}" --snapshot-number="${commit_diff}"

echo "[bump-changelog] DEBUG: Showing changelog diff..."
diff ./debian/changelog /tmp/changelog.orig

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