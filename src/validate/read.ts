import type { PathSegment } from "../issues.ts";
import { type Context, readList } from "./context.ts";
import { boolean, decimal, digits, integer, isoDate, isoTime, text } from "./fields.ts";
import { checkNif } from "./nif.ts";

/** A path to a value. */
export type Path = readonly PathSegment[];

/** Reads one value at a path, reporting issues to the context. */
export type Reader<T> = (ctx: Context, value: unknown, path: Path) => T | undefined;

/** The fields of an object, and where they are. */
export interface Fields {
  readonly ctx: Context;
  readonly path: Path;
  readonly values: ReadonlyMap<string, unknown>;
}

/** Reads an optional field. */
export const optional = <T>(f: Fields, name: string, read: Reader<T>): T | undefined => {
  const value = f.values.get(name);
  return value === undefined ? undefined : read(f.ctx, value, [...f.path, name]);
};

/** Reads a required field, reporting `REQUIRED` when it is missing. */
export const required = <T>(f: Fields, name: string, read: Reader<T>): T | undefined => {
  if (!f.values.has(name)) {
    f.ctx.report("REQUIRED", [...f.path, name], "This field is required.");
    return undefined;
  }
  return optional(f, name, read);
};

/** How many of the named fields are given. */
export const countGiven = (f: Fields, names: readonly string[]): number =>
  names.filter((name) => f.values.has(name)).length;

/** Builds a frozen object from the defined entries only. */
export const build = <T>(entries: Record<string, unknown>): T => {
  const out: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(entries)) {
    if (value !== undefined) {
      out[name] = value;
    }
  }
  return Object.freeze(out) as T;
};

export const textOf =
  (max: number, pattern?: RegExp): Reader<string> =>
  (ctx, value, path) =>
    text(ctx, value, path, pattern === undefined ? { max } : { max, pattern });

export const intOf =
  (max: number, min = 0): Reader<number> =>
  (ctx, value, path) =>
    integer(ctx, value, path, min, max);

export const decimalOf =
  (integerDigits: number, decimals: number): Reader<number> =>
  (ctx, value, path) =>
    decimal(ctx, value, path, integerDigits, decimals);

export const digitsOf =
  (maxDigits: number): Reader<string> =>
  (ctx, value, path) =>
    digits(ctx, value, path, maxDigits);

export const bool: Reader<boolean> = boolean;
export const date: Reader<string> = isoDate;
export const time: Reader<string> = isoTime;

/** A list of whole numbers, such as catalogue codes. */
export const intListOf =
  (max: number, maxItems: number, minItems = 0): Reader<readonly number[]> =>
  (ctx, value, path) => {
    const items = readList(ctx, value, path, minItems, maxItems, (item, itemPath) =>
      integer(ctx, item, itemPath, 0, max),
    );
    return items === undefined ? undefined : Object.freeze(items);
  };

/** A Spanish NIF, with its check character verified. */
export const nif: Reader<string> = (ctx, value, path) => {
  const textValue = text(ctx, value, path, { max: 20 });
  if (textValue === undefined) {
    return undefined;
  }
  const check = checkNif(textValue);
  if (check === "invalid-format") {
    ctx.report(
      "INVALID_FORMAT",
      path,
      "Expected a Spanish NIF in capitals, with no spaces or hyphens.",
    );
    return undefined;
  }
  if (check === "invalid-checksum") {
    ctx.report("INVALID_CHECKSUM", path, "The NIF's check character is wrong.");
    return undefined;
  }
  return textValue;
};
