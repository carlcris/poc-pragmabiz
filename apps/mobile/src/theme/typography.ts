// Professional typography system following mobile design standards
import { Platform } from "react-native";

const fontWeights = {
  regular: "400" as const,
  medium: "500" as const,
  semibold: "600" as const,
  bold: "700" as const,
  extrabold: "800" as const
};

// Standard font sizes following 4px baseline grid (based on dashboard)
const fontSizes = {
  xs: 10,    // Section titles, captions
  sm: 11,    // Small body text, hints
  base: 13,  // Standard body text
  lg: 16,    // Action titles, labels
  xl: 20,    // Card titles
  "2xl": 24, // Count numbers
  "3xl": 28, // Metric values
  "4xl": 32,
  "5xl": 36,
  "6xl": 40
};

// Line heights for optimal readability
const lineHeights = {
  tight: 1.25,
  normal: 1.5,
  relaxed: 1.75
};

// Letter spacing for better readability
const letterSpacing = {
  tighter: -0.5,
  tight: -0.25,
  normal: 0,
  wide: 0.25,
  wider: 0.5
};

// Text style presets
export const typography = {
  // Display styles - for large headings
  displayLarge: {
    fontSize: fontSizes["6xl"],
    fontWeight: fontWeights.bold,
    lineHeight: fontSizes["6xl"] * lineHeights.tight,
    letterSpacing: letterSpacing.tight
  },
  displayMedium: {
    fontSize: fontSizes["5xl"],
    fontWeight: fontWeights.bold,
    lineHeight: fontSizes["5xl"] * lineHeights.tight,
    letterSpacing: letterSpacing.tight
  },

  // Heading styles
  heading1: {
    fontSize: fontSizes["4xl"],
    fontWeight: fontWeights.bold,
    lineHeight: fontSizes["4xl"] * lineHeights.tight,
    letterSpacing: letterSpacing.tight
  },
  heading2: {
    fontSize: fontSizes["3xl"],
    fontWeight: fontWeights.bold,
    lineHeight: fontSizes["3xl"] * lineHeights.tight,
    letterSpacing: letterSpacing.normal
  },
  heading3: {
    fontSize: fontSizes["2xl"],
    fontWeight: fontWeights.semibold,
    lineHeight: fontSizes["2xl"] * lineHeights.normal,
    letterSpacing: letterSpacing.normal
  },

  // Title styles
  title: {
    fontSize: fontSizes.xl,
    fontWeight: fontWeights.semibold,
    lineHeight: fontSizes.xl * lineHeights.normal,
    letterSpacing: letterSpacing.normal
  },
  titleSmall: {
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.semibold,
    lineHeight: fontSizes.lg * lineHeights.normal,
    letterSpacing: letterSpacing.normal
  },

  // Body text styles
  bodyLarge: {
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.regular,
    lineHeight: fontSizes.lg * lineHeights.normal,
    letterSpacing: letterSpacing.normal
  },
  body: {
    fontSize: fontSizes.base,
    fontWeight: fontWeights.regular,
    lineHeight: fontSizes.base * lineHeights.normal,
    letterSpacing: letterSpacing.normal
  },
  bodySmall: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.regular,
    lineHeight: fontSizes.sm * lineHeights.normal,
    letterSpacing: letterSpacing.normal
  },

  // Label styles
  label: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.medium,
    lineHeight: fontSizes.sm * lineHeights.normal,
    letterSpacing: letterSpacing.wide
  },
  labelSmall: {
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.medium,
    lineHeight: fontSizes.xs * lineHeights.normal,
    letterSpacing: letterSpacing.wide
  },

  // Button text
  button: {
    fontSize: fontSizes.base,
    fontWeight: fontWeights.semibold,
    lineHeight: fontSizes.base * lineHeights.tight,
    letterSpacing: letterSpacing.wide
  },
  buttonLarge: {
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.semibold,
    lineHeight: fontSizes.lg * lineHeights.tight,
    letterSpacing: letterSpacing.wide
  },

  // Caption/helper text
  caption: {
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.regular,
    lineHeight: fontSizes.xs * lineHeights.normal,
    letterSpacing: letterSpacing.normal
  },

  // Utility exports
  fontSizes,
  fontWeights,
  lineHeights,
  letterSpacing
};

// System font stacks for best platform support
export const fontFamily = Platform.select({
  ios: {
    regular: "System",
    medium: "System",
    semibold: "System",
    bold: "System"
  },
  android: {
    regular: "Roboto",
    medium: "Roboto-Medium",
    semibold: "Roboto-Medium",
    bold: "Roboto-Bold"
  },
  default: {
    regular: undefined,
    medium: undefined,
    semibold: undefined,
    bold: undefined
  }
});
