import { PluginInfo, prompt } from "./plugin";
import { renderFile } from "ejs";
import path from "path";
import { write, mkdir } from "./utils/fs";
import { format } from "prettier";
import {
  run,
  runCommandText,
  installCommandText,
  publish,
} from "./utils/platform";
import dedent from "dedent";
import { green, cyan, yellow, red } from "ansi-colors";
import fs from "fs";
import { execSync, spawnSync } from "child_process";

const newline = () => console.log();

const pluginPath = (plugin: PluginInfo, ...subPaths: string[]) =>
  path.join(process.cwd(), plugin.id, ...subPaths);

interface WriteTemplateOptions {
  subPath?: string;
  templateData?: Record<string, unknown>;
}

function getUserGithub(): string {
  const defaultUserName = process.env.npm_config_init_author_name || "";
  try {
    const output = spawnSync('gh', ['auth', 'status'], { encoding: 'utf-8' });
    const stderr = output.stderr;
    //create a list of lines
    const lines = stderr.split(/\r?\n/);
    //get the line with the username
    const line = lines.find(line => line.includes('✓ Logged in to github.com as'));
    //get the username
    const username = line?.split('✓ Logged in to github.com as')[1].trim();
    if (username) {
      return username.split(' ')[0];
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
    path.extname(name) !== "" ? format(content, { filepath: name }) : content
  );
};

(async () => {
  let plugin = await prompt();
  const writeTemplate = makeWriteTemplate(plugin);
  const githubUser = getUserGithub();
  console.log(`Creating a new obsidian plugin at ${green(`./${plugin.id}`)}`);

  await writeTemplate("manifest.json");
  await writeTemplate(".env.json")
  await writeTemplate("package.json");
  await writeTemplate("main.ts", { subPath: "src" });
  await writeTemplate("settings.ts", { subPath: "src" });
  await writeTemplate("interface.ts", { subPath: "src" });
  await writeTemplate("i18next.d.ts", { subPath: "src/@types" });
  await writeTemplate("en.json", { subPath: "src/i18n/locales" });
  await writeTemplate("fr.json", { subPath: "src/i18n/locales" });
  await writeTemplate("i18next.ts", { subPath: "src/i18n" });
  await writeTemplate(".eslintrc.js");
  await writeTemplate("tsconfig.json");
  await writeTemplate("types.d.ts");
  await writeTemplate(".gitignore");
  await writeTemplate("export.js");
  await writeTemplate("publish.yaml", { subPath: ".github/workflows" });
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

  await write(
    pluginPath(plugin, "LICENSE"),
    (await import(`spdx-license-list/licenses/${plugin.license}`)).licenseText
  );

  if (plugin.hasStylesheet) {
    await writeTemplate("styles.css", { subPath: "src" });
  }

  console.log("Installing plugin dependencies, this may take a little while.");

  const installProcess = run("install", pluginPath(plugin));
  installProcess.stdout?.pipe(process.stdout);

  await installProcess;

  newline();

  //create a new git repo using the plugin id as the repo name
  if (plugin.initRepo) {
    execSync(`git init ${pluginPath}`);
  }
  if (plugin.createGitHubRepo) {
    execSync(`gh repo create ${plugin.id} --public --source=${pluginPath} --remote=upstream`);
  }

  console.log(dedent`
    To get started developing on your plugin run

      ${cyan(`cd ${plugin.id}`)}
      ${cyan(runCommandText("dev"))}

    ${yellow("Please check your LICENSE file to see if any updates are needed")}
  `);

  newline();
})();
