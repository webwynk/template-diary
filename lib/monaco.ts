// Monaco is served from our own domain (scripts/copy-monaco.mjs copies it to public/ on install).
// Keep in sync with package.json; lib/monaco.test.ts fails if they drift.
export const MONACO_VERSION = "0.57.0";
export const MONACO_VS_PATH = `/monaco/${MONACO_VERSION}/vs`;
