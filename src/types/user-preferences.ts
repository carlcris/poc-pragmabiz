export type FontSize = "small" | "medium" | "large" | "extra-large";
export type Theme = "light" | "dark" | "auto";

export interface UserPreferences {
  id: string;
  userId: string;
  fontSize: FontSize;
  theme: Theme;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateUserPreferencesRequest {
  fontSize?: FontSize;
  theme?: Theme;
}

// Font size to CSS rem mapping
export const FONT_SIZE_MAP: Record<FontSize, string> = {
  small: "0.875rem", // 14px
  medium: "1rem", // 16px (default)
  large: "1.125rem", // 18px
  "extra-large": "1.25rem", // 20px
};

// Font size display labels
export const FONT_SIZE_LABELS: Record<FontSize, string> = {
  small: "Small",
  medium: "Medium",
  large: "Large",
  "extra-large": "Extra Large",
};
