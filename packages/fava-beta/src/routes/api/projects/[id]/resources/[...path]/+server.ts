import { serverWorkspace } from "$lib/server/workspace";

export async function GET({
  params,
}: {
  params: { id: string; path: string };
}) {
  const workspace = await serverWorkspace();
  const resources = await workspace.listResources(params.id);
  const resource = resources.find((item) => item.path === params.path);
  if (!resource) return new Response("Resource not found", { status: 404 });
  const bytes = await workspace.readResource(params.id, params.path);
  const body = new Uint8Array(bytes.byteLength);
  body.set(bytes);
  return new Response(body.buffer, {
    headers: {
      "content-type": resource.mimeType,
      "content-length": String(resource.size),
      "content-disposition": `inline; filename="${params.path.split("/").at(-1)}"`,
    },
  });
}
