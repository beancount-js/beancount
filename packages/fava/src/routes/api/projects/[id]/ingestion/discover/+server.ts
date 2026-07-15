import { json } from "@sveltejs/kit";
import { describeError } from "@beancount-js/beangulp";
import { discoverIngestionAccounts } from "@beancount-js/server";
import { serverWorkspace } from "$lib/server/workspace";

export async function POST({
  params,
  request,
}: {
  params: { id: string };
  request: Request;
}) {
  try {
    await (await serverWorkspace()).readProject(params.id);
    const body = await request.json();
    const {
      baseUrl,
      secretRef,
      authScheme,
      allowedHosts,
      accountsPath,
    } = body as {
      baseUrl?: unknown;
      secretRef?: unknown;
      authScheme?: unknown;
      allowedHosts?: unknown;
      accountsPath?: unknown;
    };
    if (typeof baseUrl !== "string" || !baseUrl.trim()) {
      return json({ error: "A baseUrl is required." }, { status: 400 });
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
        ? allowedHosts.filter((host): host is string => typeof host === "string")
        : undefined,
      accountsPath:
        typeof accountsPath === "string" ? accountsPath : undefined,
    });
    return json({ accounts });
  } catch (error) {
    return json(
      { error: describeError(error) || "Discovery failed." },
      { status: 400 },
    );
  }
}
