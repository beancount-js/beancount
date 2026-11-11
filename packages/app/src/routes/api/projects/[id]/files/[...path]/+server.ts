import { json } from "@sveltejs/kit";
import { serverWorkspace } from "$lib/server/workspace";

export async function PUT({
  params,
  request,
}: {
  params: { id: string; path: string };
  request: Request;
}) {
  const { contents, expectedRevision } = await request.json();
  return json(
    await (
      await serverWorkspace()
    ).writeFile(
      params.id,
      { path: params.path, contents },
      typeof expectedRevision === "string" ? { expectedRevision } : undefined,
    ),
  );
}
