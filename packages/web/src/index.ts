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
  WriteFileOptions,
} from "@beancount-js/workspace";
import {
  createProjectId,
  projectIdIndexFromProjects,
} from "@beancount-js/workspace";

type BrowserProject = {
  config: ProjectConfig;
  handle?: FileSystemDirectoryHandle;
  files: Map<string, ProjectFile>;
  sessions: Map<string, AiSessionRecord>;
};

type Discovery = {
  ledgerPaths: string[];
  resourcePaths: string[];
  issues: ProjectDiscoveryIssue[];
};

const LEDGER = /\.(bean|beancount|ledger)$/i;
const REGISTRY_KEY = "beancount-studio:browser-projects";

function now() {
  return new Date().toISOString();
}

function safePath(path: string) {
  if (!path || path.startsWith("/") || path.split("/").some((part) => !part || part === "." || part === "..")) {
    throw new Error(`Project file path escapes its root: ${path}`);
  }
  return path;
}

function resolveReference(sourcePath: string, reference: string) {
  if (!reference || reference.startsWith("/") || reference.includes("\\")) {
    throw new Error(`Project file path escapes its root: ${reference}`);
  }
  const parts = sourcePath.split("/").slice(0, -1);
  for (const part of reference.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") {
      if (!parts.length) throw new Error(`Project file path escapes its root: ${reference}`);
      parts.pop();
    } else {
      parts.push(part);
    }
  }
  return safePath(parts.join("/"));
}

function mimeTypeFor(path: string) {
  const extension = path.slice(path.lastIndexOf(".")).toLowerCase();
  return (
    ({
      ".bean": "text/plain; charset=utf-8",
      ".beancount": "text/plain; charset=utf-8",
      ".ledger": "text/plain; charset=utf-8",
      ".txt": "text/plain; charset=utf-8",
      ".md": "text/markdown; charset=utf-8",
      ".json": "application/json",
      ".yaml": "application/yaml",
      ".yml": "application/yaml",
      ".csv": "text/csv; charset=utf-8",
      ".pdf": "application/pdf",
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".gif": "image/gif",
      ".svg": "image/svg+xml",
    } as Record<string, string>)[extension] ?? "application/octet-stream"
  );
}

async function fileHandleFor(root: FileSystemDirectoryHandle, path: string, create = false) {
  const parts = safePath(path).split("/");
  const name = parts.pop()!;
  let directory = root;
  for (const part of parts) directory = await directory.getDirectoryHandle(part, { create });
  return directory.getFileHandle(name, { create });
}

async function ledgerFilesFromDirectory(handle: FileSystemDirectoryHandle, prefix = ""): Promise<ProjectFile[]> {
  const result: ProjectFile[] = [];
  const entries = (handle as unknown as { values(): AsyncIterable<FileSystemHandle> }).values();
  for await (const entry of entries) {
    if (
      entry.name === ".beancount" ||
      entry.name === ".beancount-js" ||
      entry.name === ".git" ||
      entry.name === "node_modules"
    ) {
      continue;
    }
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.kind === "directory") {
      result.push(...(await ledgerFilesFromDirectory(entry as FileSystemDirectoryHandle, path)));
    } else if (LEDGER.test(path)) {
      const file = await (entry as FileSystemFileHandle).getFile();
      result.push({
        path,
        contents: await file.text(),
        mimeType: file.type || mimeTypeFor(path),
        updatedAt: new Date(file.lastModified).toISOString(),
        size: file.size,
      });
    }
  }
  return result.sort((a, b) => a.path.localeCompare(b.path));
}

function issue(kind: ProjectDiscoveryIssue["kind"], message: string, sourcePath?: string, referencedPath?: string) {
  return { kind, message, sourcePath, referencedPath } satisfies ProjectDiscoveryIssue;
}

export class BrowserWorkspaceAdapter implements WorkspaceAdapter {
  private readonly projects = new Map<string, BrowserProject>();

  private persistRegistry() {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(
      REGISTRY_KEY,
      JSON.stringify([...this.projects.values()].map(({ config }) => config)),
    );
  }

