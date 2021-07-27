# GitHub Action: a git-based Debian package changelog bumper

pi-top's Docker image for [generating Debian changelog from git commit messages](https://manpages.debian.org/buster/git-buildpackage/gbp-dch.1.en.html)
This Action is used across all of pi-topOS's Debian packaging.

An opinionated Action for managing a Debian package with git.

Snapshot numbers are based off of the number of commits from:
  * the latest semver tag
  * the first commit in its history

### Pre-requisites
You need to check out your code with `fetch-depth: 0`:
```
      - name: Checkout code
        uses: actions/checkout@v2.2.0
        with:
          fetch-depth: 0
```
This is so that tags are fetched.

### How to use: Snapshot
```
      - name: Checkout code
        uses: actions/checkout@v2.2.0
        with:
          fetch-depth: 0

      - name: Patch changelog (snapshot)
        uses: pi-top/git-debian-changelog-bumper@master
        with:
          release: false
          author_name: "pi-top"
          author_email: "deb-maintainers@pi-top.com"
```

### How to use: Release
```
      - name: Checkout code
        uses: actions/checkout@v2.2.0
        with:
          fetch-depth: 0

      - name: Patch changelog (snapshot)
        uses: pi-top/git-debian-changelog-bumper@master
        with:
          release: true
          version_bump: 'minor'
          author_name: "pi-top"
          author_email: "deb-maintainers@pi-top.com"
```

Valid options:
* major
* minor
* patch
* prerelease

### TODO: Rough outline of stages
```
Setup:
  - Configure git for gbp

Snapshot:
  - Get latest tag
  - Set snapshot number from latest semver tag if found
  - Set snapshot number from base of current branch if not found
  - Update changelog - snapshot mode

Release:
  - Validate version bump input string
  - Determine current version
  - Bump version with actions-ecosystem/action-bump-semver
  - Sanitise for Debian (e.g. if quilt, _must_ have packaging version)
  - Update changelog - release mode
```
