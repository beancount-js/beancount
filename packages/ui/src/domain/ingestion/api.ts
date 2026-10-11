import { useBeancountController } from "../../controller/context";
export function ingestionPath(projectId: string, suffix = "") {
  return `/api/projects/${encodeURIComponent(projectId)}/ingestion${suffix}`;
}
export function useIngestionApi() {
  const controller = useBeancountController();
  return {
    async ingestionJson<T>(url: string, init?: RequestInit): Promise<T> {
      const response = await controller.actions.request(url, init);
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? response.statusText);
      return body as T;
    },
  };
}
