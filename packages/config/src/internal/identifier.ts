import { z } from "zod";

/**
 * Every configuration identifier is lower_snake_case. Identifiers are stored
 * in the database and appear in URLs, so they are held to one shape rather
 * than whatever the author of a new entry happened to type.
 */
export const identifierSchema = z
  .string()
  .regex(/^[a-z0-9]+(?:_[a-z0-9]+)*$/, "Expected a lower_snake_case identifier, e.g. real_estate.");

/** A human-facing label. Never empty — an empty label renders as nothing. */
export const displayNameSchema = z.string().trim().min(1, "Expected a non-empty display name.");
