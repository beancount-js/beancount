import { resolve } from "$app/paths";
import { DEFAULT_LEDGER_VIEW, viewPathToSegments } from "./ledger-route";
import { getStudioRouteEnv } from "./studio-route-env";

/** App pathname for a registered project (trailing slash). */
export function projectPathname(projectId: string) {
  const path = resolve("/[projectId]", { projectId });
  return path.endsWith("/") ? path : `${path}/`;
}

/**
 * Navigate to another project while preserving the current ledger view path
 * (`/ledger/.../journal/` etc.) when present.
 */
export function projectHref(projectId: string) {
  if (typeof window !== "undefined") {
    const pathname = window.location.pathname;
    const marker = "/ledger/";
    const index = pathname.indexOf(marker);
    if (index >= 0) {
      const rest = pathname.slice(index + marker.length);
      const search = window.location.search;
      return `/${encodeURIComponent(projectId)}/ledger/${rest}${search}`;
    }
  }
  const env = getStudioRouteEnv();
  if (env.ledgerStem) {
    const view = viewPathToSegments(DEFAULT_LEDGER_VIEW).join("/");
    return `/${encodeURIComponent(projectId)}/ledger/${env.ledgerStem
      .split("/")
      .map(encodeURIComponent)
      .join("/")}/${view}/`;
  }
  return projectPathname(projectId);
}
