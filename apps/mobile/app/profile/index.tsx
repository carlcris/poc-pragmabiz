import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { Card, Screen } from "@/components/ui";
import { useAuthStore } from "@/stores/authStore";
import { colors } from "@/theme/colors";
import { spacing, borderRadius } from "@/theme/spacing";
import { typography } from "@/theme/typography";

export default function ProfileScreen() {
  const { session, logout } = useAuthStore();
  const user = session?.user;

  const handleLogout = () => {
    Alert.alert(
      "Sign Out",
      "Are you sure you want to sign out?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign Out",
          style: "destructive",
          onPress: async () => {
            await logout();
            router.replace("/login");
          }
        }
      ]
    );
  };

  return (
    <Screen title="Profile" subtitle="Account Settings">
      <Card style={styles.profileCard}>
        <View style={styles.avatarContainer}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={40} color={colors.primary} />
          </View>
        </View>
        <Text style={styles.userName}>
          {user?.firstName && user?.lastName
            ? `${user.firstName} ${user.lastName}`
            : user?.name || "User"}
        </Text>
        <Text style={styles.userEmail}>{user?.email || ""}</Text>
        <View style={styles.roleBadge}>
          <Text style={styles.roleBadgeText}>{user?.role || "Staff"}</Text>
        </View>
      </Card>

      <Text style={styles.sectionTitle}>ACCOUNT</Text>

      <Card style={styles.menuCard}>
        <MenuItem
          icon="person-outline"
          label="Personal Information"
          onPress={() => {}}
        />
        <View style={styles.divider} />
        <MenuItem
          icon="lock-closed-outline"
          label="Change Password"
          onPress={() => {}}
        />
        <View style={styles.divider} />
        <MenuItem
          icon="notifications-outline"
          label="Notifications"
          onPress={() => {}}
        />
      </Card>

      <Text style={styles.sectionTitle}>PREFERENCES</Text>

      <Card style={styles.menuCard}>
        <MenuItem
          icon="moon-outline"
          label="Dark Mode"
          onPress={() => {}}
          rightElement={<Text style={styles.valueText}>Off</Text>}
        />
        <View style={styles.divider} />
        <MenuItem
          icon="language-outline"
          label="Language"
          onPress={() => {}}
          rightElement={<Text style={styles.valueText}>English</Text>}
        />
      </Card>

      <Text style={styles.sectionTitle}>SUPPORT</Text>

      <Card style={styles.menuCard}>
        <MenuItem
          icon="help-circle-outline"
          label="Help Center"
          onPress={() => {}}
        />
        <View style={styles.divider} />
        <MenuItem
          icon="document-text-outline"
          label="Terms & Privacy"
          onPress={() => {}}
        />
        <View style={styles.divider} />
        <MenuItem
          icon="information-circle-outline"
          label="About"
          onPress={() => {}}
          rightElement={<Text style={styles.valueText}>v1.0.0</Text>}
        />
      </Card>

      <Pressable onPress={handleLogout} style={styles.logoutButton}>
        <Ionicons name="log-out-outline" size={20} color={colors.danger} />
        <Text style={styles.logoutText}>Sign Out</Text>
      </Pressable>
    </Screen>
  );
}

const MenuItem = ({
  icon,
  label,
  onPress,
  rightElement
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  rightElement?: React.ReactNode;
}) => (
  <Pressable onPress={onPress} style={styles.menuItem}>
    <Ionicons name={icon} size={20} color={colors.textSecondary} />
    <Text style={styles.menuLabel}>{label}</Text>
    {rightElement || (
      <Ionicons name="chevron-forward" size={20} color={colors.muted} />
    )}
  </Pressable>
);

const styles = StyleSheet.create({
  profileCard: {
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.xl
  },
  avatarContainer: {
    marginBottom: spacing.xs
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: colors.primary
  },
  userName: {
    ...typography.heading3,
    color: colors.text,
    fontWeight: typography.fontWeights.bold
  },
  userEmail: {
    ...typography.body,
    color: colors.textSecondary
  },
  roleBadge: {
    backgroundColor: colors.primarySoft,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.xs,
    marginTop: spacing.xs
  },
  roleBadgeText: {
    ...typography.labelSmall,
    color: colors.primary,
    fontWeight: typography.fontWeights.semibold
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: typography.fontWeights.semibold,
    color: "#9B8FC4",
    letterSpacing: 1,
    marginTop: spacing.sm,
    marginBottom: spacing.sm
  },
  menuCard: {
    padding: 0,
    overflow: "hidden"
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.base,
    minHeight: 56
  },
  menuLabel: {
    flex: 1,
    ...typography.body,
    color: colors.text,
    fontWeight: typography.fontWeights.medium
  },
  valueText: {
    ...typography.body,
    color: colors.textSecondary,
    marginRight: spacing.xs
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: spacing.base
  },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    minHeight: 52,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.danger,
    backgroundColor: colors.surface,
    marginTop: spacing.lg
  },
  logoutText: {
    ...typography.button,
    color: colors.danger
  }
});
