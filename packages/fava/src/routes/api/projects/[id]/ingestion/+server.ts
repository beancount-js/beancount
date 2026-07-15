import { json } from "@sveltejs/kit";
import { loadProjectSources } from "@beancount-js/beancount";
import {
  categoryAccountsForSource,
  serverIngestion,
} from "$lib/server/ingestion";
import { serverWorkspace } from "$lib/server/workspace";

function message(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function credentialAvailable(reference: string | undefined) {
  if (!reference?.trim()) return false;
  if (!reference.startsWith("env:")) return true;
  const name = reference.slice("env:".length);
  return Boolean(name && process.env[name]);
}

export async function GET({ params }: { params: { id: string } }) {
  const snapshot = await (await serverWorkspace()).readProject(params.id);
  const [entries] = loadProjectSources(
    snapshot.project.entryFile,
    snapshot.ledgerFiles.map((file) => ({
      path: file.path,
      contents: file.contents,
    })),
  );
  const config = await serverIngestion().readConfig(params.id);
  return json({
    ...config,
    sources: config.sources.map((source) => ({
      ...source,
      credentialAvailable: credentialAvailable(source.api.secretRef),
      merchantCredentialAvailable:
        source.merchantEnrichment?.brandfetch?.enabled === true &&
        credentialAvailable(
          source.merchantEnrichment.brandfetch.apiKeySecretRef,
        ),
      allowedAccounts: categoryAccountsForSource(
        source,
        entries.flatMap((entry) => entry.accounts),
      ),
    })),
    accounts: [...new Set(entries.flatMap((entry) => entry.accounts))]
      .filter(Boolean)
      .sort(),
  });
}

export async function PUT({
  params,
  request,
}: {
  params: { id: string };
  request: Request;
}) {
  try {
    await (await serverWorkspace()).readProject(params.id);
    const config = await request.json();
    await serverIngestion().writeConfig(params.id, config);
    return json(await serverIngestion().readConfig(params.id));
  } catch (error) {
    return json({ error: message(error) }, { status: 400 });
  }
}
