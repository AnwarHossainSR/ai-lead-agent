import {
  type ArgumentMetadata,
  BadRequestException,
  Injectable,
  type PipeTransform,
} from "@nestjs/common";
import { type ZodError } from "zod";

import { extractZodSchema } from "./zod-dto";

/**
 * The global request validation pipe.
 *
 * Registered application-wide, so a handler whose parameter is declared as a
 * Zod DTO is validated whether or not its author remembered to ask. A
 * parameter declared as anything else passes through untouched — Nest runs
 * this pipe for every argument, including the ones it constructs itself.
 */
@Injectable()
export class ZodValidationPipe implements PipeTransform {
  transform(value: unknown, metadata: ArgumentMetadata): unknown {
    const schema = extractZodSchema(metadata.metatype);

    if (schema === null) {
      return value;
    }

    const result = schema.safeParse(value);

    if (!result.success) {
      throw new BadRequestException({
        statusCode: 400,
        error: "Bad Request",
        message: "Request validation failed.",
        details: explain(result.error),
      });
    }

    return result.data;
  }
}

/**
 * Reports where each problem is and what was expected — never what was sent.
 * A rejected request body can contain a password or an API key, and echoing it
 * back would write that value into every proxy log between here and the
 * client.
 */
function explain(error: ZodError): { field: string; problem: string }[] {
  return error.issues.map((issue) => ({
    field: issue.path.length === 0 ? "(root)" : issue.path.join("."),
    problem: issue.message,
  }));
}
