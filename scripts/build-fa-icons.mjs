// Builds lib/icons/fa-free.json, the Text tab's Font Awesome Free 6 picker list
// (DEVELOPMENT.md §7 "Text tab", T3). Run with the metadata of the Font Awesome version the
// picker previews (FA_CSS_URL in components/editor/text/icon-picker.tsx):
//   npm pack @fortawesome/fontawesome-free@6.7.2 && tar xzf fortawesome-fontawesome-free-6.7.2.tgz
//   node scripts/build-fa-icons.mjs package/metadata/icon-families.json
import { readFileSync, writeFileSync } from "node:fs";

const source = process.argv[2];
if (!source) throw new Error("Pass the path to metadata/icon-families.json");
const data = JSON.parse(readFileSync(source, "utf8"));
const STYLE = { solid: "s", regular: "r", brands: "b" };
const list = [];
for (const [name, icon] of Object.entries(data)) {
  const styles = (icon.familyStylesByLicense?.free ?? [])
    .filter((f) => f.family === "classic" && STYLE[f.style])
    .map((f) => STYLE[f.style])
    .join("");
  if (!styles) continue;
  const terms = [...new Set((icon.search?.terms ?? []).map((t) => String(t).toLowerCase()))]
    .filter((t) => !name.includes(t))
    .slice(0, 6)
    .join(" ");
  list.push(terms ? [name, styles, terms] : [name, styles]);
}
list.sort((a, b) => a[0].localeCompare(b[0]));
writeFileSync("lib/icons/fa-free.json", `${JSON.stringify(list)}\n`);
console.log(`${list.length} icons`);
