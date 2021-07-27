const core = require("@actions/core")
const exec = require("@actions/exec")
const firstline = require("firstline")
const hub = require("docker-hub-utils")
const path = require("path")
const fs = require("fs")

async function main() {
    try {
        const authorName = core.getInput("author_name")
        const authorEmail = core.getInput("author_email")
        const isReleaseVersion = core.getInput("release") || false
        const versionBump = core.getInput("version_bump") || 'patch'
        const sourceRelativeDirectory = core.getInput("source_directory") || "./"

        // TODO: confirm versionBump in ['major', 'minor', 'patch', 'prerelease']

        const workspaceDirectory = process.cwd()
        const sourceDirectory = path.join(workspaceDirectory, sourceRelativeDirectory)

        const file = path.join(sourceDirectory, "debian/changelog")
        const changelog = await firstline(file)
        const regex = /^(?<pkg>.+) \(((?<epoch>[0-9]+):)?(?<version>[^:-]+)(-(?<revision>[^:-]+))?\) (?<packageDistribution>.+);/
        const match = changelog.match(regex)
        const { pkg, epoch, version, revision, packageDistribution } = match.groups

        const container = pkg

        core.startGroup("Print details")
        const details = {
            pkg: pkg,
            epoch: epoch,
            version: version,
            revision: revision,
            workspaceDirectory: workspaceDirectory,
            authorName: authorName,
            authorEmail: authorEmail,
            isReleaseVersion: isReleaseVersion,
            versionBump: versionBump,
            sourceRelativeDirectory: sourceRelativeDirectory
        }
        console.log(details)
        core.endGroup()

        core.startGroup("Determine commit to base from")
        // since_tag=$(git tag -l v* | sort -V | tail -n1)
        // if [[ -z "${since_tag}" ]]; then
        //   echo "[bump-changelog]     No version tags found - using number of commits to current branch for snapshot number"
        //   since_commit=$(git log --pretty=format:%H | tail -n1)
        //   snapshot_number=$(git rev-list --count HEAD)
        // else
        //   echo "[bump-changelog]     Found version tag: ${since_tag}"
        //   since_commit=$(git show-ref -s ${since_tag})
        //   snapshot_number=$(git rev-list --count ${since_commit}..HEAD)
        // fi

        // echo "[bump-changelog]     Since: ${since_commit}"
        // echo "[bump-changelog]     Snapshot Number: ${snapshot_number}"
        await exec.exec("docker", [
            "create",
            "--name", container,
            "--volume", workspaceDirectory + ":" + workspaceDirectory,
            "--workdir", sourceDirectory,
            "--env", "DEBIAN_FRONTEND=noninteractive",
            "--env", "DPKG_COLORS=always",
            "--env", "FORCE_UNSAFE_CONFIGURE=1",
            "--tty",
            "pitop/git-buildpackage:latest",
            "sleep", "inf"
        ])
        core.endGroup()

        // # TODO: check that HEAD does not match since_commit
        // # --> this means there is nothing to bump!

        // TODO: do bump semver
        // TODO: confirm format is still correct (e.g. package version number for quilt format)
        // Set to 'NEW_VERSION'


        core.startGroup("Create container")
        await exec.exec("docker", [
            "create",
            "--name", container,
            "--volume", workspaceDirectory + ":" + workspaceDirectory,
            "--workdir", sourceDirectory,
            "--env", "DEBIAN_FRONTEND=noninteractive",
            "--env", "DPKG_COLORS=always",
            "--env", "FORCE_UNSAFE_CONFIGURE=1",
            "--tty",
            "pitop/git-buildpackage:latest",
            "sleep", "inf"
        ])
        core.endGroup()

        core.startGroup("Back up changelog") 
        await exec.exec("cp", [
            sourceDirectory + "/debian/changelog",
            "/tmp/changelog.orig",
        ])
        core.endGroup()

        core.startGroup("Start container")
        await exec.exec("docker", [
            "start",
            container
        ])
        core.saveState("container", container)
        core.endGroup()

        core.startGroup("Configure authorship")
        await exec.exec("docker", [
            "exec",
            container,
            "git",
            "config",
            "--global",
            "user.name",
            authorName
        ])
        await exec.exec("docker", [
            "exec",
            container,
            "git",
            "config",
            "--global",
            "user.email",
            authorEmail
        ])
        core.endGroup()

        core.startGroup("Bump changelog")
        await exec.exec("docker", [
            "exec",
            container,
            "gbp",
            "dch",
            "--verbose",
            "--git-author",
            "--ignore-branch",
            "--snapshot",
            "--since=${since_commit}",
            "--snapshot-number=${snapshot_number}"
        ])
        
        if (isReleaseVersion) {
            await exec.exec("docker", [
                "exec",
                container,
                "gbp",
                "dch",
                "--verbose",
                "--git-author",
                "--ignore-branch",
                "--release",
                "--distribution=$(lsb_release -cs)",
                "--spawn-editor=snapshot",
                "--new-version=" + NEW_VERSION
            ])
        }
        core.endGroup()

        core.startGroup("Show diff")
        await exec.exec("diff", [
            sourceDirectory + "/debian/changelog",
            "/tmp/changelog.orig"
        ])
        core.endGroup()
    } catch (error) {
        core.setFailed(error.message)
    }
}

main()
