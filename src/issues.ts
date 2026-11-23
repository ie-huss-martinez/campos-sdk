/**
 * The codes an {@link Issue} can carry. They are part of the public API:
 * a code is never renamed or reused, and an application can map each one to
 * its own text for users.
 */
export const ISSUE_CODES = [
  /** A value has the wrong type, such as a number where text is expected. */
  "INVALID_TYPE",
  /** A required field is missing. */
  "REQUIRED",
  /** An object has a field the model doesn't define. */
  "UNKNOWN_FIELD",
  /** Text, or a list, is shorter or longer than allowed. */
  "INVALID_LENGTH",
  /** A number is outside its allowed range. */
  "OUT_OF_RANGE",
  /** A number has more decimal places than allowed. */
  "TOO_MANY_DECIMALS",
  /** Text doesn't have the required format, such as a REA code or a time. */
  "INVALID_FORMAT",
  /** A date isn't a real calendar date in the `YYYY-MM-DD` format. */
  "INVALID_DATE",
  /** A tax identifier's check character is wrong. */
  "INVALID_CHECKSUM",
  /** Text holds a control or invisible character. */
  "INVALID_CHARACTER",
  /** An end date is before its start date. */
  "DATE_ORDER",
  /** Exactly one of several alternative fields must be given. */
  "EXACTLY_ONE",
  /** Two fields that exclude each other are both given. */
  "CONFLICT",
  /** At least one of several fields, or one item of a list, must be given. */
  "AT_LEAST_ONE",
  /** Two records of the same kind have the same identifier. */
  "DUPLICATE_ID",
  /** A code isn't in the catalogue snapshot the application supplied. */
  "UNKNOWN_CODE",
  /** A code was retired from its catalogue on or before the record's date. */
  "RETIRED_CODE",
  /** Validation stopped after this many issues; there may be more. */
  "TOO_MANY_ISSUES",
  /** The target document version requires a value the model leaves optional. */
  "REQUIRED_BY_TARGET",
  /** The target document version can't represent a value the model holds. */
  "NOT_REPRESENTABLE",
  /** The requested document or interface version isn't one the library supports. */
  "UNSUPPORTED_VERSION",
] as const;

/** A stable code that says what kind of problem an {@link Issue} reports. */
export type IssueCode = (typeof ISSUE_CODES)[number];

/** A step in the path to a value: a field name, or an index in a list. */
export type PathSegment = string | number;

/**
 * One problem found in the input. It says where the problem is and what kind
 * it is, but never contains the value itself, so an application can log it
 * without logging tax identifiers or names.
 */
export interface Issue {
  /** What kind of problem this is. */
  readonly code: IssueCode;
  /**
   * Where it is, from the root of the input: field names and list indexes,
   * such as `["treatments", 3, "products", 0, "dose"]`. The name of a field
   * the model doesn't define is given only when it looks like an identifier
   * of at most 64 characters; otherwise the segment is `"?"`.
   */
  readonly path: readonly PathSegment[];
  /**
   * The identifier of the activity the problem belongs to, when the activity
   * has a valid one, such as a treatment's `id`.
   */
  readonly recordId?: number;
  /** A description in English, for developers. It never contains input. */
  readonly message: string;
}

/** The outcome of an operation that either succeeds or reports issues. */
export type Result<T> =
  | { readonly ok: true; readonly value: T; readonly issues: readonly [] }
  | { readonly ok: false; readonly issues: readonly Issue[] };
