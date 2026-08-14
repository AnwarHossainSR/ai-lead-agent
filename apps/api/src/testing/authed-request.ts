import request, { type Test as SupertestChain } from "supertest";

type HttpVerb = "get" | "post" | "put" | "patch" | "delete";

const VERBS: readonly HttpVerb[] = ["get", "post", "put", "patch", "delete"];

/**
 * `supertest`'s `request(server)`, with `cookie` attached to every call.
 *
 * Every route is now behind the global session guard (task 4.1), so every
 * existing test's `request(app.getHttpServer())` needs a session cookie on
 * every request it makes. This wraps the same object supertest already
 * returns rather than introducing a new API, so the only change at each call
 * site is which function constructs the request.
 */
export function authedRequest(
  server: Parameters<typeof request>[0],
  cookie: string,
): ReturnType<typeof request> {
  const base = request(server);

  return new Proxy(base, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);

      if (typeof value === "function" && VERBS.includes(prop as HttpVerb)) {
        return (...args: Parameters<typeof target.get>): SupertestChain =>
          (value.apply(target, args) as SupertestChain).set("Cookie", cookie);
      }

      return value;
    },
  });
}
