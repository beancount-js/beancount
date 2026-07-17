import { json } from "@sveltejs/kit";
import { fuzzySearchPaths } from "$lib/fuzzy-search";
import { serverWorkspace } from "$lib/server/workspace";

export async function GET({
  params,
  url,
}: {
  params: { id: string };
  url: URL;
}) {
  try {
    const query = url.searchParams.get("query") ?? "";
    const snapshot = await (await serverWorkspace()).readProject(params.id);
    const files = fuzzySearchPaths(snapshot.ledgerFiles, query, 20).map(
      (file) => ({ path: file.path }),
    );
    return json({ files });
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 400 },
    );
  }
}
