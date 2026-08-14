import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
let searchParamsString = "";
let pathname = "/leads";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => pathname,
  useSearchParams: () => new URLSearchParams(searchParamsString),
}));

const { useFilterParams } = await import("./use-filter-params");

describe("useFilterParams", () => {
  beforeEach(() => {
    push.mockClear();
    searchParamsString = "";
    pathname = "/leads";
  });

  it("adds a param and pushes the resulting URL", () => {
    const { result } = renderHook(() => useFilterParams());

    act(() => {
      result.current.setParam("priority", "high");
    });

    expect(push).toHaveBeenCalledWith("/leads?priority=high", { scroll: false });
  });

  it("preserves existing params when setting another one", () => {
    searchParamsString = "priority=high";
    const { result } = renderHook(() => useFilterParams());

    act(() => {
      result.current.setParam("industryId", "logistics");
    });

    const [href] = push.mock.calls[0] as [string, unknown];
    const params = new URLSearchParams(href.split("?")[1]);
    expect(params.get("priority")).toBe("high");
    expect(params.get("industryId")).toBe("logistics");
  });

  it("removes a param when set to null, dropping the query string entirely if empty", () => {
    searchParamsString = "priority=high";
    const { result } = renderHook(() => useFilterParams());

    act(() => {
      result.current.setParam("priority", null);
    });

    expect(push).toHaveBeenCalledWith("/leads", { scroll: false });
  });

  it("removes a param when set to an empty string", () => {
    searchParamsString = "priority=high&industryId=logistics";
    const { result } = renderHook(() => useFilterParams());

    act(() => {
      result.current.setParam("priority", "");
    });

    expect(push).toHaveBeenCalledWith("/leads?industryId=logistics", { scroll: false });
  });
});
