import { execSync, spawnSync } from "child_process";
import simpleGit, {BranchSummary} from "simple-git";

export function getDefaultBranch(): string|null {
	const git = simpleGit();
	git.branchLocal((err: any, branch: BranchSummary) => {
		if (err) {
			console.log(err);
			return null;
		}
		return branch.current;
	});
	return null;
}

export function getUserGithub(): string {
	const defaultUserName = process.env.npm_config_init_author_name || "";
	try {
		const output = spawnSync("gh", ["auth", "status"], { encoding: "utf-8" });
		const stderr = output.stderr;
		//create a list of lines
		const lines = stderr.split(/\r?\n/);
		//get the line with the username
		const line = lines.find(line => line.includes("✓ Logged in to github.com as"));
		//get the username
		const username = line?.split("✓ Logged in to github.com as")[1].trim();
		if (username) {
			return username.split(" ")[0];
		}
	} catch (error) {
		return defaultUserName;
	}
	return defaultUserName;
}

export function isGitHubCLIAvailable(): boolean {
	try {
		const output = execSync("gh --version", { encoding: "utf-8" });
		const regex = /gh version ([0-9]+)/;

		const match = output.match(regex);
		if (match && match[1]) {
			return true;
		}
	} catch (error) {
		return false;
	}
	return false;
}