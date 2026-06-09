import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View, ScrollView } from "react-native";
import { Card, ErrorState, LoadingState, Screen, SearchInput } from "@/components/ui";
import type { PickListSummary } from "@/contracts/picking";
import { usePickLists, useSetPickListStatus } from "@/hooks/queries";
import { colors } from "@/theme/colors";
import { borderRadius, spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";

const statusFilters = [
  { value: "pending", label: "Pending" },
  { value: "in_progress", label: "In Progress" },
  { value: "done", label: "Done" },
  { value: "all", label: "All" }
];

const PRIORITY_COLORS = {
  ACTIVE: { bg: "#EFF6FF", text: "#2563EB", border: "#93C5FD" },
  PENDING: { bg: "#FFFBEB", text: "#D97706", border: "#FCD34D" },
  DONE: { bg: "#ECFDF5", text: "#059669", border: "#6EE7B7" },
  PAUSED: { bg: "#F3F4F6", text: "#6B7280", border: "#D1D5DB" },
  CANCELLED: { bg: "#FEF2F2", text: "#DC2626", border: "#FCA5A5" },
  UNKNOWN: { bg: "#F3F4F6", text: "#6B7280", border: "#D1D5DB" }
};

export default function PickingScreen() {
  const [status, setStatus] = useState("pending");
  const [search, setSearch] = useState("");

  const pickListsQuery = usePickLists(status, search);
  const kpiQuery = usePickLists("all", "");
  const pickLists = pickListsQuery.data || [];
  const allPickLists = kpiQuery.data || [];

  const kpis = {
    pending: allPickLists.filter((pl) => pl.status === "pending").length,
    inProgress: allPickLists.filter((pl) => pl.status === "in_progress" || pl.status === "paused").length,
    done: allPickLists.filter((pl) => pl.status === "done").length
  };

  return (
    <Screen title="Picking" subtitle="Process orders and pack items">
      {/* KPI Summary Strip */}
      <View style={styles.kpiStrip}>
        <View style={styles.kpiItem}>
          <Text style={[styles.kpiNumber, { color: "#FCD34D" }]}>{kpis.pending}</Text>
          <Text style={styles.kpiLabel}>PENDING</Text>
        </View>
        <View style={styles.kpiItem}>
          <Text style={[styles.kpiNumber, { color: "#60A5FA" }]}>{kpis.inProgress}</Text>
          <Text style={styles.kpiLabel}>IN PROGRESS</Text>
        </View>
        <View style={styles.kpiItem}>
          <Text style={[styles.kpiNumber, { color: "#34D399" }]}>{kpis.done}</Text>
          <Text style={styles.kpiLabel}>DONE</Text>
        </View>
      </View>

      {/* Filter Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterTabsContainer}
        style={styles.filterTabsScroll}
      >
        {statusFilters.map((filter) => (
          <Pressable
            key={filter.value}
            onPress={() => setStatus(filter.value)}
            style={[styles.filterTab, status === filter.value && styles.filterTabActive]}
          >
            <Text style={[styles.filterTabText, status === filter.value && styles.filterTabTextActive]}>
              {filter.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

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
            <Ionicons name="swap-vertical-outline" size={14} color={colors.primary} />
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
  const priority = item.priority in PRIORITY_COLORS ? item.priority : "UNKNOWN";
  const priorityStyle = PRIORITY_COLORS[priority as keyof typeof PRIORITY_COLORS];
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
          <View
            style={[
              styles.priorityBadge,
              { backgroundColor: priorityStyle.bg, borderColor: priorityStyle.border }
            ]}
          >
            <Text style={[styles.priorityText, { color: priorityStyle.text }]}>{item.priority}</Text>
          </View>
        </View>

        <View style={styles.chipRow}>
          <View style={[styles.chip, styles.chipZone]}>
            <Ionicons name="location-outline" size={14} color={colors.primary} />
            <Text style={styles.chipText}>{item.zone || "No warehouse"}</Text>
          </View>
          <View style={[styles.chip, styles.chipItems]}>
            <MaterialCommunityIcons name="package-variant" size={14} color={colors.blue} />
            <Text style={styles.chipText}>{item.lines} items</Text>
          </View>
          <View style={[styles.chip, styles.chipDue]}>
            <Ionicons name="time-outline" size={14} color={colors.amber} />
            <Text style={styles.chipText}>{createdLabel}</Text>
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
    backgroundColor: colors.primary,
    borderRadius: borderRadius.lg,
    flexDirection: "row",
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.base,
    marginBottom: spacing.base,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4
  },
  kpiItem: {
    flex: 1,
    alignItems: "center",
    gap: spacing.xs
  },
  kpiNumber: {
    fontSize: 32,
    fontWeight: typography.fontWeights.extrabold,
    lineHeight: 38
  },
  kpiLabel: {
    fontSize: 11,
    fontWeight: typography.fontWeights.semibold,
    color: "#FFFFFF",
    opacity: 0.9,
    letterSpacing: 0.5
  },

  // Filter Tabs
  filterTabsScroll: {
    marginBottom: spacing.base
  },
  filterTabsContainer: {
    gap: spacing.xs,
    paddingHorizontal: 2
  },
  filterTab: {
    minHeight: 36,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center"
  },
  filterTabActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3
  },
  filterTabText: {
    fontSize: 13,
    fontWeight: typography.fontWeights.semibold,
    color: colors.text
  },
  filterTabTextActive: {
    color: "#FFFFFF"
  },

  // List Header
  listHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.sm
  },
  listHeaderText: {
    fontSize: 11,
    fontWeight: typography.fontWeights.semibold,
    color: "#9B8FC4",
    letterSpacing: 0.8
  },
  sortButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.base,
    backgroundColor: colors.primarySoft
  },
  sortText: {
    fontSize: 12,
    fontWeight: typography.fontWeights.semibold,
    color: colors.primary
  },

  // Pick List Card
  pickListCard: {
    padding: spacing.base,
    gap: spacing.sm,
    marginBottom: spacing.base
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  cardCode: {
    fontSize: 16,
    fontWeight: typography.fontWeights.extrabold,
    color: colors.text,
    flex: 1
  },
  priorityBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.base,
    borderWidth: 1
  },
  priorityText: {
    fontSize: 11,
    fontWeight: typography.fontWeights.bold,
    letterSpacing: 0.5
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
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.base
  },
  chipZone: {
    backgroundColor: colors.primarySoft
  },
  chipItems: {
    backgroundColor: colors.blueSoft
  },
  chipDue: {
    backgroundColor: colors.amberSoft
  },
  chipText: {
    fontSize: 12,
    fontWeight: typography.fontWeights.medium,
    color: colors.text
  },

  // Assignee Row
  assigneeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border
  },
  assigneeLabel: {
    fontSize: 12,
    fontWeight: typography.fontWeights.semibold,
    color: colors.textSecondary,
    minWidth: 48
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
    color: "#FFFFFF"
  },
  avatarOverflow: {
    backgroundColor: "#9CA3AF"
  },
  avatarOverflowText: {
    fontSize: 9,
    fontWeight: typography.fontWeights.bold,
    color: "#FFFFFF"
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
    backgroundColor: colors.backgroundSecondary,
    borderRadius: borderRadius.full,
    overflow: "hidden"
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: colors.primary,
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
    minHeight: 44,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.xs,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2
  },
  ctaButtonInProgress: {
    backgroundColor: colors.primary
  },
  ctaButtonText: {
    fontSize: 14,
    fontWeight: typography.fontWeights.bold,
    color: "#FFFFFF"
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
    borderRadius: borderRadius.lg,
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
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: spacing.xs,
    paddingHorizontal: spacing.base
  },
  emptyActionText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: typography.fontWeights.semibold
  },

  // Tip Card
  tipCard: {
    minHeight: 68,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    borderColor: colors.primary,
    borderWidth: 1,
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
    color: colors.primary,
    fontWeight: typography.fontWeights.bold
  }
});
