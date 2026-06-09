import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Card, ErrorState, LoadingState, Screen, SearchInput, StatusBadge } from "@/components/ui";
import { usePickLists } from "@/hooks/queries";
import { colors } from "@/theme/colors";
import { borderRadius, spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";
import { formatDate } from "@/utils/format";

const statusFilters = [
  { value: "pending", label: "Pending", emptyTitle: "No pending pick lists" },
  { value: "in_progress", label: "In Progress", emptyTitle: "No pick lists in progress" },
  { value: "done", label: "Completed", emptyTitle: "No completed pick lists" },
  { value: "all", label: "All", emptyTitle: "No pick lists found" }
];

export default function PickingScreen() {
  const [status, setStatus] = useState("pending");
  const [search, setSearch] = useState("");
  const pickLists = usePickLists(status, search);
  const selectedStatus = statusFilters.find((item) => item.value === status) || statusFilters[0];

  return (
    <Screen title="Picking" subtitle="Process orders and pack items">
      <View style={styles.statusRow}>
        {statusFilters.map((filter) => (
          <Pressable
            key={filter.value}
            onPress={() => setStatus(filter.value)}
            style={[styles.statusButton, status === filter.value ? styles.statusButtonActive : null]}
          >
            <Text style={[styles.statusText, status === filter.value ? styles.statusTextActive : null]}>
              {filter.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <SearchInput
        value={search}
        onChangeText={setSearch}
        placeholder="Search by pick list code or assignee..."
      />

      {pickLists.isLoading ? <LoadingState /> : null}
      {pickLists.error ? <ErrorState message="Unable to load pick lists." /> : null}

      {pickLists.data ? (
        <>
          <Text style={styles.resultText}>{pickLists.data.length} PICK LISTS FOUND</Text>
          {pickLists.data.length === 0 ? (
            <>
              <PickingEmptyState
                title={selectedStatus.emptyTitle}
                subtitle={`There are no pick lists currently ${selectedStatus.label.toLowerCase()} for the selected business unit today.`}
                onRefresh={() => void pickLists.refetch()}
                onShowAll={() => setStatus("all")}
              />
              <TipCard />
            </>
          ) : (
            pickLists.data.map((item) => (
              <Pressable key={item.id} onPress={() => router.push(`/picking/${item.id}`)}>
                <Card style={styles.rowCard}>
                  <View style={styles.rowHeader}>
                    <MaterialCommunityIcons name="clipboard-list-outline" size={20} color={colors.textSecondary} />
                  <Text style={styles.rowTitle}>{item.code}</Text>
                  <StatusBadge status={item.status} />
                  <Ionicons name="chevron-forward" size={18} color={colors.muted} />
                </View>
                {item.deliveryNoteCode ? (
                  <Text style={styles.rowMeta}>Delivery note: {item.deliveryNoteCode}</Text>
                ) : null}
                  <Text style={styles.rowMeta}>{item.lines} items to pick</Text>
                  <Text style={styles.rowMeta}>Assigned: {item.assignedTo || "Unassigned"}</Text>
                  <Text style={styles.rowMeta}>Required: {formatDate(item.requiredDate)}</Text>
                </Card>
              </Pressable>
            ))
          )}
        </>
      ) : null}
    </Screen>
  );
}

const PickingEmptyState = ({
  title,
  subtitle,
  onRefresh,
  onShowAll
}: {
  title: string;
  subtitle: string;
  onRefresh: () => void;
  onShowAll: () => void;
}) => (
  <Card style={styles.emptyPanel}>
    <View style={styles.emptyIconBubble}>
      <MaterialCommunityIcons name="package-variant-plus" size={32} color={colors.primary} />
    </View>
    <Text style={styles.emptyTitle}>{title}</Text>
    <Text style={styles.emptySubtitle}>{subtitle}</Text>
    <View style={styles.emptyActions}>
      <Pressable onPress={onRefresh} style={styles.emptyActionButton}>
        <Ionicons name="refresh-outline" size={14} color={colors.primary} />
        <Text style={styles.emptyActionText}>Refresh</Text>
      </Pressable>
      <Pressable onPress={onShowAll} style={styles.emptyActionButton}>
        <Ionicons name="options-outline" size={14} color={colors.primary} />
        <Text style={styles.emptyActionText}>Change filters</Text>
      </Pressable>
    </View>
  </Card>
);

const TipCard = () => (
  <Card style={styles.tipCard}>
    <Ionicons name="information-circle-outline" size={18} color={colors.primary} />
    <Text style={styles.tipText}>
      <Text style={styles.tipStrong}>Tip: </Text>
      Switch to <Text style={styles.tipStrong}>All</Text> to see pick lists across all statuses, or change
      the branch and date above.
    </Text>
  </Card>
);

const styles = StyleSheet.create({
  statusRow: {
    flexDirection: "row",
    gap: spacing.xs,
    flexWrap: "wrap"
  },
  statusButton: {
    flex: 1,
    minWidth: 70,
    minHeight: 40,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.xs,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface
  },
  statusButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  statusText: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: typography.fontWeights.semibold,
    textAlign: "center"
  },
  statusTextActive: {
    color: "#fff"
  },
  resultText: {
    fontSize: 11,
    color: "#9B8FC4",
    fontWeight: typography.fontWeights.semibold,
    letterSpacing: 0.8
  },
  emptyPanel: {
    minHeight: 280,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
    gap: spacing.sm
  },
  emptyIconBubble: {
    width: 64,
    height: 64,
    borderRadius: borderRadius.lg,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primarySoft
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: typography.fontWeights.bold,
    color: colors.text,
    textAlign: "center"
  },
  emptySubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 18
  },
  emptyActions: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.xs
  },
  emptyActionButton: {
    minHeight: 40,
    minWidth: 100,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: spacing.xs,
    paddingHorizontal: spacing.sm
  },
  emptyActionText: {
    fontSize: 13,
    color: colors.text,
    fontWeight: typography.fontWeights.semibold
  },
  tipCard: {
    minHeight: 68,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderColor: colors.border,
    padding: spacing.sm
  },
  tipText: {
    fontSize: 12,
    color: colors.textSecondary,
    flex: 1,
    lineHeight: 16
  },
  tipStrong: {
    color: colors.primary,
    fontWeight: typography.fontWeights.semibold
  },
  rowCard: {
    gap: spacing.xs,
    padding: spacing.sm
  },
  rowHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm
  },
  rowTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: typography.fontWeights.bold,
    color: colors.text
  },
  rowMeta: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18
  }
});
