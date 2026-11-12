import type {
  DetectionRule,
  RuleActionType,
  RuleRegistryMeta,
  RulesFile,
} from "@beancount-js/beangulp";
import type {
  IngestionConfig,
  IngestionSourceDefinition,
} from "@beancount-js/server";

const unavailableRuleActions = new Set<RuleActionType>([
  "auto_categorise_with_ai",
  "auto_detect_merchant_with_ai",
]);

export function sourceForActiveApp(
  source: IngestionSourceDefinition,
): IngestionSourceDefinition {
  const {
    aiEnabled: _aiEnabled,
    merchantEnrichment,
    ...retainedSource
  } = source;
  if (!merchantEnrichment) return retainedSource;
  const { aiEnabled: _merchantAiEnabled, ...retainedEnrichment } =
    merchantEnrichment;
  return {
    ...retainedSource,
    merchantEnrichment: retainedEnrichment,
  };
}

export function configForActiveApp(config: IngestionConfig): IngestionConfig {
  return {
    ...config,
    sources: config.sources.map(sourceForActiveApp),
  };
}

function ruleUsesUnavailableAction(rule: DetectionRule) {
  return rule.actions.some((action) =>
    unavailableRuleActions.has(action.actionType),
  );
}

export function rulesForActiveApp(file: RulesFile): RulesFile {
  return {
    ...file,
    rules: file.rules.filter((rule) => !ruleUsesUnavailableAction(rule)),
  };
}

export function registryForActiveApp(
  registry: RuleRegistryMeta,
): RuleRegistryMeta {
  return {
    ...registry,
    executors: registry.executors.filter(
      (executor) => !unavailableRuleActions.has(executor.key),
    ),
  };
}

export async function supportedRuleIds(
  projectId: string,
  requestedRuleIds: readonly string[] | undefined,
  readRules: (projectId: string) => Promise<RulesFile>,
) {
  const supported = new Set(
    rulesForActiveApp(await readRules(projectId)).rules.map((rule) => rule.id),
  );
  return (requestedRuleIds ?? [...supported]).filter((id) => supported.has(id));
}
