#!/usr/bin/env node
// Adds a shadcn/ui component by copying its source from the shadcn GitHub repo.
// Why: the shadcn CLI needs ui.shadcn.com, which the Claude cloud environment can't reach.
// On your own machine you can use `npx shadcn@latest add <name>` instead.
//
// Usage: node scripts/add-ui.mjs dialog tooltip
// After adding: review the file, install any missing npm deps it imports, and adapt it
// to DESIGN.md (no `dark:` classes; this script strips them automatically).
import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const BASE = "https://raw.githubusercontent.com/shadcn-ui/ui/main/apps/v4/registry/new-york-v4/ui";
const names = process.argv.slice(2);
if (names.length === 0) {
  console.error("Usage: node scripts/add-ui.mjs <component> [...]");
  process.exit(1);
}

for (const name of names) {
  if (!/^[a-z0-9-]+$/.test(name)) throw new Error(`Invalid component name: ${name}`);
  const target = join("components", "ui", `${name}.tsx`);
  if (existsSync(target)) {
    console.log(`skip  ${target} (already exists)`);
    continue;
  }
  const res = await fetch(`${BASE}/${name}.tsx`);
  if (!res.ok) throw new Error(`Could not fetch ${name}: HTTP ${res.status}`);
  const source = (await res.text())
    .replace(/from "cn"/g, 'from "@/lib/utils"')
    .replace(/from "@\/registry\/new-york-v4\/ui\//g, 'from "@/components/ui/')
    .replace(/\s?dark:[^\s"'`]+/g, "");
  writeFileSync(target, source);
  const imports = [...source.matchAll(/from "([^"./@][^"]*|@[^"/]+\/[^"]+)"/g)].map((m) => m[1]);
  console.log(`added ${target}  (imports: ${[...new Set(imports)].join(", ")})`);
}
