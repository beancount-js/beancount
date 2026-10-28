import { useBeancountController } from "../../controller/context";
import type { BeancountControllerActions } from "../../controller/contracts";
export function ingestionPath(projectId: string, suffix = "") {
  return `/api/projects/${encodeURIComponent(projectId)}/ingestion${suffix}`;
}
export function createIngestionApi(
  request: BeancountControllerActions["request"],
) {
  return {
    async ingestionJson<T>(url: string, init?: RequestInit): Promise<T> {
      const response = await request(url, init);
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? response.statusText);
      return body as T;
    },
  };
}
export function useIngestionApi() {
  return createIngestionApi(useBeancountController().actions.request);
}
