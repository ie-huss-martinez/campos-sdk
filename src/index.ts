/**
 * Builds Spain's Cuaderno Digital de Explotación Agrícola (CUE) from typed
 * records of a holding. See docs/adr/0002-scope-and-architecture.md.
 *
 * @packageDocumentation
 */

export type { CatalogueEntry, CatalogueName, CatalogueSnapshot } from "./catalogues.ts";
export { CATALOGUE_NAMES } from "./catalogues.ts";
export type { CueDocument, RenderCueOptions } from "./cue/render.ts";
export { renderCue } from "./cue/render.ts";
export type { CueVersion } from "./cue/versions.ts";
export { CUE_VERSIONS, cueVersionForInterface, INTERFACE_VERSIONS } from "./cue/versions.ts";
export type { Issue, IssueCode, PathSegment, Result } from "./issues.ts";
export { ISSUE_CODES } from "./issues.ts";
export type * from "./model.ts";
export type { ValidateOptions } from "./validate.ts";
export { validateLogbook } from "./validate.ts";
