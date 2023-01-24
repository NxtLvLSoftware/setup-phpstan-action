import {addPath, info, getInput, setFailed, setOutput} from "@actions/core"
import {Octokit} from "@octokit/action";
import {restEndpointMethods} from "@octokit/plugin-rest-endpoint-methods";
import {downloadRelease} from "@terascope/fetch-github-release";
import {RestEndpointMethodTypes} from "@octokit/plugin-rest-endpoint-methods/dist-types/generated/parameters-and-response-types";
import * as cache from "@actions/cache"
import * as path from "path"
import * as fs from "fs"

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
async function findVersion(gitHubApi: Octokit, target: string): Promise<RestEndpointMethodTypes["repos"]["getLatestRelease"]["response"]["data"]> {
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

type ReleaseAsset = RestEndpointMethodTypes["repos"]["getLatestRelease"]["response"]["data"]["assets"] extends (infer U)[] ? U : never;

/**
 * Find a single asset from a release given a file name.
 *
 * @param assets
 * @param file
 */
function findAsset(assets: RestEndpointMethodTypes["repos"]["getLatestRelease"]["response"]["data"]["assets"], file: string): ReleaseAsset {
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
async function copyExecutable(executablePath: string, restorePath: string) : Promise<string> {
	const nameParts = executablePath.split(".");
	const fileType = nameParts.pop() ?? "";
	const fileName = nameParts.pop()?.split("/").pop() ?? "";
	if (typeof executablePath === undefined || (fileType.toLowerCase() !== "phpstan" && (fileType.toLowerCase() === "phar" && fileName.toLowerCase() !== "phpstan"))) {
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
		if(err) {
			throw new Error(`Could not copy '${executablePath}' to '${restorePath}'. ${err.message}`);
		}
	});

	return restorePath;
}

/**
 * Download or restore a cached phpstan.phar executable.
 *
 * @param releaseId
 * @param asset
 * @param restorePath
 * @param cacheKey
 */
async function install(releaseId: number, asset: ReleaseAsset, restorePath: string, cacheKey: string): Promise<string> {
	const hitKey = await cache.restoreCache([restorePath], cacheKey);

	if (hitKey === undefined) {
		await downloadRelease(GITHUB_REPO_OWNER, GITHUB_REPO, restorePath, (release): boolean => {
			return release.id === releaseId;
		}, (releaseAsset): boolean => {
			return releaseAsset.id === asset.id;
		}, false, false);

		await cache.saveCache([restorePath], cacheKey);
		info(`${ACTION_OUT_PREFIX} Downloaded ${GITHUB_RELEASE_ASSET_NAME} to ${restorePath}`);
	} else {
		info(`${ACTION_OUT_PREFIX} Using cached ${GITHUB_RELEASE_ASSET_NAME}, restored to ${restorePath}`);
	}

	return restorePath;
}

/**
 * Setup PHPStan executable in the given path, taking care of caching.
 */
export async function run(): Promise<void> {
	const RestOctokit = Octokit.plugin(restEndpointMethods);
	const gitHubApi = new RestOctokit();

	const release = await findVersion(gitHubApi, getInput("version"));
	const asset = findAsset(release.assets, GITHUB_RELEASE_ASSET_NAME);

	const restorePath = path.normalize(getInput("install-path"));
	await fs.mkdir(restorePath, {recursive: true}, (err) => {
		if (err) {
			throw new Error(`${ACTION_OUT_PREFIX} Could not create install directory. ${err.message}`);
		}
	});

	const executablePath = path.normalize(getInput("path"));
	let phpStanBin: string;
	try {
		phpStanBin = await copyExecutable(executablePath, restorePath);
		info(`${ACTION_OUT_PREFIX} Using provided phpstan executable '${executablePath}'`);
	} catch (err) {
		if (executablePath != "undefined") {
			info(`${ACTION_OUT_PREFIX} Provided executable could not be found, falling back to target version ${release.tag_name} released @ ${release.published_at}`);
		} else {
			info(`${ACTION_OUT_PREFIX} Using target version ${release.tag_name} released @ ${release.published_at}`);
		}
		const cacheKey = `setup-phpstan-action-v${ACTION_VERSION}-${release.tag_name}-${asset.id}-${restorePath.replace(/\//g, "-")}-${GITHUB_RELEASE_ASSET_NAME}`;
		phpStanBin = await install(release.id, asset, restorePath, cacheKey) + GITHUB_RELEASE_ASSET_NAME;
	}

	setOutput("phpstan", phpStanBin);
	addPath(path.dirname(phpStanBin));
}

;(async () => {
	await run();
})().catch(setFailed);