  async addDirectory(handle: FileSystemDirectoryHandle, entryFile?: string) {
    const files = await ledgerFilesFromDirectory(handle);
    const entry =
      entryFile ??
      files.find((file) => /^main\.(bean|beancount|ledger)$/i.test(file.path))?.path ??
      files.find((file) => !file.path.includes("/"))?.path ??
      files[0]?.path;
    if (!entry) throw new Error("No Beancount entry file was found in this directory.");
    const timestamp = now();
    const rootKey = handle.name;
    const existing = [...this.projects.values()].find(
      (project) => project.handle?.name === rootKey,
    );
    const index = projectIdIndexFromProjects(
      [...this.projects.values()].map((project) => ({
        id: project.config.id,
        rootKey: project.handle?.name ?? project.config.id,
      })),
    );
    const config: ProjectConfig = {
      version: 1,
      id: existing?.config.id ?? createProjectId(index, rootKey),
      name: handle.name,
      entryFile: entry,
      createdAt: existing?.config.createdAt ?? timestamp,
      updatedAt: timestamp,
    };
    this.projects.set(config.id, {
      config,
      handle,
      files: new Map(files.map((file) => [file.path, file])),
      sessions: existing?.sessions ?? new Map(),
    });
    this.persistRegistry();
    return config;
  }

  async addOpfsProject(name = "Browser workspace") {
    if (!navigator.storage?.getDirectory) throw new Error("This browser does not support OPFS storage.");
    const root = await navigator.storage.getDirectory();
    const handle = await root.getDirectoryHandle("beancount-studio", { create: true });
    const ledger = await handle.getFileHandle("main.beancount", { create: true });
    const existing = await ledger.getFile();
    if (!existing.size) {
      const writable = await ledger.createWritable();
      await writable.write("2024-01-01 open Assets:Cash\n");
      await writable.close();
    }
    const project = await this.addDirectory(handle, "main.beancount");
    project.name = name;
    await this.saveProject(project);
    return project;
  }

  private project(id: string) {
    const project = this.projects.get(id);
    if (!project) throw new Error(`Project not found: ${id}`);
    return project;
  }

  private async sourceFor(project: BrowserProject, path: string) {
    const cached = project.files.get(path);
    if (cached) return cached;
    if (!project.handle) throw new Error(`Ledger file not found: ${path}`);
    const file = await (await fileHandleFor(project.handle, path)).getFile();
    const source: ProjectFile = {
      path,
      contents: await file.text(),
      mimeType: file.type || mimeTypeFor(path),
      updatedAt: new Date(file.lastModified).toISOString(),
      size: file.size,
    };
    project.files.set(path, source);
    return source;
  }

  private async discover(project: BrowserProject): Promise<Discovery> {
    const ledgerPaths = new Set(project.files.keys());
    ledgerPaths.add(project.config.entryFile);
    const queue = [...ledgerPaths].sort();
    const seen = new Set<string>();
    const resources = new Set<string>();
    const issues: ProjectDiscoveryIssue[] = [];

    while (queue.length) {
      const path = queue.shift()!;
      if (seen.has(path)) continue;
      seen.add(path);
      let source: ProjectFile;
      try {
        source = await this.sourceFor(project, path);
      } catch (error) {
        issues.push(issue(path === project.config.entryFile ? "read-error" : "missing-include", `Unable to read Beancount source ${path}: ${String(error)}`, path));
        continue;
      }
      const document = parseDocument(source.contents, { strict: false, filename: path, bookingMethod: "DEFAULT", attributes: { filename: path } });
      for (const directive of document.directives) {
        if (directive instanceof IncludeDirective) {
          try {
            const includePath = resolveReference(path, directive.value);
            await this.sourceFor(project, includePath);
            if (!ledgerPaths.has(includePath)) ledgerPaths.add(includePath);
            if (!seen.has(includePath)) queue.push(includePath);
          } catch (error) {
            issues.push(issue(String(error).includes("escapes") ? "outside-root" : "missing-include", `Unable to include ${directive.value}: ${String(error)}`, path, directive.value));
          }
        }
        if (directive instanceof DocumentDirective) {
          try {
            const resourcePath = resolveReference(path, directive.path);
            if (project.handle) await fileHandleFor(project.handle, resourcePath);
            resources.add(resourcePath);
          } catch (error) {
            issues.push(issue(String(error).includes("escapes") ? "outside-root" : "missing-resource", `Unable to load document ${directive.path}: ${String(error)}`, path, directive.path));
          }
        }
      }
    }
    return { ledgerPaths: [...ledgerPaths].sort(), resourcePaths: [...resources].sort(), issues };
  }

