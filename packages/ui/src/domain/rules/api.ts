import { useBeancountController } from "../../controller/context";
import { createIngestionApi } from "../ingestion/api";
export function rulesPath(projectId: string, suffix = "") {
  return `/api/projects/${encodeURIComponent(projectId)}/rules${suffix}`;
}
export function useRulesApi() {
  const { ingestionJson } = createIngestionApi(
    useBeancountController().actions.request,
  );
  return { rulesJson: ingestionJson };
}
