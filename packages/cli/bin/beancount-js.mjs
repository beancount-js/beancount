#!/usr/bin/env node
import { access } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { spawn, spawnSync } from "node:child_process";

const cliDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(cliDirectory, "../../..");
const studioDirectory = resolve(repositoryRoot, "packages/fava");
const serverEntry = resolve(studioDirectory, "build-server/index.js");
const arguments_ = process.argv.slice(2);

function usage() {
  console.log(`Usage: beancount-js [folder] [--port 4173] [--host 127.0.0.1] [--entry file]

Starts Beancount Studio for a project folder. Project-local data lives in
.beancount/; the global project registry is under XDG config (beancount-js).`);
}

if (arguments_.includes("--help") || arguments_.includes("-h")) {
  usage();
  process.exit(0);
}

let folder;
let port = process.env.PORT ?? "4173";
let host = process.env.HOST ?? "127.0.0.1";
let entry;
for (let index = 0; index < arguments_.length; index += 1) {
  const value = arguments_[index];
  if (value === "--port") port = arguments_[++index] ?? port;
  else if (value === "--host") host = arguments_[++index] ?? host;
  else if (value === "--entry") entry = arguments_[++index];
  else if (!value.startsWith("-") && !folder) folder = value;
  else {
    console.error(`Unknown argument: ${value}`);
    usage();
    process.exit(1);
  }
}

const projectRoot = resolve(folder ?? process.cwd());
try {
  await access(serverEntry);
} catch {
  const command = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
  const build = spawnSync(command, ["--dir", studioDirectory, "build:server"], {
    cwd: repositoryRoot,
    stdio: "inherit",
  });
  if (build.status !== 0) process.exit(build.status ?? 1);
}

const origin = `http://${host}:${port}`;

async function resolveStudioUrl() {
  for (let attempt = 0; attempt < 75; attempt += 1) {
    try {
      const response = await fetch(`${origin}/api/projects`);
      if (response.ok) {
        const projects = await response.json();
        const projectId = Array.isArray(projects) ? projects[0]?.id : undefined;
        if (typeof projectId === "string" && projectId) {
          return `${origin}/${encodeURIComponent(projectId)}/`;
        }
        return `${origin}/`;
      }
    } catch {
      // Server still starting.
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 200));
  }
  return `${origin}/`;
}

const child = spawn(process.execPath, [serverEntry], {
  cwd: studioDirectory,
  stdio: "inherit",
  env: {
    ...process.env,
    HOST: host,
    PORT: port,
    BEANCOUNT_STUDIO_RUNTIME: "server",
    BEANCOUNT_STUDIO_PROJECT_ROOT: projectRoot,
    ...(entry ? { BEANCOUNT_STUDIO_ENTRY_FILE: entry } : {}),
  },
});
child.on("exit", (code) => process.exit(code ?? 0));

const studioUrl = await resolveStudioUrl();
console.log(`Beancount Studio: ${studioUrl}`);
