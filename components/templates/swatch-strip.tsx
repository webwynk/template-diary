/**
 * A row of small color swatches (DESIGN.md §8 Swatch: checkerboard, 1px border, never color
 * alone: the hex values are the accessible label and the tooltip).
 */
export function SwatchStrip({ colors }: { colors: string[] }) {
  if (colors.length === 0) return null;
  return (
    <ul
      className="flex items-center gap-1"
      aria-label={`Colors: ${colors.join(", ")}`}
      title={colors.join("  ")}
    >
      {colors.map((hex) => (
        <li
          key={hex}
          className="size-4 rounded-[4px] border border-border"
          style={{
            backgroundImage: `linear-gradient(${hex}, ${hex}), conic-gradient(#e2e8f0 25%, #fff 0 50%, #e2e8f0 0 75%, #fff 0)`,
            backgroundSize: "100% 100%, 8px 8px",
          }}
        />
      ))}
    </ul>
  );
}
