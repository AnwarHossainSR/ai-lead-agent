import { type ZodType, type z } from "zod";

/**
 * Nest's own `ValidationPipe` is built on class-validator: it reads decorator
 * metadata off a DTO class. This project validates with Zod, and running two
 * validation systems side by side is how a rule ends up enforced in one of
 * them and not the other.
 *
 * A global pipe can only find a schema through the parameter's declared type —
 * that is the one thing Nest hands it. So the schema is carried on a class
 * that exists for no other purpose:
 *
 *   const CreateCompanyDto = createZodDto(insertCompanyInputSchema);
 *   type CreateCompanyDto = InferDto<typeof CreateCompanyDto>;
 *
 *   create(@Body() body: CreateCompanyDto) { ... }
 *
 * The class is never instantiated. `ZodValidationPipe` reads `zodSchema` off
 * it, parses, and hands the handler the parsed value.
 */

/** Where the pipe looks. A plain static, not reflection metadata. */
export const ZOD_SCHEMA = "zodSchema";

export interface ZodDto<Schema extends ZodType = ZodType> {
  new (): z.output<Schema>;
  readonly zodSchema: Schema;
}

/** The parsed shape a DTO stands for, for use as a TypeScript type. */
export type InferDto<Dto extends ZodDto> = InstanceType<Dto>;

export function createZodDto<Schema extends ZodType>(schema: Schema): ZodDto<Schema> {
  class Dto {
    static readonly zodSchema = schema;
  }

  return Dto as unknown as ZodDto<Schema>;
}

/** Recognises a DTO produced above, and nothing else. */
export function extractZodSchema(metatype: unknown): ZodType | null {
  if (typeof metatype !== "function") {
    return null;
  }

  const schema: unknown = (metatype as { [ZOD_SCHEMA]?: unknown })[ZOD_SCHEMA];

  return typeof schema === "object" && schema !== null && "safeParse" in schema
    ? (schema as ZodType)
    : null;
}
