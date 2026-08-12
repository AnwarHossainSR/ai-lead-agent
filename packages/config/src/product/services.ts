import { z } from "zod";

import { ConfigurationError, assertUniqueIdentifiers, parseOrThrow } from "../internal/errors";
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

export const categorySchema = z.object({
  id: identifierSchema,
  name: displayNameSchema,
  serviceId: z.string().trim().min(1, "Expected a service identifier."),
});

export type Category = z.infer<typeof categorySchema>;

export const categoryIdSchema = z
  .string()
  .regex(
    /^[a-z0-9]+(?:_[a-z0-9]+)*$/,
    "Expected a lower_snake_case identifier, e.g. website_modernization.",
  );

export function parseCategories(raw: unknown): readonly Category[] {
  const categories = parseOrThrow(
    "Opportunity category configuration",
    z.array(categorySchema),
    raw,
  );

  // Check for duplicate identifiers
  const seen = new Set<string>();
  for (const category of categories) {
    if (seen.has(category.id)) {
      throw new ConfigurationError(
        "Opportunity category configuration",
        `Duplicate category identifier "${category.id}".`,
      );
    }
    seen.add(category.id);

    // Check that the category maps to a known service
    resolveService(category.serviceId);
  }

  return deepFreeze(categories);
}

const CATEGORY_DATA = [
  {
    id: "website_modernization",
    name: "Website Modernization",
    serviceId: "website_modernization",
  },
  {
    id: "web_application_development",
    name: "Web Application Development",
    serviceId: "web_application_development",
  },
  {
    id: "custom_business_platform",
    name: "Custom Business Platform",
    serviceId: "custom_business_platform",
  },
  {
    id: "backend_and_api_development",
    name: "Backend and API Development",
    serviceId: "backend_and_api_development",
  },
  {
    id: "aws_and_cloud_modernization",
    name: "AWS and Cloud Modernization",
    serviceId: "aws_and_cloud_modernization",
  },
] as const;

export const CATEGORIES = parseCategories(CATEGORY_DATA);

export function findCategory(id: string): Category | undefined {
  return CATEGORIES.find((category) => category.id === id);
}

export function resolveOpportunityCategory(id: string): Category {
  const category = findCategory(id);

  if (category === undefined) {
    const known = CATEGORIES.map((entry) => entry.id).join(", ");
    throw new ConfigurationError(
      "Opportunity category configuration",
      `Unknown category "${id}". Configured categories: ${known}.`,
    );
  }

  return category;
}

export function isOpportunityCategoryId(id: string): boolean {
  return findCategory(id) !== undefined;
}

export type CategoryId = (typeof CATEGORY_DATA)[number]["id"];
