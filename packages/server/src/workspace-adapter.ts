import { createHash, randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, extname, join, relative, resolve, sep } from "node:path";
import { DocumentDirective, IncludeDirective, parseDocument } from "@beancount-js/parser";
import type {
  AiSessionRecord,
  FileRevision,
  ProjectConfig,
  ProjectDiscoveryIssue,
  ProjectFile,
  ProjectResource,
  ProjectSnapshot,
  ProjectSummary,
  WorkspaceAdapter,
} from "@beancount-js/workspace";

const REGISTRY_FILENAME = "projects.json";
const LEDGER_EXTENSIONS = new Set([".bean", ".beancount", ".ledger"]);
const SKIPPED_DIRECTORIES = new Set([".git", "node_modules", ".beancount-js"]);

type RegistryProject = ProjectConfig & { root: string };
type Registry = { version: 1; projects: RegistryProject[] };

type Discovery = {
  ledgerPaths: string[];
  resourcePaths: string[];
  issues: ProjectDiscoveryIssue[];
};

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

function isLedgerPath(path: string) {
  return LEDGER_EXTENSIONS.has(extname(path).toLowerCase());
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
    } else if (entry.isFile()) {
      files.push(relative(root, join(directory, entry.name)).replaceAll("\\", "/"));
    }
  }
  return files;
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

function issue(
  kind: ProjectDiscoveryIssue["kind"],
  message: string,
  sourcePath?: string,
  referencedPath?: string,
): ProjectDiscoveryIssue {
  return { kind, message, sourcePath, referencedPath };
}

