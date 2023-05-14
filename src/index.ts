import { PluginInfo, prompt } from "./plugin";
import { renderFile } from "ejs";
import path from "path";
import { write, mkdir } from "./utils/fs";
import { format } from "prettier";
import simpleGit, {BranchSummary} from "simple-git";


import {
	run,
	runCommandText,
	installCommandText,
	publish,
} from "./utils/platform";
import dedent from "dedent";
import { green, cyan, yellow, blue, bold } from "ansi-colors";
import fs from "fs";
import { execSync, spawnSync } from "child_process";

const newline = () => console.log();

const pluginPath = (plugin: PluginInfo, ...subPaths: string[]) =>
	path.join(process.cwd(), plugin.id, ...subPaths);

interface WriteTemplateOptions {
	subPath?: string;
	templateData?: Record<string, unknown>;
}

function getDefaultBranch() {
	const git = simpleGit();
	git.branchLocal((err: any, branch: BranchSummary) => {
		if (err) {
			console.log(err);
			return;
		}
		return branch.current;
	});
	return "";
}

function getUserGithub(): string {
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

const makeWriteTemplate = (plugin: PluginInfo) => async (
	name: string,
	{ subPath = "", templateData = {} }: WriteTemplateOptions = {}
) => {
	let content: string;
	if (path.extname(name) === ".yaml") {
		content = await renderFile(
			path.join(__dirname, "templates", `${name}.ejs`),
			{ plugin, ...templateData }
		);
	} else {
		content = await renderFile(
			path.join(__dirname, "templates", `${name}.ejs`),
			{ plugin, ...templateData },
			{ rmWhitespace: true }
		);
	}
	const destinationDir = pluginPath(plugin, subPath);

	if (!fs.existsSync(destinationDir)) {
		await mkdir(destinationDir, { recursive: true });
	}

	await write(
		pluginPath(plugin, subPath, name),
		path.extname(name) !== "" ? format(content, { filepath: name, useTabs: true, semi: true, endOfLine: "crlf" }) : content
	);
};

(async () => {
	const plugin = await prompt();
	const writeTemplate = makeWriteTemplate(plugin);
	const githubUser = getUserGithub();
	console.log(`Creating a new obsidian plugin at ${green(`./${plugin.id}`)}`);
	
	const allTemplates: { name: string; subPath?: string }[] = [
		{ name: "manifest.json" },
		{ name: ".hotreload"},
		{ name: ".eslintignore"},
		{ name: "package.json" },
		{ name: ".eslintrc.js" },
		{ name: "tsconfig.json" },
		{ name: "types.d.ts" },
		{ name: ".gitignore" },
		{ name: "README.md" },
		{ name: ".env"},
		{ name: "export.js"},
		{ name: "dev.js"},
		{ name: "publish.yaml", subPath: ".github/workflows" },
		{ name: "bump.yaml", subPath: ".github/workflows" },
		{ name: "main.ts", subPath: "src" },
		{ name: "settings.ts", subPath: "src" },
		{ name: "interface.ts", subPath: "src" },
		{ name: "modals.ts", subPath: "src" },
		{ name: "i18next.d.ts", subPath: "src/@types" },
		{ name: "i18next.ts", subPath: "src/i18n" },
		{ name: "en.json", subPath: "src/i18n/locales" },
		{ name: "fr.json", subPath: "src/i18n/locales" },
	];
	
	if (plugin.hasStylesheet) {
		allTemplates.push({ name: "styles.css", subPath: "src" });
	}

	for (const template of allTemplates) {
		if (template.name === "README.md") {
			await writeTemplate("README.md", {
				templateData: {
					platform: {
						build: runCommandText("build"),
						dev: runCommandText("dev"),
						export: runCommandText("export"),
						install: installCommandText,
						publish: publish,
					},
					github: {
						user: githubUser,
					}
				},
			});
		} else if (template.name === "package.json") {
			const addStyle = plugin.hasStylesheet ? " --with-stylesheet src/styles.css" : "";
			let exportCmd = "";
			let bump = "";
			let upgrade = "";
			if (plugin.vault_path.trim().length > 0) {
				exportCmd = "\"preexport\" : \"npm run build\",\n\t\t\"export\" : \"node export.js\"";
				// eslint-disable-next-line quotes
				upgrade = `"preupgrade" : "nmp run bump",\n\t\t"upgrade" : "npm run export"`;
			}
			if (plugin.initRepo && plugin.createGitHubRepo) {
				bump = `"postbump" : "git push --follow-tags origin ${getDefaultBranch()}"`;
			}
			await writeTemplate("package.json", {
				templateData: {
					scripts: {
						build:  `obsidian-plugin build src/main.ts${addStyle}`,
						dev: "node dev.js",
						export: exportCmd,
						bump: bump,
						upgrade: upgrade,
					}
				},
			});
		} else {
			await writeTemplate(template.name, { subPath: template.subPath });
		}
	}


	await write(
		pluginPath(plugin, "LICENSE"),
		(await import(`spdx-license-list/licenses/${plugin.license}`)).licenseText
	);
	

	console.log(blue(bold("Installing plugin dependencies, this may take a little while.")));

	const installProcess = run("install", pluginPath(plugin));
	installProcess.stdout?.pipe(process.stdout);

	await installProcess;

	newline();

	//create a new git repo using the plugin id as the repo name
	if (plugin.initRepo) {
		execSync(`git init ${pluginPath(plugin)}`);
	}
	if (plugin.createGitHubRepo && plugin.initRepo) {
		execSync(`gh repo create ${plugin.id} --public --source=${pluginPath(plugin)} --remote=upstream`);
	}

	console.log(dedent`
    To get started developing on your plugin run

      ${cyan(`cd ${plugin.id}`)}
      ${cyan(runCommandText("dev"))}

    ${yellow("Please check your LICENSE file to see if any updates are needed")}
  `);

	newline();
})();
