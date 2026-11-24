/**
 * A small JSON writer for the documents the library renders. It writes keys
 * in the order they were added and nothing else, so the same input gives the
 * same bytes. It can also write an integer given as decimal digits, which
 * `JSON.stringify` can't do for integers larger than a JavaScript number holds
 * exactly.
 */

/** An integer written from its decimal digits, exactly. */
export interface RawInteger {
  readonly rawInteger: string;
}

/** A value the writer can write. Objects keep their keys' insertion order. */
export type JsonValue =
  | boolean
  | number
  | string
  | RawInteger
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };

/** Wraps an integer's decimal digits, already validated, for {@link writeJson}. */
export const rawInteger = (digits: string): RawInteger => ({ rawInteger: digits });

const isRawInteger = (value: object): value is RawInteger =>
  Object.keys(value).length === 1 && "rawInteger" in value;

/** Writes a value as compact JSON. */
export function writeJson(value: JsonValue): string {
  if (typeof value === "string" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new RangeError("JSON has no representation for this number.");
    }
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => writeJson(item)).join(",")}]`;
  }
  if (isRawInteger(value)) {
    if (!/^(0|[1-9]\d*)$/.test(value.rawInteger)) {
      throw new RangeError("A raw integer must be decimal digits with no leading zero.");
    }
    return value.rawInteger;
  }
  const members = Object.entries(value).map(
    ([key, member]) => `${JSON.stringify(key)}:${writeJson(member)}`,
  );
  return `{${members.join(",")}}`;
}
