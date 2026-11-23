import { readCatalogues } from "./catalogues.ts";
import type { Result } from "./issues.ts";
import type { ValidLogbook } from "./model.ts";
import { Context } from "./validate/context.ts";
import { readLogbook } from "./validate/logbook.ts";

/** Options for {@link validateLogbook}. */
export interface ValidateOptions {
  /**
   * Snapshots of the official catalogues, from the application. Every code of
   * a catalogue given here is checked: it must exist, and not have been
   * retired on or before its record's date. Catalogues left out aren't
   * checked. The snapshot is untrusted input too, and is validated first.
   */
  readonly catalogues?: unknown;
}

/**
 * Validates a logbook from outside data, which may be anything. It reports
 * every problem it finds, up to a limit, each with its path and a stable
 * code, and never throws for bad input. On success, the value is a frozen
 * copy that shares nothing with the input.
 */
export function validateLogbook(
  input: unknown,
  options: ValidateOptions = {},
): Result<ValidLogbook> {
  const ctx = new Context();
  const catalogues =
    options.catalogues === undefined
      ? new Map()
      : readCatalogues(ctx, options.catalogues, ["options", "catalogues"]);
  if (ctx.issues.length > 0) {
    return { ok: false, issues: Object.freeze([...ctx.issues]) };
  }
  const logbook = readLogbook(ctx, catalogues, input, []);
  if (logbook === undefined || ctx.issues.length > 0) {
    return { ok: false, issues: Object.freeze([...ctx.issues]) };
  }
  return { ok: true, value: logbook as ValidLogbook, issues: [] };
}
