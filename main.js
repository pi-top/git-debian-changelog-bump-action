const core = require("@actions/core")
const exec = require("@actions/exec")
const firstline = require("firstline")
const hub = require("docker-hub-utils")
const path = require("path")
const fs = require("fs")

async function main() {
    try {
        const snapshotNumber = core.getInput("snapshot_number") || ""
        const sinceRefname = core.getInput("since") || ""
        const authorName = core.getInput("author_name") || ""
        const authorEmail = core.getInput("author_email") || ""

        if (snapshotNumber === "" || sinceRefname === "") {
            throw "Invalid package information"
        }

        if (authorName === "" || authorEmail === "") {
            throw "Invalid author information"
        }

        const isReleaseVersion = core.getInput("release").toLowerCase() === 'true' || false
        const sourceRelativeDirectory = core.getInput("source_directory") || "./"

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
            sinceCommit: sinceCommit,
            snapshotNumber: snapshotNumber,
            authorName: authorName,
            authorEmail: authorEmail,
            isReleaseVersion: isReleaseVersion,
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
            "--env", "DEBFULLNAME=" + authorName,
            "--env", "DEBEMAIL=" + authorEmail,
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

        core.startGroup("Bump changelog")
        await exec.exec("docker", [
            "exec",
            container,
            "gbp", "dch", "--verbose", "--ignore-branch",
            "--snapshot",
            "--since=" + sinceCommit,
            "--snapshot-number=" + snapshotNumber
        ])
        
        if (isReleaseVersion) {
            let distroStdout = "";
            const distroOptions = {}
            distroOptions.listeners = {
                stdout: (data) => {
                    distroStdout += data.toString();
                }
            }
            await exec.exec("docker", [
                "exec",
                container,
                "lsb_release", "-cs"
            ], distroOptions)
            distro = distroStdout.split("\n")[0];

            await exec.exec("docker", [
                "exec",
                container,
                "gbp", "dch", "--verbose", "--ignore-branch",
                "--release",
                "--distribution=" + distro,
                "--spawn-editor=snapshot"
            ])
        }
        core.endGroup()

        core.startGroup("Show diff")
        await exec.exec("diff", [
            sourceDirectory + "/debian/changelog",
            "/tmp/changelog.orig"
        ], { ignoreReturnCode: true })
        core.endGroup()
    } catch (error) {
        core.setFailed(error.message)
    }
}

main()
