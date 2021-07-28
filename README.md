# GitHub Action: a git-based Debian package changelog bumper

pi-top's Docker-based GitHub Action for [generating an updated Debian changelog from git commit messages](https://manpages.debian.org/buster/git-buildpackage/gbp-dch.1.en.html)
This Action is used across all of pi-topOS's Debian packaging.

Snapshot numbers are based off of the number of commits from:
  * the latest semver tag
  * the first commit in its history

### Notes
You need to check out your code with `fetch-depth: 0` so that tags are fetched.

### Examples

Increment package version to snapshot, and store new version in env:
```
env:
  CHANGELOG_AUTHOR_NAME: "pi-top"
  CHANGELOG_AUTHOR_EMAIL: "deb-maintainers@pi-top.com"

jobs:
  build-debian-package:
    runs-on: ubuntu-20.04
    steps:
      - name: Checkout code
        uses: actions/checkout@v2.2.0
        with:
          fetch-depth: 0

      - name: Patch changelog (snapshot)
        uses: pi-top/git-debian-changelog-bump-action@master
        with:
          release: false
          author_name: ${{ env.CHANGELOG_AUTHOR_NAME }}
          author_email: ${{ env.CHANGELOG_AUTHOR_EMAIL }}

      - name: Determine current version
        run: |
          sudo apt install -y dpkg-dev
          echo "CURRENT_VERSION=$(dpkg-parsechangelog -Sversion)" >> $GITHUB_ENV
```
