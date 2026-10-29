import { Pressable, StyleSheet, Text } from "react-native";
import { colors } from "@/theme/colors";
import { borderRadius, spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";

export const ReceivingFooterButton = ({
  label,
  variant = "primary",
  disabled = false,
  grow = 1,
  onPress,
}: {
  label: string;
  variant?: "primary" | "secondary";
  disabled?: boolean;
  grow?: number;
  onPress: () => void;
}) => (
  <Pressable
    onPress={onPress}
    disabled={disabled}
    accessibilityRole="button"
    accessibilityState={{ disabled }}
    style={({ pressed }) => [
      styles.button,
      { flex: grow },
      variant === "primary" ? styles.primary : styles.secondary,
      disabled ? (variant === "primary" ? styles.primaryDisabled : styles.secondaryDisabled) : null,
      pressed && !disabled ? styles.pressed : null,
    ]}
  >
    <Text
      style={[
        styles.label,
        variant === "primary" ? styles.primaryLabel : styles.secondaryLabel,
        disabled ? styles.disabledLabel : null,
      ]}
    >
      {label}
    </Text>
  </Pressable>
);

const styles = StyleSheet.create({
  button: {
    minHeight: 52,
    paddingHorizontal: spacing.base,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: borderRadius.md,
  },
  primary: {
    backgroundColor: colors.primaryDark,
  },
  primaryDisabled: {
    backgroundColor: colors.backgroundSecondary,
  },
  secondary: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  secondaryDisabled: {
    borderColor: colors.divider,
  },
  pressed: {
    opacity: 0.85,
  },
  label: {
    fontSize: 16,
    fontWeight: typography.fontWeights.semibold,
  },
  primaryLabel: {
    color: colors.surface,
  },
  secondaryLabel: {
    color: colors.text,
  },
  disabledLabel: {
    color: colors.textSecondary,
  },
});
