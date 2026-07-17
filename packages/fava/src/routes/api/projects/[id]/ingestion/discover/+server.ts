import { json } from "@sveltejs/kit";
import { describeError } from "@beancount-js/beangulp";
import { discoverIngestionAccounts } from "@beancount-js/server";
import { serverIngestion } from "$lib/server/ingestion";
import { serverWorkspace } from "$lib/server/workspace";

export async function POST({
  params,
  request,
}: {
  params: { id: string };
  request: Request;
}) {
  try {
    const workspace = await serverWorkspace();
    await workspace.readProject(params.id);
    const body = await request.json();
    const {
      sourceId,
      baseUrl,
      secretRef,
      authScheme,
      allowedHosts,
      accountsPath,
    } = body as {
      sourceId?: unknown;
      baseUrl?: unknown;
      secretRef?: unknown;
      authScheme?: unknown;
      allowedHosts?: unknown;
      accountsPath?: unknown;
    };
    if (typeof sourceId === "string" && sourceId.trim()) {
      const accounts = await serverIngestion().discoverAccounts(
        params.id,
        sourceId.trim(),
      );
      return json({ accounts });
    }

    // Compatibility path for callers that have not moved to persisted sources.
    if (typeof baseUrl !== "string" || !baseUrl.trim()) {
      return json(
        { error: "A sourceId or baseUrl is required." },
        { status: 400 },
      );
    }
    if (typeof secretRef !== "string" || !secretRef.trim()) {
      return json(
        { error: "An API key (or env: reference) is required." },
        { status: 400 },
      );
    }
    const accounts = await discoverIngestionAccounts({
      baseUrl,
      secretRef,
      authScheme:
        authScheme === "x-api-key" || authScheme === "bearer"
          ? authScheme
          : undefined,
      allowedHosts: Array.isArray(allowedHosts)
        ? allowedHosts.filter(
            (host): host is string => typeof host === "string",
          )
        : undefined,
      accountsPath: typeof accountsPath === "string" ? accountsPath : undefined,
      projectRoot: await workspace.projectRoot(params.id),
    });
    return json({ accounts });
  } catch (error) {
    return json(
      { error: describeError(error) || "Discovery failed." },
      { status: 400 },
    );
  }
}
