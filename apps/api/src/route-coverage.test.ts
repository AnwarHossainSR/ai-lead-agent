import "reflect-metadata";

import { RequestMethod } from "@nestjs/common";
import { METHOD_METADATA, PATH_METADATA } from "@nestjs/common/constants";
import { DiscoveryModule, DiscoveryService, MetadataScanner } from "@nestjs/core";
import type { InstanceWrapper } from "@nestjs/core/injector/instance-wrapper";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { describe, expect, it } from "vitest";

import { AppModule } from "./app.module";
import { IS_PUBLIC_KEY } from "./auth/public.decorator";
import { createTestApp } from "./testing/app";

/**
 * The route-coverage test that keeps design D1 true: every registered route
 * is either guarded (the default) or carries `@Public()`, and the set of
 * public routes is exactly what was deliberately declared — not derived
 * from a hand-maintained list elsewhere, but from the same metadata the
 * guard itself reads.
 */

interface RouteInfo {
  readonly httpMethod: string;
  readonly path: string;
  readonly isPublic: boolean;
}

function joinPaths(...parts: ReadonlyArray<string | readonly string[] | undefined>): string {
  const flat = parts
    .flatMap((part) => (Array.isArray(part) ? part : [part]))
    .filter((part): part is string => typeof part === "string" && part.length > 0);

  const combined = flat
    .map((part) => part.replace(/^\/+|\/+$/g, ""))
    .filter((part) => part.length > 0)
    .join("/");

  return combined.length > 0 ? `/${combined}` : "/";
}

function httpMethodName(method: RequestMethod | undefined): string {
  switch (method) {
    case RequestMethod.POST:
      return "POST";
    case RequestMethod.PUT:
      return "PUT";
    case RequestMethod.DELETE:
      return "DELETE";
    case RequestMethod.PATCH:
      return "PATCH";
    case RequestMethod.ALL:
      return "ALL";
    default:
      return "GET";
  }
}

/** The API's global prefix excludes exactly `GET /health` (`create-app.ts`). */
function finalPath(rawPath: string, httpMethod: string): string {
  if (rawPath === "/health" && httpMethod === "GET") {
    return rawPath;
  }
  return `/api${rawPath}`;
}

async function discoverRoutes(): Promise<RouteInfo[]> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule, DiscoveryModule],
  }).compile();

  const discovery = moduleRef.get(DiscoveryService);
  const scanner = moduleRef.get(MetadataScanner);

  const routes: RouteInfo[] = [];

  for (const wrapper of discovery.getControllers() as InstanceWrapper[]) {
    const metatype = wrapper.metatype;
    if (metatype === null || metatype === undefined) {
      continue;
    }

    const controllerPath = Reflect.getMetadata(PATH_METADATA, metatype) as
      | string
      | string[]
      | undefined;
    const controllerIsPublic = Reflect.getMetadata(IS_PUBLIC_KEY, metatype) === true;

    const prototype = metatype.prototype as Record<string, unknown>;
    const methodNames = scanner.getAllMethodNames(prototype);

    for (const methodName of methodNames) {
      const handler = prototype[methodName] as object;
      const methodPath = Reflect.getMetadata(PATH_METADATA, handler) as
        | string
        | string[]
        | undefined;

      if (methodPath === undefined) {
        continue;
      }

      const httpMethod = httpMethodName(
        Reflect.getMetadata(METHOD_METADATA, handler) as RequestMethod | undefined,
      );
      const isPublic = controllerIsPublic || Reflect.getMetadata(IS_PUBLIC_KEY, handler) === true;
      const rawPath = joinPaths(controllerPath, methodPath);

      routes.push({ httpMethod, path: finalPath(rawPath, httpMethod), isPublic });
    }
  }

  await moduleRef.close();

  return routes;
}

/** Replaces every `:param` segment with a placeholder — the guard runs before route params are validated, so any value reaches it. */
function withPlaceholderParams(path: string): string {
  return path.replace(/:[^/]+/g, "placeholder-value");
}

describe("route coverage (design D1: deny by default)", () => {
  it("finds a non-trivial number of registered routes", async () => {
    const routes = await discoverRoutes();
    expect(routes.length).toBeGreaterThan(20);
  });

  it("declares exactly the expected public routes", async () => {
    const routes = await discoverRoutes();
    const publicRoutes = routes
      .filter((route) => route.isPublic)
      .map((route) => `${route.httpMethod} ${route.path}`)
      .sort();

    expect(publicRoutes).toEqual(
      ["GET /health", "POST /api/auth/sign-in", "POST /api/auth/sign-out"].sort(),
    );
  });

  it("rejects an unauthenticated request to every route that is not explicitly public", async () => {
    const routes = await discoverRoutes();
    const guarded = routes.filter((route) => !route.isPublic);
    expect(guarded.length).toBeGreaterThan(0);

    const app = await createTestApp();

    try {
      for (const route of guarded) {
        const path = withPlaceholderParams(route.path);
        const method = route.httpMethod.toLowerCase() as
          | "get"
          | "post"
          | "put"
          | "delete"
          | "patch"
          | "all";
        const verb = method === "all" ? "get" : method;

        const response = await request(app.getHttpServer())[verb](path);

        expect(
          response.status,
          `Expected ${route.httpMethod} ${route.path} to be guarded (401), got ${response.status}.`,
        ).toBe(401);
      }
    } finally {
      await app.close();
    }
  });
});
