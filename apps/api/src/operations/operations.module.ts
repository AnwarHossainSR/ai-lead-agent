import type { ApiEnv } from "@mela/config/env";
import { Module } from "@nestjs/common";

import { API_ENV } from "../config/env.module";
import { OperationsController } from "./operations.controller";
import { OperationsService } from "./operations.service";
import { QSTASH_CLIENT, createQStashClient } from "./qstash-client.provider";

@Module({
  controllers: [OperationsController],
  providers: [
    OperationsService,
    {
      provide: QSTASH_CLIENT,
      inject: [API_ENV],
      useFactory: (env: ApiEnv) => createQStashClient(env),
    },
  ],
})
export class OperationsModule {}
