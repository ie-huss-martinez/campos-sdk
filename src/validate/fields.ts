import type { PathSegment } from "../issues.ts";
import type { Context } from "./context.ts";

type Path = readonly PathSegment[];

/**
 * Characters that are controls, formatting characters or default-ignorable
 * in Unicode: line breaks and tabs, bidirectional controls, zero-width and
 * other invisible characters, variation selectors and tag characters, plus
 * the line and paragraph separators. None belongs in a farm record, and each
 * can hide or disguise text in a printed or exported document.
 */
const FORBIDDEN_CHARACTERS = /[\p{Cc}\p{Cf}\p{Default_Ignorable_Code_Point}\u2028\u2029]/u;

/** Length in Unicode code points, as JSON Schema's `maxLength` counts it. */
const codePoints = (text: string): number => {
  let count = 0;
  for (const _ of text) {
    count += 1;
  }
  return count;
};

/** Reads required text when `required`, else optional text. */
export function text(
  ctx: Context,
  value: unknown,
  path: Path,
  options: { readonly min?: number; readonly max: number; readonly pattern?: RegExp },
): string | undefined {
  if (typeof value !== "string") {
    ctx.report("INVALID_TYPE", path, "Expected text.");
    return undefined;
  }
  // The length is checked first, so the pattern never runs on long input.
  const length = value.length > options.max * 2 ? Number.POSITIVE_INFINITY : codePoints(value);
  const min = options.min ?? 1;
  if (length < min || length > options.max) {
    ctx.report("INVALID_LENGTH", path, `Expected from ${min} to ${options.max} characters.`);
    return undefined;
  }
  if (FORBIDDEN_CHARACTERS.test(value)) {
    ctx.report("INVALID_CHARACTER", path, "Text may not hold control or invisible characters.");
    return undefined;
  }
  if (options.pattern !== undefined && !options.pattern.test(value)) {
    ctx.report("INVALID_FORMAT", path, "The text doesn't have the required format.");
    return undefined;
  }
  return value;
}

/** Reads a whole number from `min` to `max`. */
export function integer(
  ctx: Context,
  value: unknown,
  path: Path,
  min: number,
  max: number,
): number | undefined {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    ctx.report("INVALID_TYPE", path, "Expected a whole number.");
    return undefined;
  }
  if (value < min || value > max) {
    ctx.report("OUT_OF_RANGE", path, `Expected a number from ${min} to ${max}.`);
    return undefined;
  }
  return value;
}

/**
 * Reads a non-negative decimal with at most `integerDigits` digits before the
 * point and `decimals` after it, the precision of the official `number(p,s)`
 * types. A value such as 0.1 + 0.2 has too many decimals: round it first.
 */
export function decimal(
  ctx: Context,
  value: unknown,
  path: Path,
  integerDigits: number,
  decimals: number,
): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    ctx.report("INVALID_TYPE", path, "Expected a number.");
    return undefined;
  }
  const max = 10 ** integerDigits - 10 ** -decimals;
  if (value < 0 || value > max + 1e-9) {
    ctx.report(
      "OUT_OF_RANGE",
      path,
      `Expected a number from 0 to ${integerDigits} digits and ${decimals} decimals.`,
    );
    return undefined;
  }
  const [, fraction = ""] = String(value).split(".");
  if (fraction.length > decimals || String(value).includes("e")) {
    ctx.report("TOO_MANY_DECIMALS", path, `Expected at most ${decimals} decimal places.`);
    return undefined;
  }
  return value;
}

/** Reads `true` or `false`. */
export function boolean(ctx: Context, value: unknown, path: Path): boolean | undefined {
  if (typeof value !== "boolean") {
    ctx.report("INVALID_TYPE", path, "Expected true or false.");
    return undefined;
  }
  return value;
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

const daysInMonth = (year: number, month: number): number =>
  month === 2
    ? year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
      ? 29
      : 28
    : [4, 6, 9, 11].includes(month)
      ? 30
      : 31;

/** Reads a calendar date as `YYYY-MM-DD`, from 1900 to 2999. */
export function isoDate(ctx: Context, value: unknown, path: Path): string | undefined {
  if (typeof value !== "string") {
    ctx.report("INVALID_TYPE", path, "Expected a date as text, YYYY-MM-DD.");
    return undefined;
  }
  const match = value.length === 10 ? ISO_DATE.exec(value) : null;
  const year = Number(match?.[1]);
  const month = Number(match?.[2]);
  const day = Number(match?.[3]);
  if (
    match === null ||
    year < 1900 ||
    year > 2999 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > daysInMonth(year, month)
  ) {
    ctx.report("INVALID_DATE", path, "Expected a real calendar date, YYYY-MM-DD.");
    return undefined;
  }
  return value;
}

/** Reads a time of day as `HH:MM:SS`. */
export function isoTime(ctx: Context, value: unknown, path: Path): string | undefined {
  return text(ctx, value, path, {
    min: 8,
    max: 8,
    pattern: /^([01]\d|2[0-3]):[0-5]\d:[0-5]\d$/,
  });
}

/**
 * Reads an identifier written as decimal digits, with no leading zero, of at
 * most `maxDigits` digits. Codes of up to 16 digits don't fit a JavaScript
 * number exactly, so the model keeps them as text.
 */
export function digits(
  ctx: Context,
  value: unknown,
  path: Path,
  maxDigits: number,
): string | undefined {
  return text(ctx, value, path, {
    max: maxDigits,
    pattern: /^(0|[1-9]\d*)$/,
  });
}

/** Reports `DATE_ORDER` when `end` is before `start`. Both are ISO dates. */
export function dateOrder(
  ctx: Context,
  start: string | undefined,
  end: string | undefined,
  path: Path,
): void {
  if (start !== undefined && end !== undefined && end < start) {
    ctx.report("DATE_ORDER", path, "The end date is before the start date.");
  }
}
