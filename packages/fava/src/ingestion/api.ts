export async function ingestionJson<T>(
  url: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(url, init);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error((body as { error?: string }).error ?? response.statusText);
  }
  return body as T;
}

export function ingestionPath(projectId: string, suffix = "") {
  return `/api/projects/${encodeURIComponent(projectId)}/ingestion${suffix}`;
}
