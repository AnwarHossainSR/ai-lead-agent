import "reflect-metadata";

import { hydrateEnvironment } from "@mela/config/env";

// Vitest starts each test file with the package directory as its working
// directory, so the repository-root `.env` — the file Docker Compose reads to
// decide which ports the containers are published on — has to be found by
// walking up. In CI there is no file and the variables come from the
// environment itself, which `hydrateEnvironment` leaves alone.
hydrateEnvironment();
