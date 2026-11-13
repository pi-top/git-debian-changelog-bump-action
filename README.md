# GitHub Action: a git-based Debian package changelog bumper

pi-top's Docker-based GitHub Action for [generating an updated Debian changelog from git commit messages](https://manpages.debian.org/buster/git-buildpackage/gbp-dch.1.en.html)
This Action is used across all of pi-topOS's Debian packaging.

Snapshot numbers are based off of the number of commits from:
  * the latest semver tag
  * the first commit in its history

### Versioning
By default (`version_scheme: semver`) the new entry bumps the patch version and resets the Debian revision: `0.35.0-5` becomes `0.35.1-1`, and a native `1.2.3` becomes `1.2.4`. For a feature release, edit the version in the release PR (e.g. to `0.36.0-1`). Versions that aren't `x.y.z` keep the old behaviour of bumping the Debian revision.

`version_scheme: date` sets the version to the UTC date, `YYYY.M.D` (a second release on the same day gets `.1`, `.2`, ...).

`version_scheme: revision` only bumps the Debian revision (`0.6.0-2` becomes `0.6.0-3`). Use it when the repo packages someone else's code, so the version stays the upstream release.

If the top changelog entry is `UNRELEASED`, its version is kept as written.

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
