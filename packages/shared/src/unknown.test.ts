import { describe, expect, expectTypeOf, it } from "vitest";

import {
  BlankTextError,
  type Maybe,
  UNKNOWN,
  fromNullable,
  fromNullableText,
  isKnown,
  isUnknown,
  known,
  mapKnown,
  toNullable,
  toNullableText,
} from "./unknown";

describe("the unknown marker", () => {
  it("is distinguishable from every known value, including falsy ones", () => {
    expect(isUnknown(UNKNOWN)).toBe(true);
    expect(isUnknown(known(0))).toBe(false);
    expect(isUnknown(known(""))).toBe(false);
    expect(isUnknown(known(false))).toBe(false);
  });

  it("cannot be mutated into a known value", () => {
    expect(() => {
      (UNKNOWN as { known: boolean }).known = true;
    }).toThrow(TypeError);
  });

  it("survives JSON, so an API response can carry it", () => {
    expect(JSON.parse(JSON.stringify(UNKNOWN))).toEqual({ known: false });
    expect(JSON.parse(JSON.stringify(known(42)))).toEqual({ known: true, value: 42 });
  });
});

describe("reaching the value", () => {
  it("requires narrowing first", () => {
    const score: Maybe<number> = known(87);

    if (isKnown(score)) {
      expectTypeOf(score.value).toEqualTypeOf<number>();
      expect(score.value).toBe(87);
    } else {
      expect.unreachable("a known value narrowed to unknown");
    }
  });

  it("falls back only for presentation, never by silently substituting data", () => {
    expect(mapKnown(known(87), (score) => `${score}/100`)).toEqual(known("87/100"));
    expect(mapKnown(UNKNOWN as Maybe<number>, (score) => `${score}/100`)).toBe(UNKNOWN);
  });
});

describe("the SQL boundary", () => {
  it("maps null and undefined to unknown", () => {
    expect(fromNullable(null)).toBe(UNKNOWN);
    expect(fromNullable(undefined)).toBe(UNKNOWN);
  });

  it("maps a present value to known, including zero and false", () => {
    expect(fromNullable(0)).toEqual(known(0));
    expect(fromNullable(false)).toEqual(known(false));
  });

  it("maps unknown back to null", () => {
    expect(toNullable(UNKNOWN)).toBeNull();
    expect(toNullable(known("dubai"))).toBe("dubai");
  });

  it("round-trips a value unchanged", () => {
    expect(toNullable(fromNullable("https://example.ae"))).toBe("https://example.ae");
    expect(toNullable(fromNullable(null))).toBeNull();
  });
});

describe("blank text", () => {
  it("is refused on the way in, naming the field", () => {
    const read = (): unknown => fromNullableText("companies.linkedin_url", "   ");

    expect(read).toThrow(BlankTextError);
    expect(read).toThrow(/companies\.linkedin_url/);
    expect(read).toThrow(/blank string is not a fact/);
  });

  it("is refused on the way out, so a blank is never persisted", () => {
    const write = (): unknown => toNullableText("companies.description", known(""));

    expect(write).toThrow(BlankTextError);
    expect(write).toThrow(/companies\.description/);
  });

  it("is not what a missing value looks like", () => {
    expect(fromNullableText("companies.description", null)).toBe(UNKNOWN);
    expect(toNullableText("companies.description", UNKNOWN)).toBeNull();
  });

  it("does not stop a real value passing through untrimmed", () => {
    expect(fromNullableText("companies.name", " Emaar ")).toEqual(known(" Emaar "));
    expect(toNullableText("companies.name", known(" Emaar "))).toBe(" Emaar ");
  });
});
