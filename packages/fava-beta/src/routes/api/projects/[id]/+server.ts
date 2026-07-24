import { json } from "@sveltejs/kit";
import { serverWorkspace } from "$lib/server/workspace";

export async function GET({ params }: { params: { id: string } }) {
  return json(await (await serverWorkspace()).readProject(params.id));
}
