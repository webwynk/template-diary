import { Monitor, Smartphone, Tablet } from "lucide-react";

/** Preview widths (DESIGN.md §7.5). Keys 1/2/3 switch between them. */
export const DEVICES = [
  { id: "desktop", label: "Desktop", width: 1440, icon: Monitor },
  { id: "tablet", label: "Tablet", width: 768, icon: Tablet },
  { id: "mobile", label: "Mobile", width: 375, icon: Smartphone },
] as const;

export type DeviceId = (typeof DEVICES)[number]["id"];

/** The device for a stored width (Settings → Preferences); unknown widths fall back to Desktop. */
export function deviceForWidth(width: number): DeviceId {
  return DEVICES.find((d) => d.width === width)?.id ?? "desktop";
}
