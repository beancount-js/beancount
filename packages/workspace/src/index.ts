/** Shared project and storage contracts for server and static-web runtimes. */

export type BeancountStudioRuntime = "server" | "web";

export interface RuntimeCapabilities {
  runtime: BeancountStudioRuntime;
  ai: boolean;
  localDirectoryAccess: boolean;
  opfsStorage: boolean;
}

export const serverRuntimeCapabilities: RuntimeCapabilities = {
  runtime: "server",
  ai: true,
  localDirectoryAccess: false,
  opfsStorage: false,
};

export const webRuntimeCapabilities: RuntimeCapabilities = {
  runtime: "web",
  ai: false,
  localDirectoryAccess: true,
  opfsStorage: true,
};

export interface ProjectSummary {
  id: string;
  name: string;
  entryFile: string;
  updatedAt: string;
}

export interface ProjectConfig extends ProjectSummary {
  version: 1;
  root?: string;
  createdAt: string;
}

export interface ProjectFile {
  path: string;
  contents: string;
  mimeType?: string;
  updatedAt?: string;
  size?: number;
}

export interface ProjectResource {
  path: string;
  mimeType: string;
  size: number;
  updatedAt?: string;
}

export interface FileRevision {
  path: string;
  revision: string;
  updatedAt: string;
}

export interface ProjectSnapshot {
  project: ProjectConfig;
  files: ProjectFile[];
  revisions: FileRevision[];
}

export interface AiSessionRecord<TSession = unknown> {
  projectId: string;
  sessionId: string;
  session: TSession;
  updatedAt: string;
}

export interface WorkspaceAdapter<TSession = unknown> {
  listProjects(): Promise<ProjectSummary[]>;
  readProject(projectId: string): Promise<ProjectSnapshot>;
  saveProject(project: ProjectConfig): Promise<void>;
  readFile(projectId: string, path: string): Promise<ProjectFile>;
  writeFile(projectId: string, file: ProjectFile): Promise<FileRevision>;
  listResources(projectId: string): Promise<ProjectResource[]>;
  readResource(projectId: string, path: string): Promise<Uint8Array>;
  readAiSession(
    projectId: string,
    sessionId: string,
  ): Promise<AiSessionRecord<TSession> | null>;
  writeAiSession(
    projectId: string,
    session: AiSessionRecord<TSession>,
  ): Promise<void>;
}
