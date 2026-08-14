// A controllable stand-in for the API, used only by dashboard-degradation.spec.ts
// (task 3.4). Plain Node so Playwright can start it with a bare `node` command —
// no TS runtime dependency needed for one fixture script.
//
// Routes:
//   GET  /__ready__            200, for Playwright's own readiness check
//   GET  /health                the shape apps/web/src/lib/health.ts expects
//   GET  /api/companies/count   \
//   GET  /api/leads/count        } each canned {count}, unless overridden
//   GET  /api/outreach/count    /
//   POST /__control__           { path: string, mode: "ok" | "fail" | "refuse" }
//        path is matched exactly against the request path (query string
//        stripped); "*" applies to every path not otherwise overridden.
import { createServer } from "node:http";

const PORT = 3098;

const DEFAULT_COUNTS = {
  "/api/companies/count": 42,
  "/api/leads/count": 17,
  "/api/outreach/count": 5,
};

/** @type {Map<string, "ok" | "fail" | "refuse">} */
const overrides = new Map();

function modeFor(pathname) {
  return overrides.get(pathname) ?? overrides.get("*") ?? "ok";
}

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json",
    "content-length": Buffer.byteLength(payload),
  });
  res.end(payload);
}

const server = createServer((req, res) => {
  const url = new URL(req.url ?? "/", `http://127.0.0.1:${PORT}`);

  if (req.method === "POST" && url.pathname === "/__control__") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      const { path, mode } = JSON.parse(body);
      if (mode === "ok") {
        overrides.delete(path);
      } else {
        overrides.set(path, mode);
      }
      sendJson(res, 200, { ok: true });
    });
    return;
  }

  if (req.method === "GET" && url.pathname === "/__ready__") {
    sendJson(res, 200, { ready: true });
    return;
  }

  const mode = modeFor(url.pathname);

  if (mode === "refuse") {
    // Simulates connection-level unreachability rather than an application
    // error: no HTTP response at all, socket torn down immediately.
    req.socket.destroy();
    return;
  }

  if (mode === "fail") {
    sendJson(res, 500, { error: "stubbed failure" });
    return;
  }

  if (req.method === "GET" && url.pathname === "/health") {
    sendJson(res, 200, {
      status: "healthy",
      details: { postgres: { status: "up" }, redis: { status: "up" } },
    });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/outreach/count") {
    // Distinguishes the dashboard's two outreach-count cards (awaiting
    // review vs. sent this week), which query this same endpoint with
    // different filters.
    const count = url.searchParams.has("sentAfter") ? 3 : DEFAULT_COUNTS[url.pathname];
    sendJson(res, 200, { count });
    return;
  }

  if (req.method === "GET" && url.pathname in DEFAULT_COUNTS) {
    sendJson(res, 200, { count: DEFAULT_COUNTS[url.pathname] });
    return;
  }

  sendJson(res, 404, { error: "not found" });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`API stub server listening on http://127.0.0.1:${PORT}`);
});
