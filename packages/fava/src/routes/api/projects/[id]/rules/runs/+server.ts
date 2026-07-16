import { json } from "@sveltejs/kit";
import { serverRules } from "$lib/server/rules";
import { serverWorkspace } from "$lib/server/workspace";

function message(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export async function GET({
  params,
  url,
}: {
  params: { id: string };
  url: URL;
}) {
  try {
    await (await serverWorkspace()).readProject(params.id);
    const limit = Number(url.searchParams.get("limit") ?? "10");
    const offset = Number(url.searchParams.get("offset") ?? "0");
    return json(
      await serverRules().listRuns(params.id, {
        limit: Number.isFinite(limit) ? limit : 10,
        offset: Number.isFinite(offset) ? offset : 0,
      }),
    );
  } catch (error) {
    return json({ error: message(error) }, { status: 400 });
  }
}
