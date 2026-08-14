import { SetMetadata } from "@nestjs/common";

export const IS_PUBLIC_KEY = "isPublic";

/**
 * Marks a route reachable without a session (design D1).
 *
 * The global guard rejects everything by default; this is the one way to
 * open a route, and it is deliberately visible in the controller file rather
 * than in a list somewhere else — a route added without this decorator is
 * protected whether or not anyone remembered.
 */
export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(IS_PUBLIC_KEY, true);
