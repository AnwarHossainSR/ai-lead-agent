import type { IncomingMessage, ServerResponse } from "node:http";
import { createServer, type Server } from "node:http";
import { Socket } from "node:net";
import { URL } from "node:url";

/**
 * A local HTTP fixture server for tests.
 *
 * Provides slow, blocking, redirecting and erroring hosts without touching
 * the network.  Every path is routed by the first segment of the pathname:
 *
 *   /ok                 → 200 with a simple HTML body
 *   /slow               → 200 after a configurable delay
 *   /timeout            → accepts connection but never responds
 *   /block/403          → 403
 *   /block/429          → 429 without Retry-After
 *   /block/429-retry    → 429 with Retry-After
 *   /block/captcha      → 200 with "captcha" in the body
 *   /redirect/301       → 301 to /ok
 *   /redirect/chain     → 301 → 302 → /ok
 *   /error/500          → 500
 *   /error/connection-reset → resets the socket immediately
 */

export type FixtureRoute =
  | { kind: "ok" }
  | { kind: "slow"; delayMs: number }
  | { kind: "timeout" }
  | { kind: "block"; status: number; body?: string }
  | { kind: "redirect"; status: number; location: string }
  | { kind: "error"; status: number }
  | { kind: "html"; body: string; status?: number; headers?: Record<string, string> }
  | { kind: "oversized"; sizeBytes: number }
  | { kind: "robots"; content: string };

const DEFAULT_ROUTES: Record<string, FixtureRoute> = {
  "/ok": { kind: "ok" },
  "/slow": { kind: "slow", delayMs: 5_000 },
  "/timeout": { kind: "timeout" },
  "/block/403": { kind: "block", status: 403 },
  "/block/429": { kind: "block", status: 429 },
  "/block/429-retry": { kind: "block", status: 429, body: "rate limited" },
  "/block/captcha": { kind: "block", status: 200, body: "captcha challenge" },
  "/redirect/301": { kind: "redirect", status: 301, location: "/ok" },
  "/redirect/chain": { kind: "redirect", status: 301, location: "/redirect/302" },
  "/redirect/302": { kind: "redirect", status: 302, location: "/ok" },
  "/error/500": { kind: "error", status: 500 },
  // Analysis-specific routes
  "/good": {
    kind: "html",
    body: "<!DOCTYPE html><html><head><title>Good Site</title><meta name='description' content='A good site'><link rel='icon' href='/favicon.ico'></head><body><h1>Welcome</h1></body></html>",
  },
  "/console-errors": {
    kind: "html",
    body: "<!DOCTYPE html><html><head><title>Console Errors</title></head><body><script>console.error('test error');</script></body></html>",
  },
  "/never-loading": { kind: "timeout" },
  "/challenge": { kind: "block", status: 403, body: "Access Denied - Challenge" },
  "/restrictive-robots": {
    kind: "robots",
    content: "User-agent: *\nDisallow: /private/\nDisallow: /admin/\n",
  },
};

function handleRequest(
  req: IncomingMessage,
  res: ServerResponse,
  routes: Record<string, FixtureRoute>,
): void {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
  const route = routes[url.pathname];

  if (route === undefined) {
    res.writeHead(404);
    res.end("not found");
    return;
  }

  switch (route.kind) {
    case "ok":
      res.writeHead(200, { "content-type": "text/html" });
      res.end("<html><body>fixture</body></html>");
      return;

    case "slow":
      setTimeout(() => {
        res.writeHead(200, { "content-type": "text/html" });
        res.end("<html><body>slow response</body></html>");
      }, route.delayMs);
      return;

    case "timeout":
      // Accept the connection but never write anything.
      return;

    case "block": {
      const body = route.body ?? "blocked";
      const headers: Record<string, string> = { "content-type": "text/html" };
      if (route.status === 429 && url.pathname !== "/block/429-retry") {
        // 429 without Retry-After
      } else if (route.status === 429) {
        headers["retry-after"] = "120";
      }
      res.writeHead(route.status, headers);
      res.end(body);
      return;
    }

    case "redirect":
      res.writeHead(route.status, { location: route.location });
      res.end();
      return;

    case "error":
      res.writeHead(route.status);
      res.end("error");
      return;

    case "html":
      res.writeHead(route.status ?? 200, {
        "content-type": "text/html",
        ...route.headers,
      });
      res.end(route.body);
      return;

    case "oversized": {
      const chunk = "x".repeat(1024);
      const chunks = Math.ceil(route.sizeBytes / 1024);
      res.writeHead(200, { "content-type": "text/html" });
      for (let i = 0; i < chunks; i++) {
        res.write(chunk);
      }
      res.end();
      return;
    }

    case "robots":
      res.writeHead(200, { "content-type": "text/plain" });
      res.end(route.content);
      return;
  }
}

export interface FixtureServerHandle {
  /** Base URL of the running server, e.g. "http://127.0.0.1:34567" */
  readonly url: string;
  /** Shut the server down. */
  close(): Promise<void>;
}

/**
 * Starts the fixture server on a random available port.
 */
export async function startFixtureServer(
  overrides?: Record<string, FixtureRoute>,
): Promise<FixtureServerHandle> {
  const routes = { ...DEFAULT_ROUTES, ...overrides };

  const server: Server = createServer((req, res) => handleRequest(req, res, routes));

  // Track open sockets so we can destroy them on close (the /timeout route
  // accepts a connection but never responds, which would keep the server alive
  // forever if we only called server.close()).
  const sockets = new Set<Socket>();
  server.on("connection", (socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
  });

  return new Promise<FixtureServerHandle>((resolve) => {
    server.listen(0, () => {
      const addr = server.address();
      const port = typeof addr === "object" && addr !== null ? addr.port : 0;
      const url = `http://127.0.0.1:${port}`;

      resolve({
        url,
        close: () =>
          new Promise<void>((resolve, reject) => {
            for (const socket of sockets) {
              socket.destroy();
            }
            server.close((err) => (err ? reject(err) : resolve()));
          }),
      });
    });
  });
}
