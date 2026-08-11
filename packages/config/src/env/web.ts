import { z } from "zod";

import { httpUrl } from "./fields";
import { createEnvLoader } from "./load";

/**
 * Everything the Next.js application reads. `NEXT_PUBLIC_*` values are inlined
 * into the client bundle at build time, so nothing secret may ever be added
 * under that prefix.
 */
export const webEnvSchema = z.object({
  NEXT_PUBLIC_API_URL: httpUrl.describe(
    "Base URL of the API as reached from the browser. Inlined into the client bundle, so it must never carry a credential.",
  ),

  API_URL: httpUrl.describe(
    "Base URL of the API as reached from the Next.js server while rendering. Usually identical to NEXT_PUBLIC_API_URL in development.",
  ),
});

export type WebEnv = z.infer<typeof webEnvSchema>;

export const loadWebEnv = createEnvLoader("the web application", webEnvSchema);
