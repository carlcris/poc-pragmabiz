import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Card, ErrorState, LoadingState, Screen } from "@/components/ui";
import type { MobileUser } from "@/contracts/auth";
import { useDashboard } from "@/hooks/queries";
import { useAuthStore } from "@/stores/authStore";
import { colors } from "@/theme/colors";
import { spacing, borderRadius } from "@/theme/spacing";
import { typography } from "@/theme/typography";

const getGreeting = (date = new Date()) => {
  const hour = date.getHours();
  if (hour < 12) return "Good morning";
  if (hour === 12) return "Good noon";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
};

const getDisplayName = (user: MobileUser | null) => {
  if (!user) return "there";
  return user.firstName || user.username || user.name || user.email.split("@")[0] || "there";
};

export default function DashboardScreen() {
  const dashboard = useDashboard();
  const user = useAuthStore((state) => state.session?.user ?? null);
  const displayName = getDisplayName(user);

  return (
    <Screen title={`Hi ${displayName}`} subtitle={`${getGreeting()}!`}>
      {dashboard.isLoading ? <LoadingState /> : null}
      {dashboard.error ? <ErrorState message="Unable to load the warehouse dashboard." /> : null}
      {dashboard.data ? (
        <>
          <View style={styles.metricsGrid}>
            <MetricCard
              label="Pending Receipts"
              value={dashboard.data.summary.incoming_deliveries_today}
              icon="package-variant-closed"
            />
            <MetricCard
              label="Ready to Pick"
              value={dashboard.data.summary.pick_list_to_pick}
              icon="clipboard-check-outline"
            />
            <MetricCard
              label="In Transit"
              value={0}
              icon="truck-delivery-outline"
            />
            <MetricCard
              label="Urgent"
              value={dashboard.data.summary.urgent_stock_requests}
              icon="alert-circle-outline"
            />
          </View>

          <Text style={styles.sectionTitle}>QUICK ACTIONS</Text>

          <Card style={styles.actionsCard}>
            <ActionRow
              title="Receiving"
              subtitle="Receive incoming shipments"
              icon="package-variant-closed"
              count={dashboard.data.summary.incoming_deliveries_today}
              tone="blue"
              onPress={() => router.push("/receiving")}
            />
            <View style={styles.divider} />
            <ActionRow
              title="Picking"
              subtitle="Pick from assigned lists"
              icon="package-variant-plus"
              count={dashboard.data.summary.pick_list_to_pick}
              tone="green"
              onPress={() => router.push("/picking")}
            />
          </Card>

          <Card style={styles.statusCard}>
            <MaterialCommunityIcons
              name={dashboard.data.summary.urgent_stock_requests > 0 ? "alert-circle-outline" : "check-circle-outline"}
              size={24}
              color={dashboard.data.summary.urgent_stock_requests > 0 ? colors.amber : colors.green}
            />
            <Text style={styles.statusText}>
              {dashboard.data.summary.urgent_stock_requests > 0
                ? `${dashboard.data.summary.urgent_stock_requests} urgent stock requests need review.`
                : "All clear — no urgent stock requests."}
            </Text>
          </Card>
        </>
      ) : null}
    </Screen>
  );
}

const MetricCard = ({
  label,
  value,
  icon
}: {
  label: string;
  value: number;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
}) => (
  <View style={styles.metricCard}>
    <View style={styles.metricIconBubble}>
      <MaterialCommunityIcons name={icon} size={16} color={colors.primary} />
    </View>
    <Text style={styles.metricValue}>{value}</Text>
    <Text style={styles.metricLabel}>{label}</Text>
  </View>
);

const ActionRow = ({
  title,
  subtitle,
  icon,
  count,
  tone,
  onPress
}: {
  title: string;
  subtitle: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  count: number;
  tone: "blue" | "green";
  onPress: () => void;
}) => (
  <Pressable onPress={onPress} style={styles.actionRow}>
    <View style={[styles.actionIcon, tone === "green" ? styles.greenBubble : styles.blueBubble]}>
      <MaterialCommunityIcons
        name={icon}
        size={24}
        color={tone === "green" ? "#10B981" : "#6366F1"}
      />
    </View>
    <View style={styles.actionContent}>
      <Text style={styles.actionTitle}>{title}</Text>
      <Text style={styles.actionSubtitle}>{subtitle}</Text>
    </View>
    <View style={styles.actionRight}>
      <Text style={styles.countText}>{count}</Text>
      <MaterialCommunityIcons name="chevron-right" size={20} color="#C4BFD6" />
    </View>
  </Pressable>
);


const styles = StyleSheet.create({
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginBottom: spacing.sm
  },
  metricCard: {
    width: "48%",
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 0,
    padding: spacing.xs,
    paddingVertical: spacing.sm,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 68,
    gap: 2
  },
  metricIconBubble: {
    width: 28,
    height: 28,
    borderRadius: borderRadius.sm,
    backgroundColor: "#E8E5FF",
    alignItems: "center",
    justifyContent: "center"
  },
  metricValue: {
    fontSize: 28,
    fontWeight: typography.fontWeights.bold,
    color: colors.primary,
    lineHeight: 28
  },
  metricLabel: {
    fontSize: 10,
    color: "#9B8FC4",
    textAlign: "center",
    lineHeight: 13
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: typography.fontWeights.semibold,
    color: "#9B8FC4",
    letterSpacing: 1,
    marginTop: spacing.sm,
    marginBottom: spacing.sm
  },
  actionsCard: {
    padding: 0,
    overflow: "hidden",
    borderRadius: borderRadius.lg,
    borderWidth: 0
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.base,
    minHeight: 68
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    alignItems: "center",
    justifyContent: "center"
  },
  blueBubble: {
    backgroundColor: "#E8E5FF"
  },
  greenBubble: {
    backgroundColor: "#D4F4E2"
  },
  actionContent: {
    flex: 1
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: typography.fontWeights.semibold,
    color: colors.text,
    marginBottom: 2
  },
  actionSubtitle: {
    fontSize: 13,
    color: "#9B8FC4"
  },
  actionRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs
  },
  countText: {
    fontSize: 24,
    fontWeight: typography.fontWeights.bold,
    color: colors.primary
  },
  divider: {
    height: 1,
    backgroundColor: "#F0EDF7",
    marginHorizontal: 0
  },
  statusCard: {
    flexDirection: "row",
    gap: spacing.md,
    alignItems: "center",
    backgroundColor: "#E8F5EE",
    borderColor: "transparent",
    borderWidth: 0,
    borderRadius: borderRadius.lg,
    padding: spacing.base
  },
  statusText: {
    fontSize: 14,
    color: colors.text,
    flex: 1
  }
});
