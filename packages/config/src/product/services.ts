import { z } from "zod";

import { assertUniqueIdentifiers, ConfigurationError, parseOrThrow } from "../internal/errors";
import { deepFreeze } from "../internal/freeze";
import { displayNameSchema, identifierSchema } from "../internal/identifier";

export const serviceSchema = z.object({
  id: identifierSchema,
  name: displayNameSchema,
  description: z.string().trim().min(1, "Expected a description of what the service delivers."),
});

export type Service = z.infer<typeof serviceSchema>;

export function parseServices(raw: unknown): readonly Service[] {
  const services = parseOrThrow("Service configuration", z.array(serviceSchema), raw);

  assertUniqueIdentifiers(
    "Service configuration",
    services.map((service) => service.id),
  );

  return deepFreeze(services);
}

const SERVICE_DATA = [
  {
    id: "website_modernization",
    name: "Website Modernization",
    description:
      "Rebuilding an existing marketing site for performance, accessibility, mobile behaviour and search visibility.",
  },
  {
    id: "web_application_development",
    name: "Web Application Development",
    description:
      "Building customer-facing or internal web applications, including portals, booking flows and dashboards.",
  },
  {
    id: "custom_business_platform",
    name: "Custom Business Platform",
    description:
      "Designing and building a system around a company's own operating model when off-the-shelf software does not fit.",
  },
  {
    id: "backend_and_api_development",
    name: "Backend and API Development",
    description:
      "Building the services, data models and integrations that other systems and applications consume.",
  },
  {
    id: "aws_and_cloud_modernization",
    name: "AWS and Cloud Modernization",
    description:
      "Moving workloads to managed cloud infrastructure and improving reliability, deployment and running cost.",
  },
] as const;

export const SERVICES = parseServices(SERVICE_DATA);

export function findService(id: string): Service | undefined {
  return SERVICES.find((service) => service.id === id);
}

/**
 * Resolves a service identifier, refusing an unknown one. Returning a default
 * or an empty service here would let a recommendation reference something the
 * company does not offer.
 */
export function resolveService(id: string): Service {
  const service = findService(id);

  if (service === undefined) {
    const known = SERVICES.map((entry) => entry.id).join(", ");
    throw new ConfigurationError(
      "Service configuration",
      `Unknown service "${id}". Configured services: ${known}.`,
    );
  }

  return service;
}

export function isServiceId(id: string): boolean {
  return findService(id) !== undefined;
}

export type ServiceId = (typeof SERVICE_DATA)[number]["id"];
