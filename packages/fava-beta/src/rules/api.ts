export async function rulesJson<T>(
  url: string,
  init?: RequestInit,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch (error) {
    const detail =
      error instanceof Error && error.message
        ? error.message
        : String(error || "network error");
    throw new Error(`Request to ${url} failed (${detail}).`);
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      typeof (body as { error?: unknown }).error === "string"
        ? (body as { error: string }).error
        : response.statusText || `HTTP ${response.status}`;
    throw new Error(message);
  }
  return body as T;
}

export function rulesPath(projectId: string, suffix = "") {
  return `/api/projects/${encodeURIComponent(projectId)}/rules${suffix}`;
}
