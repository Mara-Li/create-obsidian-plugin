import { PluginInfo, prompt } from "./plugin";
import { renderFile } from "ejs";
import path from "path";
import { write, mkdir } from "./utils/fs";
import { format } from "prettier";
import {
	run,
	runCommandText,
	installCommandText,
	getCommandByPackageManager,
} from "./utils/platform";
import dedent from "dedent";
import { green, cyan, yellow, blue, bold } from "ansi-colors";
import fs from "fs";
import { execSync } from "child_process";
import { getUserGithub } from "./utils/github";

const newline = () => console.log();

const pluginPath = (plugin: PluginInfo, ...subPaths: string[]) =>
	path.join(process.cwd(), plugin.id, ...subPaths);

interface WriteTemplateOptions {
	subPath?: string;
	templateData?: Record<string, unknown>;
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
		{ name: "commit-and-tag-version.js"},
		{ name: ".npmrc"},
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
					},
					github: {
						user: githubUser,
					}
				},
			});
		} else if (template.name === "package.json") {
			const cmd = getCommandByPackageManager(plugin);
			await writeTemplate("package.json", {
				templateData: {
					scripts: {
						build: cmd.build,
						dev: cmd.dev,
						export: cmd.export,
						bump: cmd.bump,
						upgrade: cmd.upgrade,
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
