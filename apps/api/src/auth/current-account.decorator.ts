import type { PublicAccountRow } from "@mela/database";
import { type ExecutionContext, createParamDecorator } from "@nestjs/common";

import type { RequestWithAccount } from "./session.guard";

/** The authenticated account the guard attached to the request. Only valid on a route the guard actually ran on — i.e. not `@Public()`. */
export const CurrentAccount = createParamDecorator(
  (_data: unknown, context: ExecutionContext): PublicAccountRow => {
    const request = context.switchToHttp().getRequest<RequestWithAccount>();

    if (request.account === undefined) {
      throw new Error(
        "CurrentAccount used on a route the session guard did not run on. Remove @Public() or use the guard.",
      );
    }

    return request.account;
  },
);
