# `create-obsidian-plugin`

A tool to easily create plugins for [obsidian](https://obsidian.md/)

## Getting started

Run

```
npm init @lisandra-dev/obsidian-plugin
```

or

```
yarn create @lisandra-dev/obsidian-plugin
```

and a plugin will be created in your current directory. It'll prompt you for needed info (like plugin-id, name, etc).

You can optionally pass a plugin-id to the command like

```
yarn create obsidian-plugin my-plugin
```

In this case a plugin with the id `my-plugin` will be created in the current directory. Afterwards, follow the directions from the plugin to get started

### Building the plugin for development

```
npm run dev
```

or

```
yarn dev
```

### Building the plugin for publish

```
npm run build
```

or

```
yarn build
```

## Fork difference

The fork separates the settings, interfaces and the main.ts. It also adds : 
- [i18next for translation](#i18next--translation-support)
- [commit-and-tag-version](https://www.npmjs.com/package/commit-and-tag-version) to automatically commit and tag the version based on the commit message (it must respect the [conventional commit](https://www.conventionalcommits.org/en/v1.0.0/) format)
- A GitHub workflows to automatically build and publish the plugin when a new tag is added. 
- A JavaScript that allows you to export the built plugin to your obsidian Vault. To do that you must add the path to your Vault (root) in the `.env` file.
- A better dev workflow using `.env` file and `dev.js` file. 

Moreover, the creating adds: 
- Funding information in the manifest (cf [funding](https://github.com/obsidianmd/obsidian-sample-plugin#funding-url)
- Desktop only question 
- Initialize a git repository 
- If you have [GitHub CLI](https://cli.github.com/) installed, you can also choose to create a new repository on GitHub. Obviously, you need to init a git repository before. The created repository will be public by default and use the same name as the plugin id.


### i18next : Translation support
This fork adds support for i18next for Obsidian, allowing translation of your plugin in different languages. If you need to add translation, just create a new `lang.json` in `i18n/locales` and update `i18n/i18nex.ts` to add the new language, as follows : 

```ts
import { moment } from "obsidian";
import * as en from "./locales/en.json";
import * as fr from "./locales/fr.json";
import * as newLang from "./locales/newLang.json";

export const resources = {
	en: { translation: en },
	fr: { translation: fr },
	newLang: { translation: newLang },
} as const;

export const translationLanguage = Object.keys(resources).find(
	i => i == moment.locale()) ? moment.locale() : "en";
```

### Useful environments variables : 

If you want to quickly create a plugin without rewrite each time the same information, you can set environment variable with the following name:
- `obsidian_plugin_author_name` : Your author name
- `obsidian_plugin_author_url` : Your author url (website, social media account, etc…)
- `obsidian_plugin_vault_path` : The path to your obsidian vault (root)
- `obsidian_plugin_dev_vault` : The path to your obsidian vault (root) for development
- `obsidian_plugin_funding_url` : Link to your funding page (Patreon, Paypal, Kofi, etc…)
- `obsidian_plugin_license` : Your favorite license by their identifier (MIT, Apache-2.0, etc…). See [here](https://spdx.org/licenses/) for the complete list of identifier.
