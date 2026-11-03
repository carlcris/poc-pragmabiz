import { Pressable, StyleSheet, Text } from "react-native";
import { colors } from "@/theme/colors";
import { borderRadius, spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";
import { primaryGlow } from "@/theme/elevation";

type ActionFooterButtonVariant = "primary" | "secondary" | "success" | "warning";

const FILLED_VARIANTS: ReadonlySet<ActionFooterButtonVariant> = new Set(["primary", "success"]);

export const ActionFooterButton = ({
  label,
  variant = "primary",
  disabled = false,
  grow = 1,
  onPress,
}: {
  label: string;
  variant?: ActionFooterButtonVariant;
  disabled?: boolean;
  grow?: number;
  onPress: () => void;
}) => {
  const filled = FILLED_VARIANTS.has(variant);
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.button,
        { flex: grow },
        styles[variant],
        disabled ? (filled ? styles.filledDisabled : styles.outlinedDisabled) : null,
        pressed && !disabled ? styles.pressed : null,
      ]}
    >
      <Text
        style={[
          styles.label,
          filled ? styles.filledLabel : null,
          variant === "secondary" ? styles.secondaryLabel : null,
          variant === "warning" ? styles.warningLabel : null,
          disabled ? styles.disabledLabel : null,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  button: {
    minHeight: 52,
    paddingHorizontal: spacing.base,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: borderRadius.full,
  },
  primary: {
    backgroundColor: colors.primary,
    ...primaryGlow,
  },
  success: {
    backgroundColor: colors.statusSuccess,
  },
  secondary: {
    borderWidth: 1.5,
    borderColor: colors.violetAvatar,
    backgroundColor: colors.surface,
  },
  warning: {
    borderWidth: 2,
    borderColor: colors.statusWarning,
    backgroundColor: colors.amberSoft,
  },
  filledDisabled: {
    backgroundColor: colors.backgroundSecondary,
    shadowOpacity: 0,
    elevation: 0,
  },
  outlinedDisabled: {
    borderColor: colors.divider,
  },
  pressed: {
    opacity: 0.85,
  },
  label: {
    fontSize: 16,
    fontWeight: typography.fontWeights.semibold,
  },
  filledLabel: {
    color: colors.surface,
  },
  secondaryLabel: {
    color: colors.primaryDark,
  },
  warningLabel: {
    color: colors.statusWarning,
  },
  disabledLabel: {
    color: colors.textSecondary,
  },
});
