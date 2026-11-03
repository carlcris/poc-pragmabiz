import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Card, ErrorState, LoadingState, Screen, SearchInput } from "@/components/ui";
import type { PickListSummary } from "@/contracts/picking";
import { usePickLists, useSetPickListStatus } from "@/hooks/queries";
import { useWarehouseQueueRealtime } from "@/hooks/useWarehouseQueueRealtime";
import { useScreenFocusState } from "@/hooks/useScreenFocusState";
import { useAuthStore } from "@/stores/authStore";
import { colors } from "@/theme/colors";
import { borderRadius, spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";
import { primaryGlow, softShadow } from "@/theme/elevation";
import { canAccessPicking } from "@/utils/permissions";
import { titleCaseStatus } from "@/utils/record";

const statusFilters = [
  { value: "pending", label: "Pending" },
  { value: "in_progress", label: "In Progress" },
  { value: "done", label: "Done" },
  { value: "all", label: "All" }
];

// Statuses render as colored text, not badges.
const PRIORITY_TEXT_COLORS = {
  ACTIVE: colors.statusInfo,
  PENDING: colors.statusWarning,
  DONE: colors.statusSuccess,
  PAUSED: colors.statusNeutral,
  CANCELLED: colors.statusError,
  UNKNOWN: colors.statusNeutral
};

export default function PickingScreen() {
  const isFocused = useScreenFocusState();
  useWarehouseQueueRealtime(isFocused, "picking");
  const session = useAuthStore((state) => state.session);
  const canViewPicking = canAccessPicking(session);
  const [status, setStatus] = useState("pending");
  const [search, setSearch] = useState("");

  const pickListsQuery = usePickLists(status, search, canViewPicking && isFocused);
  const kpiQuery = usePickLists("all", "", canViewPicking && isFocused);
  const pickLists = pickListsQuery.data || [];
  const allPickLists = kpiQuery.data || [];

  const kpis = {
    pending: allPickLists.filter((pl) => pl.status === "pending").length,
    inProgress: allPickLists.filter((pl) => pl.status === "in_progress" || pl.status === "paused").length,
    done: allPickLists.filter((pl) => pl.status === "done").length
  };

  const handleRefresh = async () => {
    if (status === "all" && !search.trim()) {
      await kpiQuery.refetch();
      return;
    }

    await Promise.all([pickListsQuery.refetch(), kpiQuery.refetch()]);
  };

  if (!canViewPicking) {
    return (
      <Screen title="Picking">
        <ErrorState message="You do not have permission to access picking." />
      </Screen>
    );
  }

  return (
    <Screen
      title="Picking"
      onRefresh={handleRefresh}
      refreshing={pickListsQuery.isRefetching || kpiQuery.isRefetching}
    >
      {/* KPI Summary Strip */}
      <View style={styles.kpiStrip}>
        <View style={styles.kpiCircle} />
        <KpiItem count={kpis.pending} label="Pending" color={colors.statusWarning} dot={colors.amber} />
        <View style={styles.kpiDivider} />
        <KpiItem count={kpis.inProgress} label="In progress" color={colors.statusInfo} dot={colors.blue} />
        <View style={styles.kpiDivider} />
        <KpiItem count={kpis.done} label="Done" color={colors.statusSuccess} dot={colors.green} />
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterTabs}>
        {statusFilters.map((filter) => (
          <Pressable
            key={filter.value}
            onPress={() => setStatus(filter.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: status === filter.value }}
            style={[styles.filterTab, status === filter.value && styles.filterTabActive]}
          >
            <Text style={[styles.filterTabText, status === filter.value && styles.filterTabTextActive]}>
              {filter.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Search Bar */}
      <SearchInput
        value={search}
        onChangeText={setSearch}
        placeholder="Search pick list..."
      />

      {/* List Section Header */}
      {!pickListsQuery.isLoading && !pickListsQuery.error && (
        <View style={styles.listHeader}>
          <Text style={styles.listHeaderText}>{pickLists.length} PICK LISTS</Text>
          <Pressable style={styles.sortButton}>
            <Ionicons name="swap-vertical-outline" size={14} color={colors.primaryDark} />
            <Text style={styles.sortText}>Sort</Text>
          </Pressable>
        </View>
      )}

      {/* Loading / Error States */}
      {pickListsQuery.isLoading ? <LoadingState /> : null}
      {pickListsQuery.error ? <ErrorState message="Unable to load pick lists." /> : null}

      {/* Pick List Cards or Empty State */}
      {!pickListsQuery.isLoading && !pickListsQuery.error && (
        <>
          {pickLists.length === 0 ? (
            <>
              <PickingEmptyState
                onRefresh={() => void pickListsQuery.refetch()}
                onChangeFilters={() => setStatus("all")}
              />
              <TipCard />
            </>
          ) : (
            pickLists.map((item) => (
              <PickListCard key={item.id} item={item} />
            ))
          )}
        </>
      )}
    </Screen>
  );
}

// Pick List Card Component
const PickListCard = ({ item }: { item: PickListSummary }) => {
  const setStatus = useSetPickListStatus(item.id);
  const progress = item.lines > 0 ? (item.pickedLines / item.lines) * 100 : 0;
  const priority = item.priority in PRIORITY_TEXT_COLORS ? item.priority : "UNKNOWN";
  const priorityColor = PRIORITY_TEXT_COLORS[priority as keyof typeof PRIORITY_TEXT_COLORS];
  const createdLabel = item.requiredDate
    ? `Created ${new Date(item.requiredDate).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit"
      })}`
    : "No date";
  const openPickList = () => router.push(`/picking/${item.id}`);
  const shouldStartPicking = item.status === "pending" || item.status === "paused";
  const ctaLabel =
    item.status === "in_progress"
      ? "Continue"
      : item.status === "pending"
        ? "Start Pick"
        : item.status === "paused"
          ? "Resume"
          : "View";
  const handleCtaPress = () => {
    if (!shouldStartPicking) {
      openPickList();
      return;
    }

    setStatus.mutate("in_progress", {
      onSuccess: openPickList
    });
  };

  return (
    <Pressable onPress={openPickList}>
      <Card style={styles.pickListCard}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardCode}>{item.code}</Text>
          <Text style={[styles.priorityText, { color: priorityColor }]}>
            {titleCaseStatus(item.priority.toLowerCase())}
          </Text>
        </View>

        <View style={styles.chipRow}>
          <View style={[styles.chip, styles.chipZone]}>
            <Ionicons name="location-outline" size={14} color={colors.primaryDark} />
            <Text style={[styles.chipText, { color: colors.primaryDark }]}>{item.zone || "No warehouse"}</Text>
          </View>
          <View style={[styles.chip, styles.chipItems]}>
            <MaterialCommunityIcons name="package-variant" size={14} color={colors.statusSuccess} />
            <Text style={[styles.chipText, { color: colors.statusSuccess }]}>{item.lines} items</Text>
          </View>
          <View style={[styles.chip, styles.chipDue]}>
            <Ionicons name="time-outline" size={14} color={colors.statusWarning} />
            <Text style={[styles.chipText, { color: colors.statusWarning }]}>{createdLabel}</Text>
          </View>
        </View>

        <View style={styles.assigneeRow}>
          <Text style={styles.assigneeLabel}>Pickers</Text>
          <AvatarStack assignees={item.assignees} />
        </View>

        <View style={styles.progressContainer}>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${progress}%` }]} />
          </View>
          <Text style={styles.progressText}>
            {item.pickedLines}/{item.lines}
          </Text>
        </View>

        <Pressable
          onPress={handleCtaPress}
          disabled={setStatus.isPending}
          style={[styles.ctaButton, item.status === "in_progress" && styles.ctaButtonInProgress]}
        >
          <Text style={styles.ctaButtonText}>
            {setStatus.isPending && shouldStartPicking ? "Starting..." : ctaLabel}
          </Text>
        </Pressable>
      </Card>
    </Pressable>
  );
};

const KpiItem = ({
  count,
  label,
  color,
  dot
}: {
  count: number;
  label: string;
  color: string;
  dot: string;
}) => (
  <View style={styles.kpiItem}>
    <Text style={[styles.kpiNumber, { color }]}>{count}</Text>
    <View style={styles.kpiLabelRow}>
      <View style={[styles.kpiDot, { backgroundColor: dot }]} />
      <Text style={styles.kpiLabel}>{label}</Text>
    </View>
  </View>
);

// Avatar Stack Component - handles overlapping avatars with overflow
const AvatarStack = ({
  assignees
}: {
  assignees: { id: string; firstName: string; initials: string; color: string }[];
}) => {
  if (assignees.length === 0) {
    return <Text style={styles.assigneeNames}>Unassigned</Text>;
  }

  const MAX_VISIBLE = 3;
  const visibleAssignees = assignees.slice(0, MAX_VISIBLE);
  const overflowCount = assignees.length - MAX_VISIBLE;

  return (
    <View style={styles.avatarStackContainer}>
      <View style={styles.avatarStack}>
        {visibleAssignees.map((assignee, index) => (
          <View
            key={assignee.id}
            style={[
              styles.avatar,
              { backgroundColor: assignee.color, marginLeft: index > 0 ? -8 : 0, zIndex: MAX_VISIBLE - index }
            ]}
          >
            <Text style={styles.avatarText}>{assignee.initials}</Text>
          </View>
        ))}
        {overflowCount > 0 && (
          <View style={[styles.avatar, styles.avatarOverflow, { marginLeft: -8 }]}>
            <Text style={styles.avatarOverflowText}>+{overflowCount}</Text>
          </View>
        )}
      </View>
      <Text style={styles.assigneeNames}>
        {visibleAssignees.map((a) => a.firstName).join(", ")}
        {overflowCount > 0 && ` · ${assignees.length} pickers`}
        {overflowCount === 0 && ` · ${assignees.length} ${assignees.length === 1 ? "picker" : "pickers"}`}
      </Text>
    </View>
  );
};

// Enhanced Empty State
const PickingEmptyState = ({
  onRefresh,
  onChangeFilters
}: {
  onRefresh: () => void;
  onChangeFilters: () => void;
}) => (
  <Card style={styles.emptyPanel}>
    <View style={styles.emptyIconBubble}>
      <MaterialCommunityIcons name="clipboard-list-outline" size={40} color={colors.primary} />
    </View>
    <Text style={styles.emptyTitle}>No pick lists found</Text>
    <Text style={styles.emptySubtitle}>
      There are no pick lists matching your current filters. Try adjusting your search or filter settings.
    </Text>
    <View style={styles.emptyActions}>
      <Pressable onPress={onRefresh} style={styles.emptyActionButton}>
        <Ionicons name="refresh-outline" size={16} color={colors.primary} />
        <Text style={styles.emptyActionText}>Refresh</Text>
      </Pressable>
      <Pressable onPress={onChangeFilters} style={styles.emptyActionButton}>
        <Ionicons name="options-outline" size={16} color={colors.primary} />
        <Text style={styles.emptyActionText}>Change filters</Text>
      </Pressable>
    </View>
  </Card>
);

// Tip Card
const TipCard = () => (
  <Card style={styles.tipCard}>
    <View style={styles.tipIconContainer}>
      <Ionicons name="information-circle" size={20} color={colors.primary} />
    </View>
    <View style={styles.tipContent}>
      <Text style={styles.tipText}>
        <Text style={styles.tipStrong}>Tip: </Text>
        Switch to <Text style={styles.tipStrong}>All</Text> to see pick lists across all statuses, or change the branch and date above.
      </Text>
    </View>
  </Card>
);

const styles = StyleSheet.create({
  // KPI Strip
  kpiStrip: {
    overflow: "hidden",
    backgroundColor: colors.violetSoft,
    borderRadius: 22,
    flexDirection: "row",
    paddingVertical: spacing.base,
    paddingHorizontal: spacing.xs,
    alignItems: "center",
    shadowColor: colors.primaryDark,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 6
  },
  kpiCircle: {
    position: "absolute",
    right: -36,
    top: -56,
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: colors.violet,
    opacity: 0.12
  },
  kpiItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs
  },
  kpiDivider: {
    width: 1,
    height: 36,
    backgroundColor: colors.violetLight
  },
  kpiNumber: {
    fontSize: 26,
    fontWeight: typography.fontWeights.bold,
    lineHeight: 30
  },
  kpiLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  kpiDot: {
    width: 7,
    height: 7,
    borderRadius: 4
  },
  kpiLabel: {
    fontSize: 12,
    lineHeight: 16,
    color: colors.violetText
  },

  // Filter Tabs
  filterTabs: {
    flexDirection: "row",
    gap: spacing.xs,
    padding: spacing.xs,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
    ...softShadow
  },
  filterTab: {
    flexGrow: 1,
    minHeight: 36,
    paddingHorizontal: 10,
    borderRadius: borderRadius.full,
    alignItems: "center",
    justifyContent: "center"
  },
  filterTabActive: {
    backgroundColor: colors.primary,
    ...primaryGlow
  },
  filterTabText: {
    fontSize: 13,
    fontWeight: typography.fontWeights.medium,
    color: colors.textSecondary
  },
  filterTabTextActive: {
    color: colors.surface,
    fontWeight: typography.fontWeights.semibold
  },

  // List Header
  listHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.xs
  },
  listHeaderText: {
    fontSize: 12,
    fontWeight: typography.fontWeights.medium,
    color: colors.textSecondary,
    letterSpacing: 0.4
  },
  sortButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full
  },
  sortText: {
    fontSize: 13,
    fontWeight: typography.fontWeights.medium,
    color: colors.primaryDark
  },

  // Pick List Card
  pickListCard: {
    padding: spacing.base,
    gap: spacing.md
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  cardCode: {
    fontSize: 16,
    fontWeight: typography.fontWeights.bold,
    color: colors.text,
    flex: 1
  },
  priorityText: {
    fontSize: 13,
    fontWeight: typography.fontWeights.semibold
  },

  // Chip Row
  chipRow: {
    flexDirection: "row",
    gap: spacing.xs,
    flexWrap: "wrap"
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: borderRadius.full
  },
  chipZone: {
    backgroundColor: colors.primarySoft
  },
  chipItems: {
    backgroundColor: colors.mintSoft
  },
  chipDue: {
    backgroundColor: colors.amberBanner
  },
  chipText: {
    fontSize: 12,
    fontWeight: typography.fontWeights.medium
  },

  // Assignee Row
  assigneeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm
  },
  assigneeLabel: {
    fontSize: 12,
    fontWeight: typography.fontWeights.medium,
    color: colors.textSecondary
  },
  avatarStackContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm
  },
  avatarStack: {
    flexDirection: "row",
    alignItems: "center"
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.surface
  },
  avatarText: {
    fontSize: 10,
    fontWeight: typography.fontWeights.bold,
    color: colors.surface
  },
  avatarOverflow: {
    backgroundColor: colors.muted
  },
  avatarOverflowText: {
    fontSize: 9,
    fontWeight: typography.fontWeights.bold,
    color: colors.surface
  },
  assigneeNames: {
    fontSize: 12,
    fontWeight: typography.fontWeights.medium,
    color: colors.text,
    flex: 1
  },

  // Progress Bar
  progressContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm
  },
  progressBarBg: {
    flex: 1,
    height: 6,
    backgroundColor: colors.violetFaint,
    borderRadius: borderRadius.full,
    overflow: "hidden"
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: colors.violet,
    borderRadius: borderRadius.full
  },
  progressText: {
    fontSize: 13,
    fontWeight: typography.fontWeights.bold,
    color: colors.text,
    minWidth: 40,
    textAlign: "right"
  },

  // CTA Button
  ctaButton: {
    minHeight: 48,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.xs,
    ...primaryGlow
  },
  ctaButtonInProgress: {
    backgroundColor: colors.primary
  },
  ctaButtonText: {
    fontSize: 15,
    fontWeight: typography.fontWeights.semibold,
    color: colors.surface
  },

  // Empty State
  emptyPanel: {
    minHeight: 320,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    gap: spacing.base
  },
  emptyIconBubble: {
    width: 80,
    height: 80,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primarySoft
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: typography.fontWeights.bold,
    color: colors.text,
    textAlign: "center"
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
    maxWidth: 280
  },
  emptyActions: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.sm
  },
  emptyActionButton: {
    minHeight: 44,
    minWidth: 120,
    borderRadius: borderRadius.full,
    borderWidth: 1.5,
    borderColor: colors.violetAvatar,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: spacing.xs,
    paddingHorizontal: spacing.base
  },
  emptyActionText: {
    fontSize: 14,
    color: colors.primaryDark,
    fontWeight: typography.fontWeights.medium
  },

  // Tip Card
  tipCard: {
    minHeight: 68,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    backgroundColor: colors.primarySoft,
    padding: spacing.base
  },
  tipIconContainer: {
    marginTop: 2
  },
  tipContent: {
    flex: 1
  },
  tipText: {
    fontSize: 13,
    color: colors.text,
    lineHeight: 18
  },
  tipStrong: {
    color: colors.primaryDark,
    fontWeight: typography.fontWeights.bold
  }
});
