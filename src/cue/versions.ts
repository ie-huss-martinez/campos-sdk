import type { Issue, Result } from "../issues.ts";

/** The versions of the CUE document the library can render. */
export const CUE_VERSIONS = ["3.11.4"] as const;

/** A version of the CUE document, named after the annex release that last changed it. */
export type CueVersion = (typeof CUE_VERSIONS)[number];

/**
 * Each version of Anexo VI the library has read, with the version of the CUE
 * document it carries ([ADR 0002](../../docs/adr/0002-scope-and-architecture.md)).
 * A release that changed only the transport carries the previous document.
 * Source: the change log of Anexo VI 4.10.0, of 27 October 2026.
 */
export const INTERFACE_VERSIONS: Readonly<Record<string, CueVersion>> = Object.freeze({
  "3.11.4": "3.11.4",
  "4.10.0": "3.11.4",
});

const unsupported = (message: string): Issue =>
  Object.freeze({ code: "UNSUPPORTED_VERSION", path: Object.freeze([]), message });

/**
 * Returns the version of the CUE document that a version of the interface
 * carries, such as the one a community's `version` method reports. A version
 * the library hasn't read is an issue, never a guess. UNVERIFIED: the format
 * of the `version` method's response; pass the version number alone, such as
 * `"4.10.0"`.
 */
export function cueVersionForInterface(interfaceVersion: string): Result<CueVersion> {
  const version = Object.hasOwn(INTERFACE_VERSIONS, interfaceVersion)
    ? INTERFACE_VERSIONS[interfaceVersion]
    : undefined;
  return version === undefined
    ? {
        ok: false,
        issues: Object.freeze([
          unsupported("The library hasn't read this version of the interface."),
        ]),
      }
    : { ok: true, value: version, issues: [] };
}

/** Whether a value names a CUE document version the library can render. */
export const isCueVersion = (value: unknown): value is CueVersion =>
  (CUE_VERSIONS as readonly unknown[]).includes(value);

export { unsupported };
