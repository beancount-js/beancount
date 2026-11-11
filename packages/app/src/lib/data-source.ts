import { BrowserWorkspaceAdapter } from "@beancount-js/web";
import type { BeancountDataSource } from "@beancount-js/ui/controller";
import type {
  ProjectConfig,
  ProjectSnapshot,
  ProjectSummary,
  WorkspaceAdapter,
} from "@beancount-js/workspace";

type Fetch = typeof globalThis.fetch;

function abort(signal?: AbortSignal) {
  signal?.throwIfAborted();
}

function projectPath(path: string) {
  return path.split("/").map(encodeURIComponent).join("/");
}

async function responseJson<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      (body as { error?: string }).error ||
        response.statusText ||
        `Request failed with status ${response.status}.`,
    );
  }
  return body as T;
}

export function createHttpBeancountDataSource(
  fetcher: Fetch = globalThis.fetch,
): BeancountDataSource {
  async function loadProject(id: string, signal?: AbortSignal) {
    return responseJson<ProjectSnapshot>(
      await fetcher(`/api/projects/${encodeURIComponent(id)}`, { signal }),
    );
  }

  return {
    async addProject(path, signal) {
      if (!path) return null;
      const project = await responseJson<ProjectConfig>(
        await fetcher("/api/projects", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ root: path }),
          signal,
        }),
      );
      return loadProject(project.id, signal);
    },
    async listProjects(signal) {
      return responseJson<ProjectSummary[]>(
        await fetcher("/api/projects", { signal }),
      );
    },
    loadProject,
    request: (url, init) => fetcher(url, init),
    async resourceUrl(projectId, path) {
      return {
        url: `/api/projects/${encodeURIComponent(projectId)}/resources/${projectPath(path)}`,
        mimeType: "application/octet-stream",
      };
    },
    async saveFile(projectId, path, contents, expectedRevision, signal) {
      await responseJson(
        await fetcher(
          `/api/projects/${encodeURIComponent(projectId)}/files/${projectPath(path)}`,
          {
            method: "PUT",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ contents, expectedRevision }),
            signal,
          },
        ),
      );
      return loadProject(projectId, signal);
    },
  };
}

export function createWorkspaceBeancountDataSource(
  workspace: WorkspaceAdapter,
  options: {
    addProject?: (
      path?: string,
      signal?: AbortSignal,
    ) => Promise<ProjectConfig | null>;
  } = {},
): BeancountDataSource {
  return {
    ...(options.addProject
      ? {
          async addProject(path?: string, signal?: AbortSignal) {
            abort(signal);
            const project = await options.addProject!(path, signal);
            abort(signal);
            return project ? workspace.readProject(project.id) : null;
          },
        }
      : {}),
    async listProjects(signal) {
      abort(signal);
      const projects = await workspace.listProjects();
      abort(signal);
      return projects;
    },
    async loadProject(id, signal) {
      abort(signal);
      const project = await workspace.readProject(id);
      abort(signal);
      return project;
    },
    async resourceUrl(projectId, path) {
      const resource = (await workspace.listResources(projectId)).find(
        (item) => item.path === path,
      );
      if (!resource) throw new Error(`Resource not found: ${path}`);
      const bytes = await workspace.readResource(projectId, path);
      const url = URL.createObjectURL(
        new Blob([bytes], { type: resource.mimeType }),
      );
      return {
        url,
        mimeType: resource.mimeType,
        revoke: () => URL.revokeObjectURL(url),
      };
    },
    async saveFile(projectId, path, contents, expectedRevision, signal) {
      abort(signal);
      await workspace.writeFile(
        projectId,
        { path, contents },
        expectedRevision ? { expectedRevision } : undefined,
      );
      abort(signal);
      return workspace.readProject(projectId);
    },
  };
}

export function createBrowserBeancountDataSource(
  workspace = new BrowserWorkspaceAdapter(),
): BeancountDataSource {
  const source = createWorkspaceBeancountDataSource(workspace, {
    async addProject() {
      if (!("showDirectoryPicker" in window)) {
        throw new Error("This browser does not support opening local folders.");
      }
      const handle = await (
        window as Window & {
          showDirectoryPicker(): Promise<FileSystemDirectoryHandle>;
        }
      ).showDirectoryPicker();
      return workspace.addDirectory(handle);
    },
  });
  return {
    ...source,
    async listProjects(signal) {
      let projects = await source.listProjects(signal);
      if (!projects.length) {
        await workspace.addOpfsProject();
        projects = await source.listProjects(signal);
      }
      return projects;
    },
  };
}
