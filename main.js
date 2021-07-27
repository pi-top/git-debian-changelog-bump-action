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

        core.startGroup("Retrieve tags & base commits for changelog")
        let sinceTagStdout = "";
        const sinceTagOptions = {}
        sinceTagOptions.listeners = {
            stdout: (data) => {
                sinceTagStdout += data.toString();
            }
        }
        await exec.exec("docker", [
            "exec",
            container,
            "git",
            "tag",
            "-l",
            "v*"
        ], sinceTagOptions)
        sinceTag = sinceTagStdout.split("\n");
        sinceTag = sinceTag.sort()[sinceTag.length - 1];

        let sinceCommitStdout = "";
        const sinceCommitOptions = {};
        sinceCommitOptions.listeners = {
            stdout: (data) => {
                sinceCommitStdout += data.toString();
            }
        }
        let snapshotNumber = "";
        const snapshotNumberOptions = {}
        snapshotNumberOptions.listeners = {
            stdout: (data) => {
                snapshotNumber += data.toString();
            }
        }
        if (sinceTag === undefined) {
            await exec.exec("docker", [
                "exec",
                container,
                "git", "log", "--pretty=format:%H"
            ],
            sinceCommitOptions)
            sinceCommit = sinceCommitStdout.split("\n")
            sinceCommit = sinceCommit[sinceCommit.length - 1]

            await exec.exec("docker", [
                "exec",
                container,
                "git", "rev-list", "--count", "HEAD",
                snapshotNumberOptions
            ])
            console.log("No version tags found - using number of commits to current branch for snapshot number")
        } else {
            console.log("Found version tag: " + sinceTag)
            await exec.exec("docker", [
                "exec",
                container,
                "git", "show-ref", "-s",
                sinceTag
            ], sinceCommitOptions)
            await exec.exec("docker", [
                "exec",
                container,
                "git", "rev-list", "--count",
                sinceCommitStdout + "...HEAD"
            ], snapshotNumberOptions)
        }
        core.endGroup()

        console.log("Since: " + sinceCommit)
        console.log("Snapshot Number: " + snapshotNumber)

        // # TODO: check that HEAD does not match since_commit
        // # --> this means there is nothing to bump!

        core.startGroup("Bump changelog")
        await exec.exec("docker", [
            "exec",
            container,
            "gbp", "dch", "--verbose",
            "--git-author", "--ignore-branch",
            "--snapshot",
            "--since=" + sinceCommit,
            "--snapshot-number=" + snapshotNumber
        ])
        
        if (isReleaseVersion) {
            await exec.exec("docker", [
                "exec",
                container,
                "gbp", "dch", "--verbose",
                "--git-author", "--ignore-branch",
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
