import { StyleSheet, Text, View } from "react-native";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";

export type ActionFooterNoteTone = "neutral" | "warning" | "error" | "success";

const NOTE_COLORS: Record<ActionFooterNoteTone, string> = {
  neutral: colors.textSecondary,
  warning: colors.statusWarning,
  error: colors.dangerDark,
  success: colors.statusSuccess,
};

export const ActionFooter = ({
  note,
  noteTone = "neutral",
  children,
}: {
  note?: string;
  noteTone?: ActionFooterNoteTone;
  children: React.ReactNode;
}) => (
  <View style={styles.footer}>
    {note ? (
      <Text
        style={[styles.note, { color: NOTE_COLORS[noteTone] }]}
        accessibilityLiveRegion="polite"
      >
        {note}
      </Text>
    ) : null}
    <View style={styles.actions}>{children}</View>
  </View>
);

const styles = StyleSheet.create({
  footer: {
    gap: spacing.sm,
    paddingHorizontal: spacing.base,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  note: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: typography.fontWeights.semibold,
  },
  actions: {
    flexDirection: "row",
    gap: spacing.md,
  },
});
