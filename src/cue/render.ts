import type { Result } from "../issues.ts";
import type { ValidLogbook } from "../model.ts";
import { renderCue3114 } from "./v3-11-4.ts";
import { type CueVersion, isCueVersion, unsupported } from "./versions.ts";

/** A rendered CUE document. */
export interface CueDocument {
  /** The version of the CUE document it follows. Store it with the document. */
  readonly version: CueVersion;
  /** The document, as compact JSON. The same logbook always gives the same text. */
  readonly json: string;
}

/** Options for {@link renderCue}. */
export interface RenderCueOptions {
  /**
   * The version of the CUE document to write. There is no default: name the
   * version the community you send to accepts, for example with
   * {@link cueVersionForInterface}.
   */
  readonly version: CueVersion;
}

/**
 * Renders a validated logbook as a CUE document, the body of an IUWS `crear`
 * call. Returns the issues instead when the version can't hold the logbook,
 * such as a value the version requires that the model leaves optional.
 */
export function renderCue(logbook: ValidLogbook, options: RenderCueOptions): Result<CueDocument> {
  if (!isCueVersion(options.version)) {
    return {
      ok: false,
      issues: Object.freeze([unsupported("The library can't render this CUE document version.")]),
    };
  }
  const { json, issues } = renderCue3114(logbook);
  return issues.length > 0
    ? { ok: false, issues: Object.freeze([...issues]) }
    : { ok: true, value: Object.freeze({ version: options.version, json }), issues: [] };
}
