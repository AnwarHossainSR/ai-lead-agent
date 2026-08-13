import { Catch, type ExceptionFilter, ArgumentsHost, BadRequestException, NotFoundException } from "@nestjs/common";
import { type ZodError } from "zod";

import { WriteValidationError } from "@mela/database";

/**
 * Converts domain errors into HTTP exceptions.
 *
 * - `WriteValidationError` → 400 with the validation issues
 * - `RecordNotFoundError` → 404
 */
@Catch(WriteValidationError)
export class WriteValidationExceptionFilter implements ExceptionFilter {
  catch(error: WriteValidationError, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();

    response.status(400).json({
      message: error.message,
      issues: error.issues,
    });
  }
}

@Catch(Error)
export class GenericExceptionFilter implements ExceptionFilter {
  catch(error: Error, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();

    if (error instanceof WriteValidationError) {
      response.status(400).json({
        message: error.message,
        issues: error.issues,
      });
      return;
    }

    if (error.message.includes("not found")) {
      response.status(404).json({ message: error.message });
      return;
    }

    response.status(500).json({ message: "Internal server error." });
  }
}
