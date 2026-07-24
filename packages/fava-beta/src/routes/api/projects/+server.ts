import { json } from "@sveltejs/kit";
import { serverWorkspace } from "$lib/server/workspace";

export async function GET() {
  return json(await (await serverWorkspace()).listProjects());
}

export async function POST({ request }: { request: Request }) {
  const { root, entryFile } = await request.json();
  const project = await (await serverWorkspace()).openProject(root, entryFile);
  return json(project, { status: 201 });
}