  async listProjects(): Promise<ProjectSummary[]> {
    return [...this.projects.values()]
      .map(({ config }) => ({ id: config.id, name: config.name, entryFile: config.entryFile, updatedAt: config.updatedAt }))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async readProject(projectId: string): Promise<ProjectSnapshot> {
    const project = this.project(projectId);
    const discovery = await this.discover(project);
    const ledgerFiles = await Promise.all(discovery.ledgerPaths.map((path) => this.sourceFor(project, path)));
    const resources = await Promise.all(
      discovery.resourcePaths.map(async (path) => {
        const file = project.handle
          ? await (await fileHandleFor(project.handle, path)).getFile()
          : undefined;
        return {
          path,
          mimeType: file?.type || mimeTypeFor(path),
          size: file?.size ?? 0,
          updatedAt: file ? new Date(file.lastModified).toISOString() : project.config.updatedAt,
        };
      }),
    );
    return {
      project: project.config,
      ledgerFiles,
      resources,
      revisions: ledgerFiles.map((file) => ({ path: file.path, revision: `${file.size}:${file.updatedAt}`, updatedAt: file.updatedAt ?? project.config.updatedAt })),
      issues: discovery.issues,
    };
  }

  async saveProject(config: ProjectConfig) {
    const project = this.project(config.id);
    project.config = config;
    this.persistRegistry();
  }

  async readFile(projectId: string, path: string) {
    const project = this.project(projectId);
    const safe = safePath(path);
    if (!(await this.discover(project)).ledgerPaths.includes(safe)) throw new Error(`Ledger file not found: ${path}`);
    return this.sourceFor(project, safe);
  }

  async writeFile(
    projectId: string,
    file: ProjectFile,
    options: WriteFileOptions = {},
  ): Promise<FileRevision> {
    const project = this.project(projectId);
    const path = safePath(file.path);
    if (!(await this.discover(project)).ledgerPaths.includes(path)) throw new Error(`Ledger file not found: ${path}`);
    const previous = await this.sourceFor(project, path);
    const currentRevision = `${previous.size}:${previous.updatedAt}`;
    if (options.expectedRevision && options.expectedRevision !== currentRevision) {
      throw new Error(`File changed since it was read: ${path}`);
    }
    const updatedAt = now();
    const next = { ...file, path, updatedAt, size: new TextEncoder().encode(file.contents).length };
    project.files.set(path, next);
    project.config = { ...project.config, updatedAt };
    if (project.handle) {
      const writable = await (await fileHandleFor(project.handle, path)).createWritable();
      await writable.write(file.contents);
      await writable.close();
    }
    this.persistRegistry();
    return { path, revision: `${next.size}:${updatedAt}`, updatedAt };
  }

  async listResources(projectId: string): Promise<ProjectResource[]> {
    return (await this.readProject(projectId)).resources;
  }

  async readResource(projectId: string, path: string): Promise<Uint8Array> {
    const project = this.project(projectId);
    const safe = safePath(path);
    if (!(await this.discover(project)).resourcePaths.includes(safe)) throw new Error(`Resource not found: ${path}`);
    if (!project.handle) throw new Error(`Resource not available: ${path}`);
    return new Uint8Array(await (await (await fileHandleFor(project.handle, safe)).getFile()).arrayBuffer());
  }

  async readAiSession(projectId: string, sessionId: string) {
    return this.project(projectId).sessions.get(sessionId) ?? null;
  }

  async writeAiSession(projectId: string, session: AiSessionRecord) {
    if (session.projectId !== projectId) throw new Error("Cannot write a session for another project.");
    this.project(projectId).sessions.set(session.sessionId, session);
  }
}