export async function findLedgerEntry(root: string) {
  const ledgers = (await listFiles(root)).filter(isLedgerPath);
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
  private readonly configDirectory: string;
  private readonly registryPath: string;
  private readonly now: () => Date;

  constructor(options: FilesystemWorkspaceOptions = {}) {
    this.configDirectory =
      options.configDirectory ??
      process.env.XDG_CONFIG_HOME ??
      join(homedir(), ".config", "beancount-js");
    this.registryPath = join(this.configDirectory, REGISTRY_FILENAME);
    this.now = options.now ?? (() => new Date());
  }

  private timestamp() {
    return this.now().toISOString();
  }

  private async readRegistry(): Promise<Registry> {
    return (await readJson<Registry>(this.registryPath)) ?? { version: 1, projects: [] };
  }

  private async writeRegistry(registry: Registry) {
    await fs.mkdir(dirname(this.registryPath), { recursive: true });
    await fs.writeFile(this.registryPath, JSON.stringify(registry, null, 2) + "\n");
  }

  private async registryProject(id: string) {
    const project = (await this.readRegistry()).projects.find((item) => item.id === id);
    if (!project) throw new Error(`Project not found: ${id}`);
    return project;
  }

  private async rootPath(root: string) {
    return fs.realpath(root);
  }

  /** Resolve a project file and reject path traversal and symlinks leaving the root. */
  private async absolutePath(root: string, path: string) {
    const realRoot = await this.rootPath(root);
    const safePath = projectPath(path);
    const destination = resolve(realRoot, safePath);
    if (destination !== realRoot && !destination.startsWith(realRoot + sep)) {
      throw new Error(`Project file path escapes its root: ${path}`);
    }
    const realDestination = await fs.realpath(destination);
    if (realDestination !== realRoot && !realDestination.startsWith(realRoot + sep)) {
      throw new Error(`Project file path escapes its root: ${path}`);
    }
    return realDestination;
  }

  private resolveReference(root: string, sourcePath: string, reference: string) {
    if (!reference || reference.includes("\0")) {
      throw new Error("Reference path is empty or invalid.");
    }
    const sourceDirectory = dirname(sourcePath);
    const candidate = resolve(root, sourceDirectory, reference);
    const relativePath = relative(root, candidate).replaceAll("\\", "/");
    return projectPath(relativePath);
  }

  private async discover(project: RegistryProject): Promise<Discovery> {
    const root = await this.rootPath(project.root);
    const issues: ProjectDiscoveryIssue[] = [];
    const ledgerPaths = new Set((await listFiles(root)).filter(isLedgerPath));
    ledgerPaths.add(projectPath(project.entryFile));
    const queue = [...ledgerPaths].sort();
    const seen = new Set<string>();
    const resourcePaths = new Set<string>();

    while (queue.length) {
      const path = queue.shift()!;
      if (seen.has(path)) continue;
      seen.add(path);

      let contents: string;
      try {
        contents = await fs.readFile(await this.absolutePath(root, path), "utf8");
      } catch (error) {
        issues.push(
          issue(
            path === project.entryFile ? "read-error" : "missing-include",
            `Unable to read Beancount source ${path}: ${error instanceof Error ? error.message : String(error)}`,
            path,
          ),
        );
        continue;
      }

      let parsed: ReturnType<typeof parseDocument>;
      try {
        parsed = parseDocument(contents, {
          filename: path,
          strict: false,
          bookingMethod: "DEFAULT",
          attributes: { filename: path },
        });
      } catch (error) {
        issues.push(
          issue(
            "read-error",
            `Unable to parse Beancount source ${path}: ${error instanceof Error ? error.message : String(error)}`,
            path,
          ),
        );
        continue;
      }

      for (const directive of parsed.directives) {
        if (!(directive instanceof IncludeDirective)) continue;
        const include = directive.value;
        let includePath: string;
        try {
          includePath = this.resolveReference(root, path, include);
          await this.absolutePath(root, includePath);
        } catch (error) {
          issues.push(
            issue(
              error instanceof Error && error.message.includes("escapes")
                ? "outside-root"
                : "missing-include",
              `Unable to include ${include}: ${error instanceof Error ? error.message : String(error)}`,
              path,
              include,
            ),
          );
          continue;
        }
        if (!ledgerPaths.has(includePath)) ledgerPaths.add(includePath);
        if (!seen.has(includePath)) queue.push(includePath);
      }

      for (const directive of parsed.directives) {
        if (!(directive instanceof DocumentDirective)) continue;
        const filename = directive.path;
        let resourcePath: string;
        try {
          resourcePath = this.resolveReference(root, path, filename);
          await this.absolutePath(root, resourcePath);
        } catch (error) {
          issues.push(
            issue(
              error instanceof Error && error.message.includes("escapes")
                ? "outside-root"
                : "missing-resource",
              `Unable to load document ${filename}: ${error instanceof Error ? error.message : String(error)}`,
              path,
              filename,
            ),
          );
          continue;
        }
        resourcePaths.add(resourcePath);
      }
    }

    return {
      ledgerPaths: [...ledgerPaths].sort(),
      resourcePaths: [...resourcePaths].sort(),
      issues,
    };
  }

  async openProject(root: string, entryFile?: string): Promise<ProjectConfig> {
    const absoluteRoot = await this.rootPath(resolve(root));
    const status = await fs.stat(absoluteRoot);
    if (!status.isDirectory()) throw new Error(`Project root is not a directory: ${root}`);

    const registry = await this.readRegistry();
    const existing = registry.projects.find((project) => project.root === absoluteRoot);
    const now = this.timestamp();
    const project: RegistryProject = {
      version: 1,
      id: existing?.id ?? randomUUID(),
      name: existing?.name ?? basename(absoluteRoot),
      entryFile: projectPath(entryFile ?? existing?.entryFile ?? (await findLedgerEntry(absoluteRoot))),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      root: absoluteRoot,
    };
    registry.projects = [project, ...registry.projects.filter((item) => item.id !== project.id)];
    await this.writeRegistry(registry);
    return project;
  }

  async listProjects(): Promise<ProjectSummary[]> {
    const registry = await this.readRegistry();
    return registry.projects
      .map(({ id, name, entryFile, updatedAt }) => ({ id, name, entryFile, updatedAt }))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async saveProject(project: ProjectConfig): Promise<void> {
    if (!project.root) throw new Error("A filesystem project needs a root directory.");
    const config: RegistryProject = { ...project, root: await this.rootPath(project.root) };
    const registry = await this.readRegistry();
    registry.projects = [config, ...registry.projects.filter((item) => item.id !== config.id)];
    await this.writeRegistry(registry);
  }

  async readProject(projectId: string): Promise<ProjectSnapshot> {
    const project = await this.registryProject(projectId);
    const discovery = await this.discover(project);
    const ledgerFiles = await Promise.all(
      discovery.ledgerPaths.map(async (path) => this.fileFor(project.root, path)),
    );
    const resources = await Promise.all(
      discovery.resourcePaths.map(async (path) => this.resourceFor(project.root, path)),
    );
    return {
      project,
      ledgerFiles,
      resources,
      revisions: await Promise.all(
        ledgerFiles.map(async (file) => ({
          path: file.path,
          revision: revision(await fs.readFile(await this.absolutePath(project.root, file.path))),
          updatedAt: file.updatedAt ?? project.updatedAt,
        })),
      ),
      issues: discovery.issues,
    };
  }

  private async fileFor(root: string, path: string): Promise<ProjectFile> {
    const destination = await this.absolutePath(root, path);
    const stats = await fs.stat(destination);
    return {
      path: projectPath(path),
      contents: await fs.readFile(destination, "utf8"),
      mimeType: mimeTypeFor(path),
      updatedAt: stats.mtime.toISOString(),
      size: stats.size,
    };
  }

  private async resourceFor(root: string, path: string): Promise<ProjectResource> {
    const stats = await fs.stat(await this.absolutePath(root, path));
    return {
      path: projectPath(path),
      mimeType: mimeTypeFor(path),
      size: stats.size,
      updatedAt: stats.mtime.toISOString(),
    };
  }

  private async allowedDiscovery(project: RegistryProject) {
    return this.discover(project);
  }

  async readFile(projectId: string, path: string): Promise<ProjectFile> {
    const project = await this.registryProject(projectId);
    const safePath = projectPath(path);
    const discovery = await this.allowedDiscovery(project);
    if (!discovery.ledgerPaths.includes(safePath)) throw new Error(`Ledger file not found: ${path}`);
    return this.fileFor(project.root, safePath);
  }

  async writeFile(projectId: string, file: ProjectFile): Promise<FileRevision> {
    const project = await this.registryProject(projectId);
    const path = projectPath(file.path);
    const discovery = await this.allowedDiscovery(project);
    if (!discovery.ledgerPaths.includes(path)) throw new Error(`Ledger file not found: ${path}`);
    const contents = new TextEncoder().encode(file.contents);
    await fs.writeFile(await this.absolutePath(project.root, path), contents);
    const updatedAt = this.timestamp();
    await this.saveProject({ ...project, updatedAt });
    return { path, revision: revision(contents), updatedAt };
  }

  async listResources(projectId: string): Promise<ProjectResource[]> {
    return (await this.readProject(projectId)).resources;
  }

  async readResource(projectId: string, path: string): Promise<Uint8Array> {
    const project = await this.registryProject(projectId);
    const safePath = projectPath(path);
    const discovery = await this.allowedDiscovery(project);
    if (!discovery.resourcePaths.includes(safePath)) throw new Error(`Resource not found: ${path}`);
    return fs.readFile(await this.absolutePath(project.root, safePath));
  }

  private sessionPath(projectId: string, sessionId: string) {
    if (!/^[a-zA-Z0-9_-]+$/.test(sessionId)) throw new Error("Invalid AI session identifier.");
    return join(this.configDirectory, "projects", projectId, "ai-sessions", `${sessionId}.json`);
  }

  async readAiSession(projectId: string, sessionId: string): Promise<AiSessionRecord | null> {
    await this.registryProject(projectId);
    return readJson<AiSessionRecord>(this.sessionPath(projectId, sessionId));
  }

  async writeAiSession(projectId: string, session: AiSessionRecord): Promise<void> {
    await this.registryProject(projectId);
    if (session.projectId !== projectId) {
      throw new Error("Cannot write an AI session for a different project.");
    }
    const path = this.sessionPath(projectId, session.sessionId);
    await fs.mkdir(dirname(path), { recursive: true });
    await fs.writeFile(path, JSON.stringify(session, null, 2) + "\n");
  }
}
