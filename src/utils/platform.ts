import os from "os";
import execa from "execa";
import { PluginInfo } from "../plugin";
import { getDefaultBranch } from "./github";


export type Platform = typeof platforms[number];
const platforms = ["npm", "yarn/1", "yarn/2", "pnpm", "yarn"] as const;
export const detectPlatform = (): Platform => {
	const platformAgent = process.env.npm_config_user_agent || "";
	for (const platform of platforms) {
		if (platformAgent.startsWith(platform)) return platform;
	}
	const packageManager = process.env.npm_execpath?.includes("pnpm") 
		? "pnpm": process.env.npm_execpath?.includes("yarn")
			? "yarn": "npm";
	return packageManager as Platform;
};

const platform = detectPlatform();

export const pkgManager = platform.startsWith("yarn") ? "yarn" : platform;
export const runCommandText = (cmd?: string) =>
	pkgManager === "yarn" ? `yarn ${cmd}` : `${pkgManager} run ${cmd}`;

export const installCommandText = `${pkgManager} install`;

export const run = (args: string | string[], cwd = process.cwd()) => {
	if (!Array.isArray(args)) {
		args = [args];
	}
	return execa(pkgManager, args, { cwd });
};

export const cmd = os.platform() === "darwin" ? "⌘" : "ctrl";

export function getCommandByPackageManager(plugin: PluginInfo) {
	const addStyle = plugin.hasStylesheet ? " --with-stylesheet src/styles.css" : "";
	let exportCmd = "";
	let bump = "";
	let deploy = "";
	if (plugin.vault_path.trim().length > 0) {
		if (pkgManager !== "yarn") {
			exportCmd = `"preexport" : "${pkgManager} run build",\n\t\t"export" : "node export.js",`;
			deploy = `"predeploy" : "${pkgManager} run bump",\n\t\t"deploy" : "${pkgManager} run export"`;
		} else {
			exportCmd = `"export" : "${pkgManager} build && node export.js",`;
			deploy = `"deploy" : "${pkgManager} bump && node export.js"`;
		}
	}
	if (plugin.initRepo && plugin.createGitHubRepo) {
		if (pkgManager !== "yarn") {
			bump = `"postbump" : "git push --follow-tags origin ${getDefaultBranch()},"`;
		} else {
			bump = `"push" : "yarn bump && git push --follow-tags origin ${getDefaultBranch()},"`;
		}
	}
	return {
		build:  `obsidian-plugin build src/main.ts${addStyle}`,
		dev: "node dev.js",
		export: exportCmd,
		bump: bump,
		deploy: deploy,
	};
}