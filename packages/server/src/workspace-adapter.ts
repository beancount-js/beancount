import { createHash, randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import { basename, dirname, extname, join, relative, resolve } from "node:path";
import { homedir } from "node:os";
import type {
  AiSessionRecord,
  FileRevision,
  ProjectConfig,
  ProjectFile,
  ProjectResource,
  ProjectSnapshot,
  ProjectSummary,
  WorkspaceAdapter,
} from "@beancount-js/workspace";

const PROJECT_METADATA_DIRECTORY = ".beancount-js";
const PROJECT_CONFIG_FILENAME = "project.json";
const REGISTRY_FILENAME = "projects.json";
const SKIPPED_DIRECTORIES = new Set([
  ".git",
  "node_modules",
  PROJECT_METADATA_DIRECTORY,
]);
const LEDGER_EXTENSIONS = new Set([".bean", ".beancount", ".ledger"]);

type RegistryProject = ProjectConfig & { root: string };
type Registry = { version: 1; projects: RegistryProject[] };

export interface FilesystemWorkspaceOptions {
  configDirectory?: string;
  now?: () => Date;
}

function projectPath(path: string) {
  if (!path || path.startsWith("/") || path.includes("\\")) {
    throw new Error(`Project file path must be relative: ${path}`);
  }
  const clean = path.split("/").filter(Boolean);
  if (!clean.length || clean.some((part) => part === "." || part === "..")) {
    throw new Error(`Project file path escapes its root: ${path}`);
  }
  return clean.join("/");
}

function mimeTypeFor(path: string) {
  switch (extname(path).toLowerCase()) {
    case ".bean":
    case ".beancount":
    case ".ledger":
    case ".txt":
    case ".md":
      return "text/plain; charset=utf-8";
    case ".json":
      return "application/json";
    case ".yaml":
    case ".yml":
      return "application/yaml";
    case ".csv":
      return "text/csv; charset=utf-8";
    case ".pdf":
      return "application/pdf";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".gif":
      return "image/gif";
    case ".svg":
      return "image/svg+xml";
    default:
      return "application/octet-stream";
  }
}

async function listFiles(root: string, directory = root): Promise<string[]> {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.isDirectory()) {
      if (!SKIPPED_DIRECTORIES.has(entry.name)) {
        files.push(...(await listFiles(root, join(directory, entry.name))));
      }
      continue;
    }
    if (entry.isFile()) files.push(relative(root, join(directory, entry.name)));
  }
  return files.map((path) => path.replaceAll("\\", "/"));
}

function revision(contents: Uint8Array) {
  return createHash("sha256").update(contents).digest("hex");
}

async function readJson<T>(path: string): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(path, "utf8")) as T;
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

export async function findLedgerEntry(root: string) {
  const files = await listFiles(root);
  const ledgers = files.filter((file) => LEDGER_EXTENSIONS.has(extname(file)));
  const entry =
    ledgers.find((file) => /^main\.(bean|beancount|ledger)$/i.test(file)) ??
    ledgers.find((file) => !file.includes("/")) ??
    ledgers[0];
  if (!entry) {
    throw new Error(
      `No Beancount entry file found in ${root}. Expected .bean, .beancount, or .ledger.`,
    );
  }
  return entry;
}

export class FilesystemWorkspaceAdapter implements WorkspaceAdapter {
  private readonly registryPath: string;
  private readonly now: () => Date;

  constructor(options: FilesystemWorkspaceOptions = {}) {
    const configDirectory =
      options.configDirectory ??
      process.env.XDG_CONFIG_HOME ??
      join(homedir(), ".config", "beancount-js");
    this.registryPath = join(configDirectory, REGISTRY_FILENAME);
    this.now = options.now ?? (() => new Date());
  }

  private timestamp() {
    return this.now().toISOString();
  }

  private async readRegistry(): Promise<Registry> {
    return (
      (await readJson<Registry>(this.registryPath)) ?? {
        version: 1,
        projects: [],
      }
    );
  }

  private async writeRegistry(registry: Registry) {
    await fs.mkdir(dirname(this.registryPath), { recursive: true });
    await fs.writeFile(
      this.registryPath,
      JSON.stringify(registry, null, 2) + "\n",
    );
  }

  private async registryProject(id: string) {
    const project = (await this.readRegistry()).projects.find(
      (item) => item.id === id,
    );
    if (!project) throw new Error(`Project not found: ${id}`);
    return project;
  }

  private absolutePath(root: string, path: string) {
    const safePath = projectPath(path);
    const destination = resolve(root, safePath);
    if (destination !== root && !destination.startsWith(root + "/")) {
      throw new Error(`Project file path escapes its root: ${path}`);
    }
    return destination;
  }

