const core = require("@actions/core")
const exec = require("@actions/exec")
const firstline = require("firstline")
const hub = require("docker-hub-utils")
const path = require("path")
const fs = require("fs")

// Next version (revision reset to 1 if the package has one); null lets gbp bump the revision
function getNextVersion(scheme, version, revision, now = new Date()) {
    const suffix = revision ? "-1" : ""

    if (scheme === "date") {
        const today = now.getUTCFullYear() + "." + (now.getUTCMonth() + 1) + "." + now.getUTCDate()
        if (version === today) {
            return today + ".1" + suffix
        }
        if (version.startsWith(today + ".")) {
            const n = parseInt(version.slice(today.length + 1), 10)
            return today + "." + (n + 1) + suffix
        }
        return today + suffix
    }

    const parts = version.match(/^(\d+)\.(\d+)\.(\d+)$/)
    if (!parts) {
        return null
    }
    return parts[1] + "." + parts[2] + "." + (parseInt(parts[3], 10) + 1) + suffix
}

async function main() {
    try {
        const ignoreRegexStr = core.getInput("ignore_regex") || ""
        const ignoreRegexList = ignoreRegexStr.split("\n").filter(x => x !== "")

        const snapshotNumber = core.getInput("snapshot_number") || ""
        const sinceRefname = core.getInput("since") || ""
        const authorName = core.getInput("author_name") || ""
        const authorEmail = core.getInput("author_email") || ""

        if (authorName === "" || authorEmail === "") {
            throw "Invalid author information"
        }

        const versionScheme = core.getInput("version_scheme") || "semver"
        if (!["semver", "date"].includes(versionScheme)) {
            throw new Error("Invalid version_scheme: " + versionScheme)
        }

        const isReleaseVersion = core.getInput("release").toLowerCase() === 'true' || false
        const sourceRelativeDirectory = core.getInput("source_directory") || "./"

        const workspaceDirectory = process.cwd()
        const sourceDirectory = path.join(workspaceDirectory, sourceRelativeDirectory)

        const file = path.join(sourceDirectory, "debian/changelog")
        const changelog = await firstline(file)
        const regex = /^(?<pkg>.+) \(((?<epoch>[0-9]+):)?(?<version>[^:-]+)(-(?<revision>[^:-]+))?\) (?<packageDistribution>.+);/
        const match = changelog.match(regex)
        let { pkg, epoch, version, revision, packageDistribution } = match.groups

        const container = pkg

        core.startGroup("Print details")
        const details = {
            pkg: pkg,
            epoch: epoch,
            version: version,
            revision: revision,
            workspaceDirectory: workspaceDirectory,
            sinceRefname: sinceRefname,
            snapshotNumber: snapshotNumber,
            authorName: authorName,
            authorEmail: authorEmail,
            isReleaseVersion: isReleaseVersion,
            versionScheme: versionScheme,
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
            "pitop/git-buildpackage:bookworm-master",
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

        gbpDchOpts = ["--auto"];
        if (sinceRefname !== "") {
            gbpDchOpts = ["--since", sinceRefname];
        }

        ignoreRegexList.forEach((ignoreRegexEntr) => {
            gbpDchOpts.push("--ignore-regex=" + ignoreRegexEntr)
        })

        if (snapshotNumber !== "") {
            gbpDchOpts.push("--snapshot-number=" + snapshotNumber)
        }

        // An UNRELEASED entry already carries the version someone chose
        if (packageDistribution !== "UNRELEASED") {
            const nextVersion = getNextVersion(versionScheme, version, revision)
            if (nextVersion) {
                gbpDchOpts.push("--new-version=" + (epoch ? epoch + ":" : "") + nextVersion)
            } else {
                core.warning("Version " + version + " is not x.y.z; bumping the Debian revision instead")
            }
        }

        await exec.exec("docker", [
            "exec",
            container,
            "gbp", "dch", "--verbose", "--no-multimaint",
            // Ignore branch in case this is a checked out PR
            "--ignore-branch",
            "--snapshot",
            ...gbpDchOpts,
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
                "gbp", "dch", "--verbose", "--no-multimaint",
                // Ignore branch in case this is a checked out PR
                "--ignore-branch",
                "--release",
                "--distribution=" + distro,
                "--spawn-editor=snapshot"
            ])
        }
        core.endGroup()

        newChangelog = await firstline(file);
        ({ pkg, epoch, version, revision, packageDistribution } = newChangelog.match(regex).groups)
        const newVersion = (epoch? epoch + ":" : "") + version + (revision? "-" + revision : "");
        console.log("Bumped version is ", newVersion)
        core.setOutput("version", newVersion);

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
