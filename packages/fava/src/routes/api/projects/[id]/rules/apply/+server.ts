import { json } from "@sveltejs/kit";
import { applyDetectionRules, previewRuleApply } from "@beancount-js/server";
import { serverIngestion } from "$lib/server/ingestion";
import { serverRules } from "$lib/server/rules";
import { serverWorkspace } from "$lib/server/workspace";

function message(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export async function POST({
  params,
  request,
}: {
  params: { id: string };
  request: Request;
}) {
  try {
    await (await serverWorkspace()).readProject(params.id);
    const body = (await request.json().catch(() => ({}))) as {
      ruleIds?: unknown;
      dryRun?: unknown;
      target?: unknown;
    };
    const ruleIds = Array.isArray(body.ruleIds)
      ? body.ruleIds.filter((id): id is string => typeof id === "string")
      : undefined;
    if (
      body.target !== "pending-imports" &&
      body.target !== "live-ledger" &&
      body.target !== "both"
    ) {
      return json(
        {
          error:
            "Choose whether to run rules on pending imports, the live ledger, or both.",
        },
        { status: 400 },
      );
    }
    const target = body.target;
    const workspace = await serverWorkspace();
    const rulesStore = serverRules();
    const ingestionStore = serverIngestion();

    if (body.dryRun === true) {
      const preview = await previewRuleApply({
        projectId: params.id,
        ruleIds,
        target,
        rulesStore,
        ingestionStore,
        workspace,
      });
      return json({ preview });
    }

    const result = await applyDetectionRules({
      projectId: params.id,
      ruleIds,
      target,
      rulesStore,
      ingestionStore,
      workspace,
    });
    return json(result);
  } catch (error) {
    return json({ error: message(error) }, { status: 400 });
  }
}
