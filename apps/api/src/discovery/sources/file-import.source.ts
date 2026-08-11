import { readFile } from "node:fs/promises";

import { validateCandidate } from "./source";
import type {
  DiscoveryRequest,
  DiscoverySource,
  DiscoverySourceResult,
  DiscoverySourceSuccess,
} from "./source";

/**
 * Reasons specific to importing a file, distinct from the candidate-level ones
 * shared with the run recorder. A file that cannot be read or cannot be
 * parsed is a source failure, not a set of rejected rows.
 */
export const FILE_IMPORT_REJECTION_REASONS = {
  unreadable_file: "unreadable_file",
  malformed_file: "malformed_file",
} as const;

type FileReader = (filePath: string) => Promise<string>;

/** The default reader: the configured path, read as UTF-8 text. */
const defaultReader: FileReader = async (filePath) => readFile(filePath, "utf8");

/**
 * The `file-import` source: a CSV or JSON list the operator already has
 * (design D3). It is the only adapter that contacts no third party at all,
 * which is why every test uses it and why it is the zero-dependency way to
 * seed a territory.
 *
 * The reader is injectable so tests never touch the filesystem; the default
 * reads the configured path.
 */
export class FileImportSource implements DiscoverySource {
  readonly sourceId = "file_import";

  constructor(
    private readonly filePath: string,
    private readonly reader: FileReader = defaultReader,
  ) {}

  async fetch(_request: DiscoveryRequest): Promise<DiscoverySourceResult> {
    let content: string;

    try {
      content = await this.reader(this.filePath);
    } catch {
      return { outcome: "failed", reason: FILE_IMPORT_REJECTION_REASONS.unreadable_file };
    }

    const rows = parseRows(content);

    if (rows === null) {
      return { outcome: "failed", reason: FILE_IMPORT_REJECTION_REASONS.malformed_file };
    }

    const candidates: DiscoverySourceSuccess["candidates"] = [];
    const rejections: Record<string, number> = {};

    for (const row of rows) {
      const result = validateCandidate(row);

      if (result.ok) {
        candidates.push(result.candidate);
      } else {
        rejections[result.reason] = (rejections[result.reason] ?? 0) + 1;
      }
    }

    return {
      outcome: "succeeded",
      candidates,
      rejections: Object.entries(rejections).map(([reason, count]) => ({ reason, count })),
    };
  }
}

/**
 * Splits a file into candidate-shaped records. JSON is an array of objects; a
 * CSV is a header row followed by data rows. Format is decided by the first
 * non-whitespace character, not by the file extension — an extension lies
 * more often than a file's own content. Returns `null` for a file that cannot
 * be interpreted at all.
 */
export function parseRows(content: string): unknown[] | null {
  const first = content.trimStart().charAt(0);

  if (first === "[" || first === "{") {
    return parseJsonRows(content);
  }

  return parseCsvRows(content);
}

function parseJsonRows(content: string): unknown[] | null {
  let parsed: unknown;

  try {
    parsed = JSON.parse(content);
  } catch {
    return null;
  }

  if (!Array.isArray(parsed)) {
    return null;
  }

  return parsed;
}

function parseCsvRows(content: string): unknown[] {
  const lines = content.split(/\r?\n/);

  if (lines.length < 2) {
    return [];
  }

  const headers = parseCsvLine(lines[0]!).map((header) => header.trim());

  const rows: unknown[] = [];

  for (const line of lines.slice(1)) {
    if (line.trim().length === 0) {
      continue;
    }

    const cells = parseCsvLine(line);
    const row: Record<string, string> = {};

    for (let index = 0; index < headers.length; index += 1) {
      row[headers[index]!] = cells[index] ?? "";
    }

    rows.push(row);
  }

  return rows;
}

/**
 * A deliberately small CSV parser: quoted cells, doubled quotes inside a
 * quoted cell, and commas inside quotes. It does not span a quoted value
 * across lines, which import files rarely need and which would make a
 * malformed file silently swallow rows.
 */
export function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];

    if (inQuotes) {
      if (character === '"') {
        if (line[index + 1] === '"') {
          current += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        current += character;
      }
    } else if (character === '"') {
      inQuotes = true;
    } else if (character === ",") {
      cells.push(current);
      current = "";
    } else {
      current += character;
    }
  }

  cells.push(current);

  return cells;
}
