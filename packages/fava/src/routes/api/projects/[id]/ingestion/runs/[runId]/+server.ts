import { json } from "@sveltejs/kit";
import { loadProjectSources } from "@beancount-js/beancount";
import type { NormalizedTransactionPatch } from "@beancount-js/beangulp";
import {
  categoryAccountsForSource,
  serverIngestion,
} from "$lib/server/ingestion";
import { serverWorkspace } from "$lib/server/workspace";

function message(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function asStringArray(value: unknown) {
  if (!Array.isArray(value)) return undefined;
  if (!value.every((item) => typeof item === "string")) return undefined;
  return value as string[];
}

function asMetadata(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    return undefined;
  const metadata: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (typeof entry !== "string") return undefined;
    metadata[key] = entry;
  }
  return metadata;
}

function parseTransactionPatch(value: unknown): NormalizedTransactionPatch | undefined {
  if (value === undefined) return undefined;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("transaction must be an object.");
  }
  const body = value as Record<string, unknown>;
  const patch: NormalizedTransactionPatch = {};
  if (body.bookedAt !== undefined) {
    if (typeof body.bookedAt !== "string") throw new Error("bookedAt must be a string.");
    patch.bookedAt = body.bookedAt;
  }
  if (body.amount !== undefined) {
    if (typeof body.amount !== "string") throw new Error("amount must be a string.");
    patch.amount = body.amount;
  }
  if (body.currency !== undefined) {
    if (typeof body.currency !== "string") throw new Error("currency must be a string.");
    patch.currency = body.currency;
  }
  if (body.merchant !== undefined) {
    if (typeof body.merchant !== "string") throw new Error("merchant must be a string.");
    patch.merchant = body.merchant;
  }
  if (body.payee !== undefined) {
    if (typeof body.payee !== "string") throw new Error("payee must be a string.");
    patch.payee = body.payee;
  }
  if (body.narration !== undefined) {
    if (typeof body.narration !== "string") throw new Error("narration must be a string.");
    patch.narration = body.narration;
  }
  if (body.tags !== undefined) {
    const tags = asStringArray(body.tags);
    if (!tags) throw new Error("tags must be an array of strings.");
    patch.tags = tags;
  }
  if (body.links !== undefined) {
    const links = asStringArray(body.links);
    if (!links) throw new Error("links must be an array of strings.");
    patch.links = links;
  }
  if (body.metadata !== undefined) {
    const metadata = asMetadata(body.metadata);
    if (!metadata) throw new Error("metadata must be a string map.");
    patch.metadata = metadata;
  }
  return patch;
}

export async function GET({
  params,
}: {
  params: { id: string; runId: string };
}) {
  try {
    return json(await serverIngestion().run(params.id, params.runId));
  } catch (error) {
    return json({ error: message(error) }, { status: 404 });
  }
}

export async function PATCH({
  params,
  request,
}: {
  params: { id: string; runId: string };
  request: Request;
}) {
  try {
    const body = await request.json();
    const proposalId = body.proposalId;
    if (typeof proposalId !== "string") {
      return json({ error: "proposalId is required." }, { status: 400 });
    }
    const account =
      typeof body.account === "string" ? body.account : undefined;
    const transaction = parseTransactionPatch(body.transaction);
    if (!account && !transaction) {
      return json(
        { error: "Provide account and/or transaction fields to update." },
        { status: 400 },
      );
    }

    if (account) {
      const snapshot = await (await serverWorkspace()).readProject(params.id);
      const [entries] = loadProjectSources(
        snapshot.project.entryFile,
        snapshot.ledgerFiles.map((file) => ({
          path: file.path,
          contents: file.contents,
        })),
      );
      const run = await serverIngestion().run(params.id, params.runId);
      const source = await serverIngestion().sourceForRunSourceId(
        params.id,
        run.sourceId,
      );
      if (
        !categoryAccountsForSource(
          source,
          entries.flatMap((entry) => entry.accounts),
        ).includes(account)
      ) {
        return json(
          {
            error:
              "Choose an account allowed by this source's category scope.",
          },
          { status: 400 },
        );
      }
    }

    return json(
      await serverIngestion().patchProposal(
        params.id,
        params.runId,
        proposalId,
        { account, transaction },
      ),
    );
  } catch (error) {
    return json({ error: message(error) }, { status: 400 });
  }
}
