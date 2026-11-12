/**
 * Minimal headless Chrome over the DevTools protocol, shared by render-press and render-motion.
 * npm deps: none. Needs Node 22+ (global WebSocket) and a Chrome or Chromium binary.
 * Env: CHROME or CHROME_PATH (binary path) when it is not in a standard location.
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const KNOWN = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
];

function chromePath() {
  const fromEnv = process.env.CHROME ?? process.env.CHROME_PATH;
  if (fromEnv) return fromEnv;
  const found = KNOWN.find((p) => existsSync(p));
  if (!found) throw new Error("Chrome not found. Set CHROME=<path to a Chrome or Chromium binary>.");
  return found;
}

function client(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let id = 0;
  const pending = new Map();
  const listeners = new Set();
  ws.onmessage = (ev) => {
    const msg = JSON.parse(typeof ev.data === "string" ? ev.data : Buffer.from(ev.data).toString());
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(`${msg.error.message} ${msg.error.data ?? ""}`));
      else resolve(msg.result);
    } else if (msg.method) for (const l of listeners) l(msg);
  };
  const opened = new Promise((res, rej) => {
    ws.onopen = res;
    ws.onerror = () => rej(new Error("CDP websocket error"));
  });
  return {
    opened,
    listeners,
    send(method, params = {}, sessionId) {
      const mid = ++id;
      ws.send(JSON.stringify({ id: mid, method, params, ...(sessionId ? { sessionId } : {}) }));
      return new Promise((resolve, reject) => pending.set(mid, { resolve, reject }));
    },
    waitFor(method, sessionId, timeout = 60000) {
      return new Promise((resolve, reject) => {
        const t = setTimeout(() => {
          listeners.delete(l);
          reject(new Error(`timeout waiting for ${method}`));
        }, timeout);
        const l = (msg) => {
          if (msg.method === method && (!sessionId || msg.sessionId === sessionId)) {
            clearTimeout(t);
            listeners.delete(l);
            resolve(msg.params);
          }
        };
        listeners.add(l);
      });
    },
    close: () => ws.close(),
  };
}

/**
 * Launches Chrome. `page({ width, height, scale, background })` opens a tab with those metrics:
 *   metrics(w, h, scale)   resize
 *   goto(url)              navigate and wait for the load event
 *   eval(expression)       run JS, awaiting promises, returning the value
 *   shot(clip)             PNG buffer of `clip` ({ x, y, width, height }, in CSS pixels)
 *   close()
 * `logs` collects page exceptions and console errors.
 */
export async function launch() {
  const userDir = await mkdtemp(path.join(tmpdir(), "press-chrome-"));
  const proc = spawn(
    chromePath(),
    [
      "--headless=new",
      "--remote-debugging-port=0",
      `--user-data-dir=${userDir}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--hide-scrollbars",
      "--force-color-profile=srgb",
      "--font-render-hinting=none",
      "--disable-extensions",
      "--mute-audio",
      ...(process.env.CHROME_NO_SANDBOX ? ["--no-sandbox"] : []),
      "about:blank",
    ],
    { stdio: ["ignore", "ignore", "pipe"] },
  );
  const wsUrl = await new Promise((resolve, reject) => {
    let buf = "";
    const t = setTimeout(() => reject(new Error("Chrome did not start (no DevTools URL in 20s)")), 20000);
    proc.stderr.on("data", (d) => {
      buf += d;
      const m = buf.match(/DevTools listening on (ws:\/\/\S+)/);
      if (m) {
        clearTimeout(t);
        resolve(m[1]);
      }
    });
    proc.on("error", (e) => reject(new Error(`Chrome failed to start: ${e.message}`)));
    proc.on("exit", (code) => reject(new Error(`Chrome exited (${code}): ${buf.slice(-400)}`)));
  });
  const c = client(wsUrl);
  await c.opened;
  const logs = [];
  c.listeners.add((m) => {
    if (m.method === "Runtime.exceptionThrown") logs.push(`exception: ${m.params.exceptionDetails?.exception?.description ?? m.params.exceptionDetails?.text}`);
    if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") logs.push(`console.error: ${m.params.args.map((a) => a.value ?? a.description).join(" ")}`);
  });

  return {
    logs,
    async page({ width, height, scale = 1, background, media = [] }) {
      const { targetId } = await c.send("Target.createTarget", { url: "about:blank" });
      const { sessionId } = await c.send("Target.attachToTarget", { targetId, flatten: true });
      const s = (m, p) => c.send(m, p, sessionId);
      await s("Page.enable");
      await s("Runtime.enable");
      const metrics = (w, h, sc = 1) => s("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: sc, mobile: false });
      await metrics(width, height, scale);
      if (background) await s("Emulation.setDefaultBackgroundColorOverride", { color: background });
      // Never capture the reduced-motion version by accident.
      await s("Emulation.setEmulatedMedia", { media: "screen", features: [{ name: "prefers-reduced-motion", value: "no-preference" }, ...media] });
      return {
        metrics,
        async goto(url) {
          const loaded = c.waitFor("Page.loadEventFired", sessionId, 120000);
          const nav = await s("Page.navigate", { url });
          if (nav.errorText) throw new Error(`navigate ${url}: ${nav.errorText}`);
          await loaded;
        },
        async eval(expression) {
          const r = await s("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
          if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
          return r.result.value;
        },
        async shot(clip) {
          const r = await s("Page.captureScreenshot", { format: "png", ...(clip ? { clip: { ...clip, scale: 1 } } : {}), captureBeyondViewport: false, fromSurface: true });
          return Buffer.from(r.data, "base64");
        },
        close: () => c.send("Target.closeTarget", { targetId }).catch(() => {}),
        send: s,
      };
    },
    async kill() {
      c.close();
      proc.removeAllListeners("exit");
      proc.kill("SIGTERM");
      await new Promise((r) => setTimeout(r, 300));
      await rm(userDir, { recursive: true, force: true }).catch(() => {});
    },
  };
}
