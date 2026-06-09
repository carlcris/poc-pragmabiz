import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Card, Screen } from "@/components/ui";
import { colors } from "@/theme/colors";
import { spacing, borderRadius } from "@/theme/spacing";
import { typography } from "@/theme/typography";

export default function MoreScreen() {
  return (
    <Screen title="More" subtitle="Additional features">
      <Card style={styles.menuCard}>
        <FeatureItem
          icon="scan-outline"
          title="Scan Item Info"
          subtitle="Scan a product QR code and view item details"
          onPress={() => router.push("/more/item-info")}
        />
      </Card>
    </Screen>
  );
}

const FeatureItem = ({
  icon,
  title,
  subtitle,
  onPress
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  onPress: () => void;
}) => (
  <Pressable
    onPress={onPress}
    style={({ pressed }) => [styles.featureItem, pressed ? styles.featureItemPressed : null]}
  >
    <View style={styles.featureIcon}>
      <Ionicons name={icon} size={22} color={colors.primary} />
    </View>
    <View style={styles.featureText}>
      <Text style={styles.featureTitle}>{title}</Text>
      <Text style={styles.featureSubtitle}>{subtitle}</Text>
    </View>
    <Ionicons name="chevron-forward" size={20} color={colors.muted} />
  </Pressable>
);

const styles = StyleSheet.create({
  menuCard: {
    padding: 0,
    overflow: "hidden"
  },
  featureItem: {
    minHeight: 76,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.base,
    backgroundColor: colors.surface
  },
  featureItemPressed: {
    backgroundColor: colors.faint
  },
  featureIcon: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.base,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center"
  },
  featureText: {
    flex: 1,
    gap: spacing.xs
  },
  featureTitle: {
    ...typography.titleSmall,
    color: colors.text
  },
  featureSubtitle: {
    ...typography.bodySmall,
    color: colors.textSecondary
  }
});
