// Live preview with a scrubber. Usage: node tools/serve.mjs [port=4600]  → http://localhost:4600/scenes/<id>/  (add ?v for vertical)
import http from "node:http";
import fs from "node:fs";
import { resolveFile, mime } from "./lib.mjs";

const port = +(process.argv[2] ?? 4600);
http.createServer((req, res) => {
  const p = resolveFile(new URL(req.url, "http://x").pathname);
  if (!p) { res.writeHead(404); return res.end("not found"); }
  res.writeHead(200, { "content-type": mime(p), "cache-control": "no-store" });
  fs.createReadStream(p).pipe(res);
}).listen(port, "127.0.0.1", () => console.log(`http://localhost:${port}/scenes/`));
