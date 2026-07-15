import { json, type RequestHandler } from "@sveltejs/kit";
import { pickProjectDirectoryFromSystemDialog } from "@beancount-js/server";

export const POST: RequestHandler = async () => {
  try {
    const selectedPath = pickProjectDirectoryFromSystemDialog();
    if (!selectedPath) {
      return json({
        ok: false,
        path: null,
        error: "No directory was selected.",
      });
    }
    return json({ ok: true, path: selectedPath });
  } catch (error) {
    return json(
      {
        ok: false,
        path: null,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
};
