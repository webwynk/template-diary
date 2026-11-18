import { readFileSync } from "node:fs";

import { MONACO_VERSION } from "@/lib/monaco";

it("MONACO_VERSION matches the installed monaco-editor", () => {
  const pkg = JSON.parse(readFileSync("node_modules/monaco-editor/package.json", "utf8")) as {
    version: string;
  };
  expect(MONACO_VERSION).toBe(pkg.version);
});
