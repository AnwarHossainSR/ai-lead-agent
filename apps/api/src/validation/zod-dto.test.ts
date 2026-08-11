import { describe, expect, it } from "vitest";
import { z } from "zod";

import { createZodDto, extractZodSchema } from "./zod-dto";

const schema = z.object({ name: z.string() });

describe("createZodDto", () => {
  it("carries the schema where the pipe looks for it", () => {
    expect(extractZodSchema(createZodDto(schema))).toBe(schema);
  });
});

describe("extractZodSchema", () => {
  it("finds nothing on the built-in types Nest passes for untyped arguments", () => {
    expect(extractZodSchema(String)).toBeNull();
    expect(extractZodSchema(Number)).toBeNull();
    expect(extractZodSchema(Object)).toBeNull();
    expect(extractZodSchema(undefined)).toBeNull();
    expect(extractZodSchema(null)).toBeNull();
  });

  it("finds nothing on an ordinary class", () => {
    class Plain {}

    expect(extractZodSchema(Plain)).toBeNull();
  });

  it("refuses a class whose zodSchema is not a schema", () => {
    class Impostor {
      static readonly zodSchema = "definitely a schema, promise";
    }

    expect(extractZodSchema(Impostor)).toBeNull();
  });
});
