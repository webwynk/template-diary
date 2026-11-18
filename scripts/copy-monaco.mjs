#!/usr/bin/env node
// Copies Monaco's prebuilt editor (node_modules/monaco-editor/min/vs) into public/ so the code
// editor loads from our own domain instead of a CDN. Runs on `npm install` (postinstall).
// The folder is versioned so browsers never mix files from two Monaco versions.
import { cpSync, existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";

const pkg = JSON.parse(readFileSync(join("node_modules", "monaco-editor", "package.json"), "utf8"));
const source = join("node_modules", "monaco-editor", "min", "vs");
const root = join("public", "monaco");
const target = join(root, pkg.version, "vs");

if (existsSync(target)) {
  console.log(`monaco ${pkg.version} already in ${target}`);
} else {
  rmSync(root, { recursive: true, force: true });
  cpSync(source, target, { recursive: true });
  console.log(`copied monaco ${pkg.version} to ${target}`);
}
