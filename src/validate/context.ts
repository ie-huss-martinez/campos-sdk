import type { Issue, IssueCode, PathSegment } from "../issues.ts";

/** Validation stops collecting after this many issues. */
export const MAX_ISSUES = 1000;

/** An object with more own fields than this is rejected without reading them. */
export const MAX_FIELDS = 64;

/** A field name is shown in an issue only if it looks like an identifier. */
const SHOWABLE_KEY = /^[A-Za-z_][A-Za-z0-9_]{0,63}$/;

/**
 * Collects the issues of one validation run, and the path to the value being
 * read.
 */
export class Context {
  readonly issues: Issue[] = [];
  #full = false;
  #recordId: number | undefined;

  /** Whether the issue limit was reached. */
  get full(): boolean {
    return this.#full;
  }

  /** Reports an issue at `path`. */
  report(code: IssueCode, path: readonly PathSegment[], message: string): void {
    if (this.#full) {
      return;
    }
    if (this.issues.length === MAX_ISSUES - 1) {
      this.#full = true;
      this.issues.push(
        Object.freeze({
          code: "TOO_MANY_ISSUES",
          path: Object.freeze([]),
          message: `Validation stopped after ${MAX_ISSUES - 1} issues.`,
        }),
      );
      return;
    }
    const issue: Issue =
      this.#recordId === undefined
        ? { code, path: Object.freeze([...path]), message }
        : { code, path: Object.freeze([...path]), recordId: this.#recordId, message };
    this.issues.push(Object.freeze(issue));
  }

  /** Runs `body` with issues tagged with an activity's identifier. */
  withRecord<T>(recordId: number | undefined, body: () => T): T {
    const previous = this.#recordId;
    this.#recordId = recordId;
    try {
      return body();
    } finally {
      this.#recordId = previous;
    }
  }
}

/** A field name as it may appear in an issue's path. */
export const showKey = (key: string): string => (SHOWABLE_KEY.test(key) ? key : "?");

/** Whether a value is a plain object: not null, not an array, not a function. */
export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Reads an object's own data fields, rejecting fields the model doesn't
 * define, accessors, and objects with too many fields. Returns a map from
 * field name to value, or undefined when the value isn't a usable object.
 */
export function readObject(
  ctx: Context,
  value: unknown,
  path: readonly PathSegment[],
  allowed: readonly string[],
): ReadonlyMap<string, unknown> | undefined {
  if (!isRecord(value)) {
    ctx.report("INVALID_TYPE", path, "Expected an object.");
    return undefined;
  }
  const keys = Object.keys(value);
  if (keys.length > MAX_FIELDS) {
    ctx.report("INVALID_LENGTH", path, `An object may have at most ${MAX_FIELDS} fields.`);
    return undefined;
  }
  const fields = new Map<string, unknown>();
  for (const key of keys) {
    if (!allowed.includes(key)) {
      ctx.report("UNKNOWN_FIELD", [...path, showKey(key)], "The model doesn't define this field.");
      continue;
    }
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor === undefined || !("value" in descriptor)) {
      ctx.report("INVALID_TYPE", [...path, key], "Expected a data field, not an accessor.");
      continue;
    }
    if (descriptor.value !== undefined) {
      fields.set(key, descriptor.value);
    }
  }
  return fields;
}

/**
 * Reads a list of at least `min` and at most `max` items, calling `item` for
 * each. Returns the items `item` accepted, or undefined when the value isn't
 * a usable list.
 */
export function readList<T>(
  ctx: Context,
  value: unknown,
  path: readonly PathSegment[],
  min: number,
  max: number,
  item: (value: unknown, path: readonly PathSegment[], index: number) => T | undefined,
): T[] | undefined {
  if (!Array.isArray(value)) {
    ctx.report("INVALID_TYPE", path, "Expected a list.");
    return undefined;
  }
  if (value.length < min || value.length > max) {
    ctx.report(
      value.length < min ? "AT_LEAST_ONE" : "INVALID_LENGTH",
      path,
      `Expected from ${min} to ${max} items.`,
    );
    return undefined;
  }
  const out: T[] = [];
  for (let index = 0; index < value.length && !ctx.full; index += 1) {
    const result = item(value[index], [...path, index], index);
    if (result !== undefined) {
      out.push(result);
    }
  }
  return out;
}