  async openProject(root: string, entryFile?: string): Promise<ProjectConfig> {
    const absoluteRoot = resolve(root);
    const status = await fs.stat(absoluteRoot);
    if (!status.isDirectory())
      throw new Error(`Project root is not a directory: ${root}`);
    const metadataPath = join(
      absoluteRoot,
      PROJECT_METADATA_DIRECTORY,
      PROJECT_CONFIG_FILENAME,
    );
    const existing = await readJson<ProjectConfig>(metadataPath);
    const now = this.timestamp();
    const project: ProjectConfig = {
      version: 1,
      id: existing?.id ?? randomUUID(),
      name: existing?.name ?? basename(absoluteRoot),
      entryFile: projectPath(
        entryFile ??
          existing?.entryFile ??
          (await findLedgerEntry(absoluteRoot)),
      ),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      root: absoluteRoot,
    };
    await this.saveProject(project);
    return project;
  }

  async listProjects(): Promise<ProjectSummary[]> {
    const registry = await this.readRegistry();
    return registry.projects
      .map(({ id, name, entryFile, updatedAt }) => ({
        id,
        name,
        entryFile,
        updatedAt,
      }))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async saveProject(project: ProjectConfig): Promise<void> {
    if (!project.root)
      throw new Error("A filesystem project needs a root directory.");
    const config: RegistryProject = { ...project, root: resolve(project.root) };
    const metadataPath = join(
      config.root,
      PROJECT_METADATA_DIRECTORY,
      PROJECT_CONFIG_FILENAME,
    );
    await fs.mkdir(dirname(metadataPath), { recursive: true });
    await fs.writeFile(metadataPath, JSON.stringify(config, null, 2) + "\n");
    const registry = await this.readRegistry();
    registry.projects = [
      config,
      ...registry.projects.filter((item) => item.id !== config.id),
    ];
    await this.writeRegistry(registry);
  }

  async readProject(projectId: string): Promise<ProjectSnapshot> {
    const project = await this.registryProject(projectId);
    const files = await Promise.all(
      (await listFiles(project.root)).map(async (path) =>
        this.fileFor(project.root, path),
      ),
    );
    return {
      project,
      files,
      revisions: await Promise.all(
        files.map(async (file) => ({
          path: file.path,
          revision: revision(
            await fs.readFile(this.absolutePath(project.root, file.path)),
          ),
          updatedAt: file.updatedAt ?? project.updatedAt,
        })),
      ),
    };
  }

  private async fileFor(root: string, path: string): Promise<ProjectFile> {
    const destination = this.absolutePath(root, path);
    const stats = await fs.stat(destination);
    return {
      path: projectPath(path),
      contents: await fs.readFile(destination, "utf8"),
      mimeType: mimeTypeFor(path),
      updatedAt: stats.mtime.toISOString(),
      size: stats.size,
    };
  }

  async readFile(projectId: string, path: string): Promise<ProjectFile> {
    return this.fileFor((await this.registryProject(projectId)).root, path);
  }

  async writeFile(projectId: string, file: ProjectFile): Promise<FileRevision> {
    const project = await this.registryProject(projectId);
    const path = projectPath(file.path);
    const contents = new TextEncoder().encode(file.contents);
    const destination = this.absolutePath(project.root, path);
    await fs.mkdir(dirname(destination), { recursive: true });
    await fs.writeFile(destination, contents);
    const updatedAt = this.timestamp();
    await this.saveProject({ ...project, updatedAt });
    return { path, revision: revision(contents), updatedAt };
  }

  async listResources(projectId: string): Promise<ProjectResource[]> {
    const project = await this.registryProject(projectId);
    return Promise.all(
      (await listFiles(project.root)).map(async (path) => {
        const stats = await fs.stat(this.absolutePath(project.root, path));
        return {
          path,
          mimeType: mimeTypeFor(path),
          size: stats.size,
          updatedAt: stats.mtime.toISOString(),
        };
      }),
    );
  }

  async readResource(projectId: string, path: string): Promise<Uint8Array> {
    const project = await this.registryProject(projectId);
    return fs.readFile(this.absolutePath(project.root, path));
  }

  async readAiSession(
    projectId: string,
    sessionId: string,
  ): Promise<AiSessionRecord | null> {
    const project = await this.registryProject(projectId);
    return readJson<AiSessionRecord>(
      join(
        project.root,
        PROJECT_METADATA_DIRECTORY,
        "ai-sessions",
        `${sessionId}.json`,
      ),
    );
  }

  async writeAiSession(
    projectId: string,
    session: AiSessionRecord,
  ): Promise<void> {
    const project = await this.registryProject(projectId);
    if (session.projectId !== projectId) {
      throw new Error("Cannot write an AI session for a different project.");
    }
    const path = join(
      project.root,
      PROJECT_METADATA_DIRECTORY,
      "ai-sessions",
      `${session.sessionId}.json`,
    );
    await fs.mkdir(dirname(path), { recursive: true });
    await fs.writeFile(path, JSON.stringify(session, null, 2) + "\n");
  }
}
