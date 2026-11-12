import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, resolve, sep } from "node:path";

const root = resolve(process.argv[2] ?? "build-web");
const port = Number(process.argv[3] ?? "5175");
const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
};

async function fileFor(requestUrl = "/") {
  const pathname = decodeURIComponent(
    new URL(requestUrl, "http://local").pathname,
  );
  let path = resolve(root, `.${pathname}`);
  if (path !== root && !path.startsWith(`${root}${sep}`)) return null;
  try {
    if ((await stat(path)).isDirectory()) path = resolve(path, "index.html");
    if ((await stat(path)).isFile()) return path;
  } catch {
    // Static application routes fall back to the generated entry document.
  }
  return resolve(root, "index.html");
}

const server = createServer(async (request, response) => {
  const path = await fileFor(request.url);
  if (!path) {
    response.writeHead(400).end("Invalid path");
    return;
  }
  try {
    const size = (await stat(path)).size;
    response.writeHead(200, {
      "cache-control": "no-store",
      "content-length": String(size),
      "content-type": mimeTypes[extname(path)] ?? "application/octet-stream",
    });
    createReadStream(path).pipe(response);
  } catch {
    response.writeHead(404).end("Not found");
  }
});

server.listen(port, "127.0.0.1", () => {
  process.stdout.write(
    `Static application listening on http://127.0.0.1:${port}\n`,
  );
});
