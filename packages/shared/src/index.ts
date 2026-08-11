/**
 * @mela/shared — pure, dependency-free utilities needed on both sides of the
 * database boundary.
 *
 * Normalization lives here rather than in @mela/database because the Phase 3
 * discovery pipeline compares companies before anything is persisted.
 */

export { normalizeDomain } from "./normalize-domain";
export { LEGAL_SUFFIXES, normalizeCompanyName } from "./normalize-company-name";

export {
  BlankTextError,
  UNKNOWN,
  fromNullable,
  fromNullableText,
  isKnown,
  isUnknown,
  known,
  mapKnown,
  toNullable,
  toNullableText,
} from "./unknown";
export type { Known, Maybe, Unknown } from "./unknown";
