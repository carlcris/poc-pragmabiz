import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { Card, Screen } from "@/components/ui";
import { useAuthStore } from "@/stores/authStore";
import { colors } from "@/theme/colors";
import { spacing, borderRadius } from "@/theme/spacing";
import { typography } from "@/theme/typography";
import { softShadow } from "@/theme/elevation";

export default function ProfileScreen() {
  const { session, logout } = useAuthStore();
  const user = session?.user;
  const initials = [user?.firstName, user?.lastName]
    .map((part) => part?.trim().charAt(0) ?? "")
    .join("")
    .toUpperCase();

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
    <Screen title="Profile">
      <View style={styles.profileCard}>
        <View style={styles.profileCircle} />
        <View style={styles.avatar} importantForAccessibility="no-hide-descendants">
          {initials ? (
            <Text style={styles.avatarText}>{initials}</Text>
          ) : (
            <Ionicons name="person" size={28} color={colors.primaryDark} />
          )}
        </View>
        <View style={styles.profileText}>
          <Text style={styles.userName} numberOfLines={1}>
            {user?.firstName && user?.lastName
              ? `${user.firstName} ${user.lastName}`
              : user?.name || "User"}
          </Text>
          <Text style={styles.userEmail} numberOfLines={1}>
            {user?.email || ""}
          </Text>
          <View style={styles.roleBadge}>
            <Text style={styles.roleBadgeText}>{user?.role || "Staff"}</Text>
          </View>
        </View>
      </View>

      <Text style={styles.sectionTitle}>ACCOUNT</Text>

      <Card style={styles.menuCard}>
        <MenuItem
          icon="person-outline"
          tint={{ background: colors.violetSoft, color: colors.primaryDark }}
          label="Personal Information"
          onPress={() => {}}
        />
        <View style={styles.divider} />
        <MenuItem
          icon="lock-closed-outline"
          tint={{ background: colors.mintSoft, color: colors.statusSuccess }}
          label="Change Password"
          onPress={() => {}}
        />
        <View style={styles.divider} />
        <MenuItem
          icon="notifications-outline"
          tint={{ background: colors.amberBanner, color: colors.statusWarning }}
          label="Notifications"
          onPress={() => {}}
        />
      </Card>

      <Text style={styles.sectionTitle}>PREFERENCES</Text>

      <Card style={styles.menuCard}>
        <MenuItem
          icon="moon-outline"
          tint={{ background: colors.blueSoft, color: colors.statusInfo }}
          label="Dark Mode"
          onPress={() => {}}
          rightElement={<Text style={styles.valueText}>Off</Text>}
        />
        <View style={styles.divider} />
        <MenuItem
          icon="language-outline"
          tint={{ background: colors.limeSoft, color: colors.limeDark }}
          label="Language"
          onPress={() => {}}
          rightElement={<Text style={styles.valueText}>English</Text>}
        />
      </Card>

      <Text style={styles.sectionTitle}>SUPPORT</Text>

      <Card style={styles.menuCard}>
        <MenuItem
          icon="help-circle-outline"
          tint={{ background: colors.violetSoft, color: colors.primaryDark }}
          label="Help Center"
          onPress={() => {}}
        />
        <View style={styles.divider} />
        <MenuItem
          icon="document-text-outline"
          tint={{ background: colors.backgroundSecondary, color: colors.statusNeutral }}
          label="Terms & Privacy"
          onPress={() => {}}
        />
        <View style={styles.divider} />
        <MenuItem
          icon="information-circle-outline"
          tint={{ background: colors.blueSoft, color: colors.statusInfo }}
          label="About"
          onPress={() => {}}
          rightElement={<Text style={styles.valueText}>v1.0.0</Text>}
        />
      </Card>

      <Pressable onPress={handleLogout} style={styles.logoutButton}>
        <Ionicons name="log-out-outline" size={20} color={colors.statusError} />
        <Text style={styles.logoutText}>Sign Out</Text>
      </Pressable>
    </Screen>
  );
}

const MenuItem = ({
  icon,
  tint,
  label,
  onPress,
  rightElement
}: {
  icon: keyof typeof Ionicons.glyphMap;
  tint: { background: string; color: string };
  label: string;
  onPress: () => void;
  rightElement?: React.ReactNode;
}) => (
  <Pressable onPress={onPress} style={styles.menuItem}>
    <View style={[styles.menuIcon, { backgroundColor: tint.background }]}>
      <Ionicons name={icon} size={18} color={tint.color} />
    </View>
    <Text style={styles.menuLabel}>{label}</Text>
    {rightElement || (
      <Ionicons name="chevron-forward" size={20} color={colors.muted} />
    )}
  </Pressable>
);

const styles = StyleSheet.create({
  profileCard: {
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 18,
    borderRadius: 22,
    backgroundColor: colors.violetSoft,
    shadowColor: colors.primaryDark,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 6
  },
  profileCircle: {
    position: "absolute",
    right: -40,
    top: -60,
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: colors.violet,
    opacity: 0.12
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    ...softShadow
  },
  avatarText: {
    fontSize: 22,
    fontWeight: typography.fontWeights.bold,
    color: colors.primaryDark
  },
  profileText: {
    flex: 1,
    minWidth: 0,
    gap: 3
  },
  userName: {
    fontSize: 19,
    lineHeight: 24,
    color: colors.text,
    fontWeight: typography.fontWeights.bold
  },
  userEmail: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary
  },
  roleBadge: {
    alignSelf: "flex-start",
    backgroundColor: colors.surface,
    borderRadius: borderRadius.full,
    paddingHorizontal: 10,
    paddingVertical: 3,
    marginTop: 3
  },
  roleBadgeText: {
    fontSize: 12,
    color: colors.primaryDark,
    fontWeight: typography.fontWeights.medium
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: typography.fontWeights.medium,
    color: colors.textSecondary,
    letterSpacing: 0.6,
    marginTop: spacing.xs,
    marginBottom: -6,
    marginLeft: spacing.xs
  },
  menuCard: {
    padding: 0,
    overflow: "hidden"
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    minHeight: 56,
    paddingVertical: 10,
    paddingHorizontal: 14
  },
  menuIcon: {
    width: 36,
    height: 36,
    borderRadius: spacing.md,
    alignItems: "center",
    justifyContent: "center"
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
    backgroundColor: colors.divider,
    marginLeft: 62
  },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    minHeight: 52,
    borderRadius: borderRadius.full,
    backgroundColor: colors.dangerSoft,
    marginTop: spacing.sm
  },
  logoutText: {
    ...typography.button,
    color: colors.statusError
  }
});
