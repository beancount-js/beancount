import { json } from "@sveltejs/kit";

export function GET() {
  return json({
    ok: true,
    runtime: process.env.BEANCOUNT_STUDIO_RUNTIME ?? "server",
  });
}
