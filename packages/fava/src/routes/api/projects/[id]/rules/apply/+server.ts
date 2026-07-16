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
    };
    const ruleIds = Array.isArray(body.ruleIds)
      ? body.ruleIds.filter((id): id is string => typeof id === "string")
      : undefined;
    const workspace = await serverWorkspace();
    const rulesStore = serverRules();
    const ingestionStore = serverIngestion();

    if (body.dryRun === true) {
      const preview = await previewRuleApply({
        projectId: params.id,
        ruleIds,
        rulesStore,
        ingestionStore,
        workspace,
      });
      return json({ preview });
    }

    const result = await applyDetectionRules({
      projectId: params.id,
      ruleIds,
      rulesStore,
      ingestionStore,
      workspace,
    });
    return json(result);
  } catch (error) {
    return json({ error: message(error) }, { status: 400 });
  }
}
