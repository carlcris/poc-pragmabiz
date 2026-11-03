import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Screen } from "@/components/ui";
import { colors } from "@/theme/colors";
import { borderRadius } from "@/theme/spacing";
import { typography } from "@/theme/typography";

export default function MoreScreen() {
  return (
    <Screen title="More">
      <FeatureBanner
        icon="scan-outline"
        title="Scan Item Info"
        subtitle="Scan a product QR code and view item details"
        onPress={() => router.push("/more/item-info")}
      />
    </Screen>
  );
}

const FeatureBanner = ({
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
    accessibilityRole="button"
    style={({ pressed }) => [styles.banner, pressed ? styles.bannerPressed : null]}
  >
    <View style={styles.bannerCircle} />
    <View style={styles.bannerArt} importantForAccessibility="no-hide-descendants">
      <Ionicons name={icon} size={64} color={colors.violet} />
    </View>
    <Text style={styles.bannerTitle}>{title}</Text>
    <Text style={styles.bannerSubtitle}>{subtitle}</Text>
    <View style={styles.bannerAction}>
      <Ionicons name="arrow-forward" size={18} color={colors.surface} />
    </View>
  </Pressable>
);

const styles = StyleSheet.create({
  banner: {
    overflow: "hidden",
    gap: 6,
    padding: 18,
    borderRadius: 22,
    backgroundColor: colors.violetSoft,
    shadowColor: colors.primaryDark,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 6
  },
  bannerPressed: {
    opacity: 0.8
  },
  bannerCircle: {
    position: "absolute",
    right: -30,
    bottom: -40,
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: colors.violet,
    opacity: 0.12
  },
  bannerArt: {
    position: "absolute",
    right: 22,
    top: 22,
    transform: [{ rotate: "8deg" }]
  },
  bannerTitle: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: typography.fontWeights.bold,
    color: colors.text
  },
  bannerSubtitle: {
    maxWidth: 210,
    fontSize: 13,
    lineHeight: 19,
    color: colors.textSecondary
  },
  bannerAction: {
    marginTop: 6,
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primaryDark,
    alignItems: "center",
    justifyContent: "center"
  }
});
