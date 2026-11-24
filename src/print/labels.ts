import type { PathSegment } from "../issues.ts";
import { type Context, readList, readObject } from "../validate/context.ts";
import { digits, text } from "../validate/fields.ts";

/** At most this many crop delimitation labels. */
export const MAX_DGC_LABELS = 100_000;

/**
 * How a crop delimitation is described in a printed document, such as its
 * SIGPAC reference and crop. The application knows these for the register's
 * delimitations; the library describes the ones the holding declared itself.
 */
export type DgcLabel =
  | { readonly dgc: string; readonly label: string }
  | { readonly declaredDgc: string; readonly label: string };

/** Validated crop delimitation labels, by code. */
export interface DgcLabels {
  readonly dgc: ReadonlyMap<string, string>;
  readonly declaredDgc: ReadonlyMap<string, string>;
}

/** Validates the crop delimitation labels the application supplied. They are untrusted input. */
export function readDgcLabels(
  ctx: Context,
  value: unknown,
  path: readonly PathSegment[],
): DgcLabels {
  const dgc = new Map<string, string>();
  const declaredDgc = new Map<string, string>();
  readList(ctx, value, path, 0, MAX_DGC_LABELS, (item, itemPath) => {
    const fields = readObject(ctx, item, itemPath, ["dgc", "declaredDgc", "label"]);
    if (fields === undefined) {
      return undefined;
    }
    const kind = fields.has("dgc") ? "dgc" : "declaredDgc";
    if (fields.has("dgc") === fields.has("declaredDgc")) {
      ctx.report("EXACTLY_ONE", itemPath, "Give either dgc or declaredDgc.");
      return undefined;
    }
    const code = digits(ctx, fields.get(kind), [...itemPath, kind], 16);
    if (!fields.has("label")) {
      ctx.report("REQUIRED", [...itemPath, "label"], "This field is required.");
      return undefined;
    }
    const label = text(ctx, fields.get("label"), [...itemPath, "label"], { max: 250 });
    if (code !== undefined && label !== undefined) {
      (kind === "dgc" ? dgc : declaredDgc).set(code, label);
    }
    return code;
  });
  return { dgc, declaredDgc };
}
