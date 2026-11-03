import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ReceivingInboxFiltersSheet } from "@/components/receiving/ReceivingInboxFiltersSheet";
import { ReceivingInboxListItem } from "@/components/receiving/ReceivingInboxListItem";
import {
  RECEIVING_INBOX_STAGE_COLORS,
  RECEIVING_INBOX_STAGE_LABELS,
  canOpenReceivingInboxRow,
  countReceivingInbox,
} from "@/components/receiving/receiving-stages";
import { Card, ErrorState, LoadingState, Screen, SearchInput } from "@/components/ui";
import type {
  ReceivingInboxKindFilter,
  ReceivingInboxRow,
  ReceivingInboxStage,
  ReceivingInboxStageFilter,
} from "@/contracts/receiving";
import { queryKeys, useReceivingInbox } from "@/hooks/queries";
import { useScreenFocusState } from "@/hooks/useScreenFocusState";
import { useWarehouseQueueRealtime } from "@/hooks/useWarehouseQueueRealtime";
import { useAuthStore } from "@/stores/authStore";
import { colors } from "@/theme/colors";
import { borderRadius, spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";
import { primaryGlow, softShadow } from "@/theme/elevation";
import {
  canAccessDeliveryNoteReceiving,
  canAccessLoadListReceiving,
  canAccessReceiving,
} from "@/utils/permissions";

const SEARCH_DEBOUNCE_MS = 300;

type InboxSection = {
  stage: ReceivingInboxStage;
  rows: ReceivingInboxRow[];
};

const groupRowsByStage = (rows: ReceivingInboxRow[]) =>
  rows.reduce<InboxSection[]>((sections, row) => {
    const last = sections[sections.length - 1];
    if (last && last.stage === row.stage) {
      last.rows.push(row);
    } else {
      sections.push({ stage: row.stage, rows: [row] });
    }
    return sections;
  }, []);

const openRow = (row: ReceivingInboxRow) => {
  if (row.kind === "load_list") {
    router.push(`/receiving/load-lists/${row.id}`);
  } else {
    router.push(`/receiving/${row.id}`);
  }
};

export default function ReceivingScreen() {
  const hasFocusedOnce = useRef(false);
  const refreshOnFocusRef = useRef<() => void>(() => undefined);
  const queryClient = useQueryClient();
  const isFocused = useScreenFocusState();
  useWarehouseQueueRealtime(isFocused, "receiving");
  const session = useAuthStore((state) => state.session);
  const currentBusinessUnitId = session?.currentBusinessUnit?.id || "";
  const currentBusinessUnitName = session?.currentBusinessUnit?.name || "";
  const isSwitchingBusinessUnit = useAuthStore((state) => state.isSwitchingBusinessUnit);
  const canViewReceiving = canAccessReceiving(session);
  const showKindFilter =
    canAccessLoadListReceiving(session) && canAccessDeliveryNoteReceiving(session);

  const [stage, setStage] = useState<ReceivingInboxStageFilter>("to_receive");
  const [kind, setKind] = useState<ReceivingInboxKindFilter>("all");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(() => setSearch(searchInput.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [searchInput]);

  const canLoad = Boolean(isFocused && currentBusinessUnitId && canViewReceiving);
  const inbox = useReceivingInbox(stage, kind, search, canLoad);
  const rows = useMemo(() => inbox.data?.pages.flatMap((page) => page.rows) ?? [], [inbox.data]);
  const stageCounts = inbox.data?.pages[0]?.stageCounts ?? [];
  const sections = useMemo(() => groupRowsByStage(rows), [rows]);
  const toReceiveCount = countReceivingInbox(stageCounts, "to_receive", kind);
  const expectedCount = countReceivingInbox(stageCounts, "expected", kind);
  const isDefaultView = stage === "to_receive" && kind === "all" && !search;
  const activeFilterCount =
    (stage === "to_receive" || stage === "expected" ? 0 : 1) + (kind === "all" ? 0 : 1);
  const isInitialLoading = isSwitchingBusinessUnit || (canLoad && !inbox.data && inbox.isFetching);

  const handleRefresh = useCallback(async () => {
    if (canLoad) {
      await inbox.refetch();
    }
  }, [canLoad, inbox]);

  refreshOnFocusRef.current = () => {
    const queryKey = queryKeys.receivingInbox(currentBusinessUnitId, stage, kind, search);
    if (canLoad && queryClient.getQueryState(queryKey)?.isInvalidated) {
      void inbox.refetch();
    }
  };

  useFocusEffect(
    useCallback(() => {
      if (!hasFocusedOnce.current) {
        hasFocusedOnce.current = true;
        return;
      }

      refreshOnFocusRef.current();
    }, [])
  );

  const clearFilters = () => {
    setStage("to_receive");
    setKind("all");
    setSearchInput("");
    setSearch("");
  };

  if (!canViewReceiving) {
    return (
      <Screen title="Receiving">
        <ErrorState message="You do not have permission to access receiving." />
      </Screen>
    );
  }

  return (
    <Screen
      title="Receiving"
      onRefresh={handleRefresh}
      refreshing={inbox.isRefetching && !inbox.isFetchingNextPage}
    >
      <SearchInput
        value={searchInput}
        onChangeText={setSearchInput}
        placeholder="Search code, supplier or branch"
      />

      <View style={styles.filterRow}>
        <View style={styles.chipTrack}>
        <FilterChip
          label={`To receive · ${toReceiveCount}`}
          active={stage === "to_receive"}
          onPress={() => setStage("to_receive")}
        />
        <FilterChip
          label={`Expected · ${expectedCount}`}
          active={stage === "expected"}
          onPress={() => setStage("expected")}
        />
        </View>
        <Pressable
          onPress={() => setFiltersOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={
            activeFilterCount > 0 ? `Filters, ${activeFilterCount} applied` : "Filters"
          }
          style={[styles.filtersButton, activeFilterCount > 0 ? styles.filtersButtonActive : null]}
        >
          <Ionicons
            name="options-outline"
            size={20}
            color={activeFilterCount > 0 ? colors.surface : colors.primaryDark}
          />
          {activeFilterCount > 0 ? (
            <View style={styles.filtersCount}>
              <Text style={styles.filtersCountText}>{activeFilterCount}</Text>
            </View>
          ) : null}
        </Pressable>
      </View>

      {isInitialLoading ? <LoadingState /> : null}
      {!currentBusinessUnitId && !isSwitchingBusinessUnit ? (
        <ErrorState message="Business unit context is syncing. Select a business unit from the header." />
      ) : null}
      {inbox.error && !inbox.data ? (
        <ErrorState message="Unable to load receiving records." />
      ) : null}

      {inbox.data && !isInitialLoading ? (
        rows.length === 0 ? (
          isDefaultView && expectedCount > 0 ? (
            <InboxEmptyState
              title="Nothing to receive right now"
              subtitle={`${expectedCount} ${expectedCount === 1 ? "load list is" : "load lists are"} on the way.`}
              actionLabel="View expected"
              onAction={() => setStage("expected")}
            />
          ) : isDefaultView ? (
            <InboxEmptyState
              title="Nothing to receive right now"
              subtitle={`Nothing is on the way to ${currentBusinessUnitName || "this business unit"}. Pull down to refresh.`}
            />
          ) : (
            <InboxEmptyState
              title="No results"
              subtitle="Try a different search or filter."
              actionLabel="Clear filters"
              onAction={clearFilters}
            />
          )
        ) : (
          <>
            {sections.map((section) => (
              <View key={section.stage} style={styles.section}>
                <View style={styles.sectionHeader} accessibilityRole="header">
                  <View
                    style={[
                      styles.sectionDot,
                      { backgroundColor: RECEIVING_INBOX_STAGE_COLORS[section.stage] },
                    ]}
                  />
                  <Text
                    style={[
                      styles.sectionTitle,
                      { color: RECEIVING_INBOX_STAGE_COLORS[section.stage] },
                    ]}
                  >
                    {RECEIVING_INBOX_STAGE_LABELS[section.stage]} ·{" "}
                    {countReceivingInbox(stageCounts, section.stage, kind)}
                  </Text>
                </View>
                <View style={styles.sectionList}>
                  {section.rows.map((row) => (
                    <ReceivingInboxListItem
                      key={`${row.kind}-${row.id}`}
                      row={row}
                      onPress={
                        canOpenReceivingInboxRow(row.kind, row.stage)
                          ? () => openRow(row)
                          : undefined
                      }
                    />
                  ))}
                </View>
              </View>
            ))}
            {inbox.hasNextPage ? (
              <Pressable
                onPress={() => void inbox.fetchNextPage()}
                disabled={inbox.isFetchingNextPage}
                accessibilityRole="button"
                style={styles.moreButton}
              >
                <Text style={styles.moreText}>
                  {inbox.isFetchingNextPage ? "Loading..." : "Show more"}
                </Text>
              </Pressable>
            ) : null}
          </>
        )
      ) : null}

      <ReceivingInboxFiltersSheet
        visible={filtersOpen}
        stage={stage}
        kind={kind}
        stageCounts={stageCounts}
        showKindFilter={showKindFilter}
        onApply={(nextStage, nextKind) => {
          setStage(nextStage);
          setKind(nextKind);
          setFiltersOpen(false);
        }}
        onClose={() => setFiltersOpen(false)}
      />
    </Screen>
  );
}

const FilterChip = ({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) => (
  <Pressable
    onPress={onPress}
    accessibilityRole="button"
    accessibilityState={{ selected: active }}
    style={[styles.chip, active ? styles.chipActive : null]}
  >
    <Text style={[styles.chipText, active ? styles.chipTextActive : null]}>{label}</Text>
  </Pressable>
);

const InboxEmptyState = ({
  title,
  subtitle,
  actionLabel,
  onAction,
}: {
  title: string;
  subtitle: string;
  actionLabel?: string;
  onAction?: () => void;
}) => (
  <Card style={styles.emptyCard}>
    <Text style={styles.emptyTitle}>{title}</Text>
    <Text style={styles.emptySubtitle}>{subtitle}</Text>
    {actionLabel && onAction ? (
      <Pressable onPress={onAction} accessibilityRole="button" style={styles.emptyAction}>
        <Text style={styles.emptyActionText}>{actionLabel}</Text>
      </Pressable>
    ) : null}
  </Card>
);

const styles = StyleSheet.create({
  filterRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  chipTrack: {
    flex: 1,
    flexDirection: "row",
    gap: spacing.xs,
    padding: spacing.xs,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
    ...softShadow,
  },
  chip: {
    flex: 1,
    minHeight: 36,
    paddingHorizontal: spacing.md,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: borderRadius.full,
  },
  chipActive: {
    backgroundColor: colors.primary,
    ...primaryGlow,
  },
  chipText: {
    fontSize: 13,
    fontWeight: typography.fontWeights.medium,
    color: colors.textSecondary,
  },
  chipTextActive: {
    fontWeight: typography.fontWeights.semibold,
    color: colors.surface,
  },
  filtersButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
    ...softShadow,
  },
  filtersButtonActive: {
    backgroundColor: colors.primary,
  },
  filtersCount: {
    position: "absolute",
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: colors.background,
    backgroundColor: colors.primaryDark,
    alignItems: "center",
    justifyContent: "center",
  },
  filtersCountText: {
    fontSize: 10,
    fontWeight: typography.fontWeights.bold,
    color: colors.surface,
  },
  section: {
    gap: spacing.sm,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  sectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  sectionTitle: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: typography.fontWeights.semibold,
  },
  sectionList: {
    gap: 10,
  },
  moreButton: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: borderRadius.full,
    borderWidth: 1.5,
    borderColor: colors.violetAvatar,
    backgroundColor: colors.surface,
  },
  moreText: {
    fontSize: 15,
    fontWeight: typography.fontWeights.semibold,
    color: colors.primaryDark,
  },
  emptyCard: {
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.xl,
  },
  emptyTitle: {
    ...typography.titleSmall,
    color: colors.text,
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
    textAlign: "center",
  },
  emptyAction: {
    marginTop: spacing.xs,
    minHeight: 44,
    paddingHorizontal: spacing.base,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: borderRadius.full,
    backgroundColor: colors.violetSoft,
  },
  emptyActionText: {
    fontSize: 14,
    fontWeight: typography.fontWeights.semibold,
    color: colors.primaryDark,
  },
});
