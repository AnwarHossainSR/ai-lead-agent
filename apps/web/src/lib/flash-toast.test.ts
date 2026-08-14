import { beforeEach, describe, expect, it, vi } from "vitest";

const store = {
  get: vi.fn(),
  set: vi.fn(),
};

vi.mock("next/headers", () => ({
  cookies: async () => store,
}));

import { actionError, actionSuccess } from "./action-result";
import { FLASH_TOAST_COOKIE, readFlashToast, setFlashToast } from "./flash-toast";

beforeEach(() => {
  store.get.mockReset();
  store.set.mockReset();
});

describe("flash toast", () => {
  it("carries a successful outcome across a redirect", async () => {
    await setFlashToast(actionSuccess("Message approved"));

    expect(store.set).toHaveBeenCalledWith(
      FLASH_TOAST_COOKIE,
      JSON.stringify({ tone: "success", message: "Message approved" }),
      expect.objectContaining({ path: "/", sameSite: "lax" }),
    );
  });

  it("carries a failure as a failure", async () => {
    await setFlashToast(actionError("The API is unreachable"));

    const [, value] = store.set.mock.calls[0] as [string, string, unknown];
    expect(JSON.parse(value)).toEqual({ tone: "error", message: "The API is unreachable" });
  });

  it("reads a pending toast", async () => {
    store.get.mockReturnValue({
      value: JSON.stringify({ tone: "success", message: "Signed out" }),
    });

    await expect(readFlashToast()).resolves.toEqual({ tone: "success", message: "Signed out" });
  });

  it("reports no toast when the cookie is absent", async () => {
    store.get.mockReturnValue(undefined);

    await expect(readFlashToast()).resolves.toBeNull();
  });

  it("ignores a malformed or hand-edited cookie rather than throwing", async () => {
    store.get.mockReturnValue({ value: "not json" });
    await expect(readFlashToast()).resolves.toBeNull();

    store.get.mockReturnValue({ value: JSON.stringify({ tone: "purple", message: "" }) });
    await expect(readFlashToast()).resolves.toBeNull();
  });

  it("does not write the cookie when reading it", async () => {
    store.get.mockReturnValue({ value: JSON.stringify({ tone: "info", message: "Retried" }) });

    await readFlashToast();

    expect(store.set).not.toHaveBeenCalled();
  });
});
