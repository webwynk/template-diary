/** "Hero dark" + "Robo website section" → "hero-dark-robo-website-section" (DEVELOPMENT.md Phase 4). */
export function slugify(text: string, max = 80): string {
  const slug = text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, max)
    .replace(/-+$/g, "");
  return slug || "template";
}

export function downloadFilename(
  templateName: string,
  variationName: string,
  type: "custom" | "elementor",
): string {
  return `${slugify(`${templateName} ${variationName}`)}.${type === "elementor" ? "json" : "html"}`;
}
