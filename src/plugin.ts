import prompts from "prompts";
import fs from "fs";
import { yellow, green, dim, reset } from "ansi-colors";
import dedent from "dedent";
import { cmd } from "./utils/platform";
import licenses from "spdx-license-list";
import {isGitHubCLIAvailable} from "./utils/github";

const capitalize = (word: string) => word[0].toUpperCase() + word.slice(1);
const empty = (v: any) => Boolean(v);

const validatePluginID = (pluginID: string, includeReason = false) => {
	if (fs.existsSync(pluginID) && fs.lstatSync(pluginID).isDirectory()) {
		return includeReason
			? dedent`
          A directory ${green(pluginID)} already exists

          Either choose a different id or press ${yellow(
		`${cmd} + C`
	)} to cancel`
			: false;
	}
	return (
		!pluginID.includes(" ") ||
    (includeReason ? "The id must not contain spaces" : false)
	);
};

export interface PluginInfo {
  id: string;
  name: string;
  className: string;
  description: string;
  author: string;
  authorUrl: string;
  vault_path: string;
  dev_vault: string;
  fundingUrl: string;
  isDesktopOnly: boolean;
  hasStylesheet: boolean;
  license: string;
  initRepo: boolean;
  workflow: boolean;
  i18n: boolean;
  createGitHubRepo: boolean | undefined | null;
  
}

export async function prompt(): Promise<PluginInfo> {
	const defaultID = process.argv.slice(2).join("-").toLowerCase();
	const defaultLicense = process.env.obsidian_plugin_license ? licenses[process.env.obsidian_plugin_license].name : "MIT";
	prompts.override({
		id: defaultID && validatePluginID(defaultID) ? defaultID : undefined,
	});
	const answers = await prompts(
		[
			{
				type: () => "text",
				name: "id",
				message: `Enter the plugin id ${reset(dim("(lowercase, no spaces)"))}`,
				initial: defaultID,
				format: (text) => text.trim().toLowerCase(),
				validate: (text) => validatePluginID(text, true),
			},
			{
				type: "text",
				name: "name",
				message: "Enter the plugin name",
				// @ts-ignore
				initial: (prev) =>
					prev
						.replace("obsidian-plugin", "")
						.split("-")
						.filter((x: string) => x)
						.map(capitalize)
						.join(" "),
			},
			{
				type: "text",
				name: "description",
				message: "Write a short description of what the plugin does",
			},
			{
				type: "text",
				name: "author",
				message:
          "Enter your name or username you'd like the plugin to show as the author",
				initial: process.env.obsidian_plugin_author_name,
			},
			{
				type: "text",
				name: "vault_path",
				message: "Enter the path to your main vault, if you want to use the export command",
				initial: process.env.obsidian_plugin_vault_path,
			},
			{
				type: "text",
				name: "dev_vault",
				message: "Enter the path to your development vault",
				initial: process.env.obsidian_plugin_dev_vault			
			},
			{
				type: "text",
				name: "authorUrl",
				message: "Add your website or social media account (optional)",
				initial: process.env.obsidian_plugin_author_url,
			},
			{
				type: "text",
				name: "fundingUrl",
				message: "Add a link to your funding page (optional)",
				initial: process.env.obsidian_plugin_funding_url,
			},
			{
				type: "confirm",
				name: "isDesktopOnly",
				message: "Is this plugin desktop-only?",
			},
			{
				type: "confirm",
				name: "hasStylesheet",
				message: "Does your plugin include styles?",
			},
			{
				type: "confirm",
				name: "initRepo",
				message: "Initialize a git repository?",
			},
			{
				type: prev => isGitHubCLIAvailable() && prev ? "confirm" : null,
				name: "createGitHubRepo",
				message: "Create a GitHub repository? (requires GitHub CLI)",
			},
			{
				type: "confirm",
				name: "i18n",
				message: "Do you want to load i18n?",
			},
			{
				type: "confirm",
				name: "workflow",
				message: "Do you want to load .github/workflow?",
			},
			{
				type: "autocomplete",
				name: "license",
				message: `Choose a license ${reset(
					dim("(type to filter, ↑ or ↓ to navigate)")
				)}`,
				initial: defaultLicense,
				choices: Object.entries(licenses).map(([key, license]) => {
					return {
						value: key,
						title: license.name,
						description: (license.osiApproved && "OSI Approved") || "",
					};
				}),
			},
		],
		{
			onCancel() {
				process.exit();
			},
		}
	);
	return {
		...answers,
		className: answers.name.split(" ").filter(empty).map(capitalize).join("").replaceAll(/\W+/g, ""),
	};
}
