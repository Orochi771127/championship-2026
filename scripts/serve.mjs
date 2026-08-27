import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = Number.parseInt(process.env.CHAMPIONSHIP_PORT ?? "8732", 10);
const host = process.env.CHAMPIONSHIP_HOST ?? "127.0.0.1";
const mime = new Map([
  [".html", "text/html; charset=utf-8"], [".js", "text/javascript; charset=utf-8"],
  [".mjs", "text/javascript; charset=utf-8"], [".json", "application/json; charset=utf-8"],
  [".css", "text/css; charset=utf-8"], [".png", "image/png"], [".webp", "image/webp"]
]);

const server = http.createServer((request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url ?? "/", `http://${host}`).pathname);
    const requested = pathname === "/" ? "/championship.html" : pathname;
    const file = path.resolve(repoRoot, `.${requested}`);
    if (file !== repoRoot && !file.startsWith(`${repoRoot}${path.sep}`)) {
      response.writeHead(403).end("Forbidden");
      return;
    }
    const stat = fs.statSync(file);
    if (!stat.isFile()) throw new Error("not a file");
    response.writeHead(200, {
      "Content-Type": mime.get(path.extname(file).toLowerCase()) ?? "application/octet-stream",
      "Cache-Control": "no-store",
      "Cross-Origin-Resource-Policy": "same-origin"
    });
    fs.createReadStream(file).pipe(response);
  } catch {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("Not found");
  }
});

server.listen(port, host, () => {
  console.log(`Championship 2026: http://${host}:${port}/championship.html`);
});

