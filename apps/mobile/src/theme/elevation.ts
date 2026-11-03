import { colors } from "./colors";

// Android elevation shadows take shadowColor (API 28+), keeping the violet tint on both platforms.
export const softShadow = {
  shadowColor: colors.primaryDark,
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.06,
  shadowRadius: 3,
  elevation: 1
};

export const primaryGlow = {
  shadowColor: colors.primary,
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 0.28,
  shadowRadius: 12,
  elevation: 4
};
