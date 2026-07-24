import { redirect, type Handle } from "@sveltejs/kit";
import { serverWorkspace } from "$lib/server/workspace";

/**
 * Send `/` to the CLI / most-recent project so the active project is always
 * visible in the URL. Client hash fragments are preserved by the browser.
 */
export const handle: Handle = async ({ event, resolve }) => {
  if (
    process.env.BEANCOUNT_STUDIO_RUNTIME !== "web" &&
    (event.url.pathname === "/" || event.url.pathname === "")
  ) {
    const workspace = await serverWorkspace();
    const projects = await workspace.listProjects();
    const projectId = projects[0]?.id;
    if (projectId) {
      redirect(302, `/${encodeURIComponent(projectId)}/`);
    }
  }
  return resolve(event);
};
