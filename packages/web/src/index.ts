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

type BrowserProject = {
  config: ProjectConfig;
  handle?: FileSystemDirectoryHandle;
  files: Map<string, ProjectFile>;
  sessions: Map<string, AiSessionRecord>;
};

function now() {
  return new Date().toISOString();
}

function identifier() {
  return crypto.randomUUID();
}

function safePath(path: string) {
  if (
    !path ||
    path.startsWith("/") ||
    path.split("/").some((part) => !part || part === "." || part === "..")
  ) {
    throw new Error(`Project file path escapes its root: ${path}`);
  }
  return path;
}

function mimeTypeFor(path: string) {
  const extension = path.slice(path.lastIndexOf(".")).toLowerCase();
  return (
    (
      {
        ".bean": "text/plain; charset=utf-8",
        ".beancount": "text/plain; charset=utf-8",
        ".ledger": "text/plain; charset=utf-8",
        ".md": "text/markdown; charset=utf-8",
        ".json": "application/json",
        ".yaml": "application/yaml",
        ".yml": "application/yaml",
        ".csv": "text/csv; charset=utf-8",
        ".pdf": "application/pdf",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
      } as Record<string, string>
    )[extension] ?? "application/octet-stream"
  );
}

async function filesFromDirectory(
  handle: FileSystemDirectoryHandle,
  prefix = "",
): Promise<ProjectFile[]> {
  const files: ProjectFile[] = [];
  const entries = (
    handle as unknown as {
      values(): AsyncIterable<FileSystemHandle>;
    }
  ).values();
  for await (const entry of entries) {
    if (entry.name === ".beancount-js") continue;
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.kind === "directory") {
      files.push(
        ...(await filesFromDirectory(entry as FileSystemDirectoryHandle, path)),
      );
    } else {
      const file = await (entry as FileSystemFileHandle).getFile();
      files.push({
        path,
        contents: await file.text(),
        mimeType: file.type || mimeTypeFor(path),
        updatedAt: new Date(file.lastModified).toISOString(),
        size: file.size,
      });
    }
  }
  return files.sort((a, b) => a.path.localeCompare(b.path));
}

async function fileHandleFor(
  root: FileSystemDirectoryHandle,
  path: string,
  create = false,
) {
  const parts = safePath(path).split("/");
  const name = parts.pop()!;
  let directory = root;
  for (const part of parts) {
    directory = await directory.getDirectoryHandle(part, { create });
  }
  return directory.getFileHandle(name, { create });
}

/**
 * A browser workspace can keep several directory handles open at once. When a
 * directory is not available, callers can seed an in-memory project from OPFS
 * or an imported file set; the interface remains identical to the server.
 */
export class BrowserWorkspaceAdapter implements WorkspaceAdapter {
  private readonly projects = new Map<string, BrowserProject>();

  async addDirectory(handle: FileSystemDirectoryHandle, entryFile?: string) {
    const files = await filesFromDirectory(handle);
    const entry =
      entryFile ??
      files.find((file) => /^main\.(bean|beancount|ledger)$/i.test(file.path))
        ?.path ??
      files.find((file) => /\.(bean|beancount|ledger)$/i.test(file.path))?.path;
    if (!entry)
      throw new Error("No Beancount entry file was found in this directory.");
    const timestamp = now();
    const config: ProjectConfig = {
      version: 1,
      id: identifier(),
      name: handle.name,
      entryFile: entry,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    this.projects.set(config.id, {
      config,
      handle,
      files: new Map(files.map((file) => [file.path, file])),
      sessions: new Map(),
    });
    return config;
  }

  async addOpfsProject(name = "Browser workspace") {
    if (!navigator.storage?.getDirectory) {
      throw new Error("This browser does not support OPFS storage.");
    }
    const root = await navigator.storage.getDirectory();
    const handle = await root.getDirectoryHandle("beancount-studio", {
      create: true,
    });
    const ledger = await handle.getFileHandle("main.beancount", {
      create: true,
    });
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

  async listProjects(): Promise<ProjectSummary[]> {
    return [...this.projects.values()]
      .map(({ config }) => ({
        id: config.id,
        name: config.name,
        entryFile: config.entryFile,
        updatedAt: config.updatedAt,
      }))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async readProject(projectId: string): Promise<ProjectSnapshot> {
    const project = this.project(projectId);
    const files = [...project.files.values()].sort((a, b) =>
      a.path.localeCompare(b.path),
    );
    return {
      project: project.config,
      files,
      revisions: files.map((file) => ({
        path: file.path,
        revision: `${file.size}:${file.updatedAt}`,
        updatedAt: file.updatedAt ?? project.config.updatedAt,
      })),
    };
  }

  async saveProject(config: ProjectConfig) {
    const project = this.project(config.id);
    project.config = config;
  }

  async readFile(projectId: string, path: string) {
    const file = this.project(projectId).files.get(safePath(path));
    if (!file) throw new Error(`Project file not found: ${path}`);
    return file;
  }

  async writeFile(projectId: string, file: ProjectFile): Promise<FileRevision> {
    const project = this.project(projectId);
    const path = safePath(file.path);
    const updatedAt = now();
    const next = {
      ...file,
      path,
      updatedAt,
      size: new TextEncoder().encode(file.contents).length,
    };
    project.files.set(path, next);
    project.config = { ...project.config, updatedAt };
    if (project.handle) {
      const handle = await fileHandleFor(project.handle, path, true);
      const writable = await handle.createWritable();
      await writable.write(file.contents);
      await writable.close();
    }
    return { path, revision: `${next.size}:${updatedAt}`, updatedAt };
  }

  async listResources(projectId: string): Promise<ProjectResource[]> {
    return [...this.project(projectId).files.values()].map((file) => ({
      path: file.path,
      mimeType: file.mimeType ?? mimeTypeFor(file.path),
      size: file.size ?? new TextEncoder().encode(file.contents).length,
      updatedAt: file.updatedAt,
    }));
  }

  async readResource(projectId: string, path: string): Promise<Uint8Array> {
    const project = this.project(projectId);
    if (project.handle) {
      const file = await (await fileHandleFor(project.handle, path)).getFile();
      return new Uint8Array(await file.arrayBuffer());
    }
    return new TextEncoder().encode(
      (await this.readFile(projectId, path)).contents,
    );
  }

  async readAiSession(projectId: string, sessionId: string) {
    return this.project(projectId).sessions.get(sessionId) ?? null;
  }

  async writeAiSession(projectId: string, session: AiSessionRecord) {
    if (session.projectId !== projectId)
      throw new Error("Cannot write a session for another project.");
    this.project(projectId).sessions.set(session.sessionId, session);
  }
}
