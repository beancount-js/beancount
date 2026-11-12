import { json } from "@sveltejs/kit";
import { loadProjectSources } from "@beancount-js/beancount";
import { parseRulesFile, validateDetectionRule } from "@beancount-js/beangulp";
import { serverRules } from "$lib/server/rules";
import {
  registryForActiveApp,
  rulesForActiveApp,
} from "$lib/server/runtime-policy";
import { serverWorkspace } from "$lib/server/workspace";

function message(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export async function GET({ params }: { params: { id: string } }) {
  const workspace = await serverWorkspace();
  const snapshot = await workspace.readProject(params.id);
  const [entries] = loadProjectSources(
    snapshot.project.entryFile,
    snapshot.ledgerFiles.map((file) => ({
      path: file.path,
      contents: file.contents,
    })),
  );
  const accounts = [...new Set(entries.flatMap((entry) => entry.accounts))]
    .filter(Boolean)
    .sort();
  const file = rulesForActiveApp(await serverRules().readRules(params.id));
  return json({
    ...file,
    registry: registryForActiveApp(serverRules().registry({ accounts })),
    accounts,
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
    const body = await request.json();
    const file = rulesForActiveApp(parseRulesFile(body));
    for (const rule of file.rules) {
      const errors = validateDetectionRule(rule);
      if (errors.length > 0) {
        return json(
          {
            error: `Invalid rule${rule.name ? ` "${rule.name}"` : ""}: ${errors.join(" ")}`,
          },
          { status: 400 },
        );
      }
    }
    await serverRules().writeRules(params.id, file);
    return json(await serverRules().readRules(params.id));
  } catch (error) {
    return json({ error: message(error) }, { status: 400 });
  }
}
