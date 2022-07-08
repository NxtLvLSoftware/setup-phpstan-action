import {addPath, info, getInput, setFailed, setOutput} from "@actions/core"
import { Octokit } from "@octokit/action";
import { restEndpointMethods } from "@octokit/plugin-rest-endpoint-methods";
import { downloadRelease } from "@terascope/fetch-github-release";
import {RestEndpointMethodTypes} from "@octokit/plugin-rest-endpoint-methods/dist-types/generated/parameters-and-response-types";
import * as cache from "@actions/cache"
import * as path from "path"
import * as fs from "fs"

/**
 * Find a PHPStan release given a version.
 *
 * @param gitHubApi
 * @param target
 */
async function findVersion(gitHubApi: Octokit, target: string): Promise<RestEndpointMethodTypes["repos"]["getLatestRelease"]["response"]["data"]> {
	if (target.match(/^\d+\.\d+\.\d+/)) {
		const response = await gitHubApi.rest.repos.getReleaseByTag({
			owner: "phpstan",
			repo: "phpstan",
			tag: target
		});

		if(response.status !== 200) {
			throw new Error("Could not find a phpstan/phpstan release with tag " + target);
		}

		return response.data;
	}

	if(target.toLowerCase() === "latest") {
		const response = await gitHubApi.rest.repos.getLatestRelease({
			owner: "phpstan",
			repo: "phpstan"
		});

		if(response.status !== 200) {
			throw new Error("Could not find latest phpstan/phpstan release");
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
function findAsset(assets: RestEndpointMethodTypes["repos"]["getLatestRelease"]["response"]["data"]["assets"], file: string) : ReleaseAsset {
	const found = assets.find((asset, index) => {
		return asset.name === file;
	});

	if(found === undefined) {
		throw new Error("Could not find phpstan.phar asset in release");
	}

	return found;
}

/**
 * Download or restore a cached phpstan.phar executable.
 *
 * @param releaseId
 * @param asset
 * @param restorePath
 */
async function install(releaseId: number, asset: ReleaseAsset, restorePath: string, cacheKey: string) : Promise<string> {
	const hitKey = cache.restoreCache([restorePath], cacheKey);

	if (hitKey === undefined) {
		await downloadRelease("phpstan", "phpstan", restorePath, (release) : boolean => {
			return release.id === releaseId;
		}, (releaseAsset) : boolean => {
			return releaseAsset.id === asset.id;
		}, false, true);

		await cache.saveCache([restorePath], cacheKey);
		info("Downloaded phpstan.phar to " + restorePath);
	} else {
		info("Using cached phpstan.phar, restored to " + restorePath);
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
	const asset = findAsset(release.assets, "phpstan.phar");
	info(`Using target version ${release.tag_name} released @ ${release.published_at}`);

	const restorePath = path.resolve(getInput("install-path"));
	const cacheKey = "setup-phpstan-v1-" + asset.id + "-" + restorePath.replace(/\//g, "-") + "-phpstan.phar";

	fs.mkdirSync(restorePath, { recursive: true });
	let phpStanBin = await install(release.id, asset, restorePath, cacheKey) + "phpstan.phar";

	setOutput("phpstan", phpStanBin)
	addPath(path.dirname(phpStanBin))
}

;(async () => {
	await run();
})().catch(setFailed);
