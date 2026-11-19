import { z } from "zod";

// Settings → Preferences (DESIGN.md §7.8), matching user_settings (DEVELOPMENT.md §5.2):
// default_device in (1440, 768, 375); default_feature_mode is a feature_image_source other
// than 'none'.
export const DEVICE_WIDTHS = [1440, 768, 375] as const;
export const FEATURE_MODES = ["auto", "upload"] as const;

export const preferencesSchema = z.object({
  defaultDevice: z.union([z.literal(1440), z.literal(768), z.literal(375)]),
  defaultFeatureMode: z.enum(FEATURE_MODES),
});

export type Preferences = z.infer<typeof preferencesSchema>;

export const DEFAULT_PREFERENCES: Preferences = { defaultDevice: 1440, defaultFeatureMode: "auto" };
