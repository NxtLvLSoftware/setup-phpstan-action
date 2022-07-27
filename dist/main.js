"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.run = void 0;
const core_1 = require("@actions/core");
const action_1 = require("@octokit/action");
const plugin_rest_endpoint_methods_1 = require("@octokit/plugin-rest-endpoint-methods");
const fetch_github_release_1 = require("@terascope/fetch-github-release");
const cache = require("@actions/cache");
const path = require("path");
const fs = require("fs");
const ACTION_NAME = "Setup PHPStan";
const ACTION_VERSION = "1";
const ACTION_OUT_PREFIX = `[${ACTION_NAME}]`;
const GITHUB_REPO_OWNER = "phpstan";
const GITHUB_REPO = "phpstan";
const GITHUB_RELEASE_ASSET_NAME = "phpstan.phar";
/**
 * Find a PHPStan release given a version.
 *
 * @param gitHubApi
 * @param target
 */
async function findVersion(gitHubApi, target) {
    if (target.match(/^\d+\.\d+\.\d+/)) {
        const response = await gitHubApi.rest.repos.getReleaseByTag({
            owner: GITHUB_REPO_OWNER,
            repo: GITHUB_REPO,
            tag: target
        });
        if (response.status !== 200) {
            throw new Error(`Could not find a ${GITHUB_REPO_OWNER}/${GITHUB_REPO} release with tag '${target}'`);
        }
        return response.data;
    }
    if (target.toLowerCase() === "latest") {
        const response = await gitHubApi.rest.repos.getLatestRelease({
            owner: GITHUB_REPO_OWNER,
            repo: GITHUB_REPO
        });
        if (response.status !== 200) {
            throw new Error(`Could not find latest ${GITHUB_REPO_OWNER}/${GITHUB_REPO} release`);
        }
        return response.data;
    }
    throw new Error("Invalid version target " + target);
}
/**
 * Find a single asset from a release given a file name.
 *
 * @param assets
 * @param file
 */
function findAsset(assets, file) {
    const found = assets.find((asset, index) => {
        return asset.name === file;
    });
    if (found === undefined) {
        throw new Error(`Could not find ${file} asset in release`);
    }
    return found;
}
/**
 * Copy a phpstan.phar to the install path.
 *
 * @param executablePath
 * @param restorePath
 */
async function copyExecutable(executablePath, restorePath) {
    const fileType = executablePath.split(".").pop();
    const fileName = fileType.split("/").pop();
    if (fileType != "phar" && (fileType != "phpstan" || fileName != "phpstan")) {
        throw new Error(`${executablePath} does not appear to be a phpstan executable`);
    }
    await fs.access(executablePath, fs.constants.R_OK, (err) => {
        if (err) {
            throw new Error(`${executablePath} is not readable`);
        }
    });
    await fs.access(executablePath, fs.constants.X_OK, (err) => {
        if (err) {
            throw new Error(`${executablePath} is not executable`);
        }
    });
    await fs.copyFile(executablePath, restorePath, (err) => {
        if (err) {
            throw new Error(`Could not copy '${executablePath}' to '${restorePath}'. ${err.message}`);
        }
    });
}
/**
 * Download or restore a cached phpstan.phar executable.
 *
 * @param releaseId
 * @param asset
 * @param restorePath
 * @param cacheKey
 */
async function install(releaseId, asset, restorePath, cacheKey) {
    const hitKey = await cache.restoreCache([restorePath], cacheKey);
    if (hitKey === undefined) {
        await fetch_github_release_1.downloadRelease(GITHUB_REPO_OWNER, GITHUB_REPO, restorePath, (release) => {
            return release.id === releaseId;
        }, (releaseAsset) => {
            return releaseAsset.id === asset.id;
        }, false, false);
        await cache.saveCache([restorePath], cacheKey);
        core_1.info(`${ACTION_OUT_PREFIX} Downloaded ${GITHUB_RELEASE_ASSET_NAME} to ${restorePath}`);
    }
    else {
        core_1.info(`${ACTION_OUT_PREFIX} Using cached ${GITHUB_RELEASE_ASSET_NAME}, restored to ${restorePath}`);
    }
    return restorePath;
}
/**
 * Setup PHPStan executable in the given path, taking care of caching.
 */
async function run() {
    const RestOctokit = action_1.Octokit.plugin(plugin_rest_endpoint_methods_1.restEndpointMethods);
    const gitHubApi = new RestOctokit();
    const release = await findVersion(gitHubApi, core_1.getInput("version"));
    const asset = findAsset(release.assets, GITHUB_RELEASE_ASSET_NAME);
    const restorePath = path.normalize(core_1.getInput("install-path"));
    await fs.mkdir(restorePath, { recursive: true }, (err) => {
        if (err) {
            throw new Error(`${ACTION_OUT_PREFIX} Could not create install directory. ${err.message}`);
        }
    });
    const executablePath = path.normalize(core_1.getInput("path"));
    let phpStanBin;
    try {
        await copyExecutable(executablePath, restorePath);
        core_1.info(`${ACTION_OUT_PREFIX} Using provided phpstan executable '${executablePath}'`);
    }
    catch (err) {
        if (executablePath != "phpstan") {
            core_1.info(`${ACTION_OUT_PREFIX} Provided executable could not be found, falling back to target version ${release.tag_name} released @ ${release.published_at}`);
        }
        else {
            core_1.info(`${ACTION_OUT_PREFIX} Using target version ${release.tag_name} released @ ${release.published_at}`);
        }
        const cacheKey = `setup-phpstan-v${ACTION_VERSION}-${release.tag_name}-${asset.id}-${restorePath.replace(/\//g, "-")}-${GITHUB_RELEASE_ASSET_NAME}`;
        phpStanBin = await install(release.id, asset, restorePath, cacheKey) + GITHUB_RELEASE_ASSET_NAME;
    }
    core_1.setOutput("phpstan", phpStanBin);
    core_1.addPath(path.dirname(phpStanBin));
}
exports.run = run;
;
(async () => {
    await run();
})().catch(core_1.setFailed);
