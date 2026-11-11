import { serverWorkspace } from "$lib/server/workspace";

export async function GET({
  params,
}: {
  params: { id: string; path: string };
}) {
  const workspace = await serverWorkspace();
  const resource = (await workspace.listResources(params.id)).find(
    (item) => item.path === params.path,
  );
  if (!resource) return new Response("Resource not found", { status: 404 });
  const bytes = await workspace.readResource(params.id, params.path);
  return new Response(bytes, {
    headers: {
      "content-type": resource.mimeType,
      "content-length": String(resource.size),
      "content-disposition": `inline; filename="${params.path.split("/").at(-1)}"`,
    },
  });
}
