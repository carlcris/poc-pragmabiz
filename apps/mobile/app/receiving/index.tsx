import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Card, ErrorState, LoadingState, Screen, SearchInput, StatusBadge } from "@/components/ui";
import { queryKeys, useDeliveryNotes, useLoadLists, useReceivingWarehouse } from "@/hooks/queries";
import { useAuthStore } from "@/stores/authStore";
import { colors } from "@/theme/colors";
import { borderRadius, shadows, spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";
import { formatDate } from "@/utils/format";
import {
  canAccessDeliveryNoteReceiving,
  canAccessLoadListReceiving,
  canAccessReceiving,
} from "@/utils/permissions";

const statusFilters = [
  {
    value: "pending_receipts",
    label: "Pending Receipts",
    emptyTitle: "No load lists found",
  },
  { value: "in_transit", label: "In Transit", emptyTitle: "No load lists in transit" },
  { value: "arrived", label: "Arrived", emptyTitle: "No arrived load lists" },
  { value: "receiving", label: "Receiving", emptyTitle: "No load lists in receiving" },
  { value: "all", label: "All", emptyTitle: "No load lists found" },
];

const deliveryNoteStatusFilters = [
  { value: "all", label: "All", emptyTitle: "No delivery notes found" },
  { value: "dispatched", label: "Dispatched", emptyTitle: "No dispatched delivery notes" },
  { value: "received", label: "Received", emptyTitle: "No received delivery notes" },
];

export default function ReceivingScreen() {
  const params = useLocalSearchParams<{
    tab?: string;
    loadListStatus?: string;
    deliveryNoteStatus?: string;
  }>();
  const hasFocusedOnce = useRef(false);
  const refreshOnFocusRef = useRef<() => void>(() => undefined);
  const queryClient = useQueryClient();
  const session = useAuthStore((state) => state.session);
  const currentBusinessUnit = session?.currentBusinessUnit;
  const isSwitchingBusinessUnit = useAuthStore((state) => state.isSwitchingBusinessUnit);
  const [tab, setTab] = useState(params.tab === "delivery-notes" ? "delivery-notes" : "load-lists");
  const [status, setStatus] = useState(
    params.loadListStatus === "pending_receipts" ? "pending_receipts" : "in_transit"
  );
  const [deliveryNoteStatus, setDeliveryNoteStatus] = useState("dispatched");
  const [search, setSearch] = useState("");
  const canViewLoadListReceiving = canAccessLoadListReceiving(session);
  const canViewDeliveryNoteReceiving = canAccessDeliveryNoteReceiving(session);
  const canViewReceiving = canAccessReceiving(session);
  const receivingWarehouse = useReceivingWarehouse(
    currentBusinessUnit?.id,
    canViewLoadListReceiving
  );
  const loadLists = useLoadLists(
    status,
    search,
    receivingWarehouse.data?.warehouseId,
    canViewLoadListReceiving
  );
  const deliveryNotes = useDeliveryNotes(deliveryNoteStatus, search, canViewDeliveryNoteReceiving);
  const canLoadLoadLists = Boolean(currentBusinessUnit?.id && receivingWarehouse.data?.warehouseId);
  const isLoadListTab = tab === "load-lists";
  const isWarehouseInitialLoading =
    Boolean(currentBusinessUnit?.id) && !receivingWarehouse.data && receivingWarehouse.isFetching;
  const isLoadListsInitialLoading = canLoadLoadLists && !loadLists.data && loadLists.isFetching;
  const isLoadListsLoading =
    isSwitchingBusinessUnit || isWarehouseInitialLoading || isLoadListsInitialLoading;

  const loading = isLoadListTab ? isLoadListsLoading : deliveryNotes.isLoading;
  const error = isLoadListTab ? receivingWarehouse.error || loadLists.error : deliveryNotes.error;
  const selectedStatus = statusFilters.find((item) => item.value === status) || statusFilters[0];
  const selectedDeliveryNoteStatus =
    deliveryNoteStatusFilters.find((item) => item.value === deliveryNoteStatus) ||
    deliveryNoteStatusFilters[0];

  refreshOnFocusRef.current = () => {
    if (tab === "load-lists") {
      const queryKey = queryKeys.loadLists(
        status,
        search,
        receivingWarehouse.data?.warehouseId || ""
      );
      if (canLoadLoadLists && queryClient.getQueryState(queryKey)?.isInvalidated) {
        void loadLists.refetch();
      }
      return;
    }

    const queryKey = queryKeys.deliveryNotes(deliveryNoteStatus, search);
    if (canViewDeliveryNoteReceiving && queryClient.getQueryState(queryKey)?.isInvalidated) {
      void deliveryNotes.refetch();
    }
  };

  useEffect(() => {
    if (params.tab === "load-lists" || params.tab === "delivery-notes") {
      setTab(params.tab);
    }
    if (params.loadListStatus === "pending_receipts") {
      setStatus("pending_receipts");
    }
    if (params.deliveryNoteStatus === "dispatched") {
      setDeliveryNoteStatus("dispatched");
    }
  }, [params.deliveryNoteStatus, params.loadListStatus, params.tab]);

  useEffect(() => {
    if (tab === "load-lists" && !canViewLoadListReceiving && canViewDeliveryNoteReceiving) {
      setTab("delivery-notes");
    }
    if (tab === "delivery-notes" && !canViewDeliveryNoteReceiving && canViewLoadListReceiving) {
      setTab("load-lists");
    }
  }, [canViewDeliveryNoteReceiving, canViewLoadListReceiving, tab]);

  useFocusEffect(
    useCallback(() => {
      if (!hasFocusedOnce.current) {
        hasFocusedOnce.current = true;
        return;
      }

      refreshOnFocusRef.current();
    }, [])
  );

  if (!canViewReceiving) {
    return (
      <Screen title="Receiving" subtitle="Manage incoming deliveries">
        <ErrorState message="You do not have permission to access receiving." />
      </Screen>
    );
  }

  return (
    <Screen title="Receiving" subtitle="Manage incoming deliveries">
      <TopTabs
        value={tab}
        onChange={setTab}
        showLoadLists={canViewLoadListReceiving}
        showDeliveryNotes={canViewDeliveryNoteReceiving}
      />

      <View style={styles.statusRow}>
        {(tab === "load-lists" ? statusFilters : deliveryNoteStatusFilters).map((filter) => {
          const active =
            tab === "load-lists" ? status === filter.value : deliveryNoteStatus === filter.value;

          return (
            <Pressable
              key={filter.value}
              onPress={() => {
                if (tab === "load-lists") {
                  setStatus(filter.value);
                } else {
                  setDeliveryNoteStatus(filter.value);
                }
              }}
              style={[styles.statusButton, active ? styles.statusButtonActive : null]}
            >
              <Text style={[styles.statusText, active ? styles.statusTextActive : null]}>
                {filter.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <SearchInput
        value={search}
        onChangeText={setSearch}
        placeholder={tab === "load-lists" ? "Search by LL number..." : "Search by DN number..."}
      />

      {loading ? <LoadingState /> : null}
      {isLoadListTab && !currentBusinessUnit?.id && !isSwitchingBusinessUnit ? (
        <ErrorState message="Business unit context is syncing. Select a business unit from the header." />
      ) : null}
      {error ? <ErrorState message="Unable to load receiving records." /> : null}

      {isLoadListTab && canLoadLoadLists && loadLists.data && !loading ? (
        <>
          <Text style={styles.resultText}>{loadLists.data.length} LOAD LISTS FOUND</Text>
          {loadLists.data.length === 0 ? (
            <>
              <ReceivingEmptyState
                title={selectedStatus.emptyTitle}
                subtitle={`There are no loads currently ${selectedStatus.label.toLowerCase()} for ${receivingWarehouse.data?.name || "this warehouse"}.`}
                onRefresh={() => {
                  void receivingWarehouse.refetch();
                  void loadLists.refetch();
                }}
                onShowAll={() => setStatus("all")}
              />
              <TipCard />
            </>
          ) : (
            loadLists.data.map((item) => {
              const canOpen = item.status === "arrived" || item.status === "receiving";
              const content = (
                <Card style={styles.rowCard}>
                  <View style={styles.rowHeader}>
                    <Ionicons name="bus-outline" size={24} color={colors.textSecondary} />
                    <Text style={styles.rowTitle}>{item.llNumber}</Text>
                    <StatusBadge status={item.status} />
                    {canOpen ? (
                      <Ionicons name="chevron-forward" size={20} color={colors.muted} />
                    ) : null}
                  </View>
                  <Text style={styles.rowMeta}>{item.supplierName}</Text>
                  <Text style={styles.rowMeta}>ETA: {formatDate(item.estimatedArrivalDate)}</Text>
                  <Text style={styles.rowMeta}>{item.itemCount} lines</Text>
                </Card>
              );

              return canOpen ? (
                <Pressable
                  key={item.id}
                  onPress={() => router.push(`/receiving/load-lists/${item.id}`)}
                >
                  {content}
                </Pressable>
              ) : (
                <View key={item.id}>{content}</View>
              );
            })
          )}
        </>
      ) : null}

      {tab === "delivery-notes" && deliveryNotes.data ? (
        <>
          <Text style={styles.resultText}>{deliveryNotes.data.length} DELIVERY NOTES FOUND</Text>
          {deliveryNotes.data.length === 0 ? (
            <ReceivingEmptyState
              title={selectedDeliveryNoteStatus.emptyTitle}
              subtitle={`There are no ${selectedDeliveryNoteStatus.label.toLowerCase()} delivery notes at this branch.`}
              onRefresh={() => void deliveryNotes.refetch()}
              onShowAll={() => setDeliveryNoteStatus("all")}
              secondaryLabel="Show all"
            />
          ) : (
            deliveryNotes.data.map((item) => {
              const canOpen = item.status === "dispatched" || item.status === "received";
              const content = (
                <Card style={styles.rowCard}>
                  <View style={styles.rowHeader}>
                    <Ionicons name="document-text-outline" size={24} color={colors.textSecondary} />
                    <Text style={styles.rowTitle}>{item.code}</Text>
                    <StatusBadge status={item.status} />
                    {canOpen ? (
                      <Ionicons name="chevron-forward" size={20} color={colors.muted} />
                    ) : null}
                  </View>
                  <Text style={styles.rowMeta}>{item.fulfillmentMode}</Text>
                  <Text style={styles.rowMeta}>Dispatched: {formatDate(item.dispatchedAt)}</Text>
                  <Text style={styles.rowFooter}>
                    {item.receivedQty} / {item.totalQty} units
                  </Text>
                </Card>
              );

              return canOpen ? (
                <Pressable key={item.id} onPress={() => router.push(`/receiving/${item.id}`)}>
                  {content}
                </Pressable>
              ) : (
                <View key={item.id}>{content}</View>
              );
            })
          )}
        </>
      ) : null}
    </Screen>
  );
}

const TopTabs = ({
  value,
  onChange,
  showLoadLists,
  showDeliveryNotes,
}: {
  value: string;
  onChange: (value: string) => void;
  showLoadLists: boolean;
  showDeliveryNotes: boolean;
}) => (
  <View style={styles.topTabs}>
    {showLoadLists ? (
      <Pressable
        onPress={() => onChange("load-lists")}
        style={[styles.topTab, value === "load-lists" ? styles.topTabActive : null]}
      >
        <Ionicons
          name="bus-outline"
          size={20}
          color={value === "load-lists" ? colors.primary : colors.textSecondary}
        />
        <Text style={[styles.topTabText, value === "load-lists" ? styles.topTabTextActive : null]}>
          Load Lists
        </Text>
      </Pressable>
    ) : null}
    {showDeliveryNotes ? (
      <Pressable
        onPress={() => onChange("delivery-notes")}
        style={[styles.topTab, value === "delivery-notes" ? styles.topTabActive : null]}
      >
        <Ionicons
          name="clipboard-outline"
          size={20}
          color={value === "delivery-notes" ? colors.primary : colors.textSecondary}
        />
        <Text
          style={[styles.topTabText, value === "delivery-notes" ? styles.topTabTextActive : null]}
        >
          Delivery Notes
        </Text>
      </Pressable>
    ) : null}
  </View>
);

const ReceivingEmptyState = ({
  title,
  subtitle,
  onRefresh,
  onShowAll,
  secondaryLabel = "Change filters",
}: {
  title: string;
  subtitle: string;
  onRefresh: () => void;
  onShowAll: () => void;
  secondaryLabel?: string;
}) => (
  <Card style={styles.emptyPanel}>
    <View style={styles.emptyIconBubble}>
      <Ionicons name="cube-outline" size={40} color={colors.primary} />
    </View>
    <Text style={styles.emptyTitle}>{title}</Text>
    <Text style={styles.emptySubtitle}>{subtitle}</Text>
    <View style={styles.emptyActions}>
      <Pressable onPress={onRefresh} style={styles.emptyActionButton}>
        <Ionicons name="refresh-outline" size={16} color={colors.primary} />
        <Text style={styles.emptyActionText}>Refresh</Text>
      </Pressable>
      <Pressable onPress={onShowAll} style={styles.emptyActionButton}>
        <Ionicons name="options-outline" size={16} color={colors.primary} />
        <Text style={styles.emptyActionText}>{secondaryLabel}</Text>
      </Pressable>
    </View>
  </Card>
);

const TipCard = () => (
  <Card style={styles.tipCard}>
    <Ionicons name="information-circle-outline" size={20} color={colors.primary} />
    <Text style={styles.tipText}>
      <Text style={styles.tipStrong}>Tip: </Text>
      Switch to <Text style={styles.tipStrong}>All</Text> to see loads across all statuses, or
      change the branch and date above.
    </Text>
  </Card>
);

const styles = StyleSheet.create({
  topTabs: {
    marginHorizontal: -spacing.lg,
    marginTop: -spacing.base,
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  topTab: {
    flex: 1,
    minHeight: 56,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: spacing.sm,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  topTabActive: {
    borderBottomColor: colors.primary,
  },
  topTabText: {
    ...typography.body,
    fontWeight: typography.fontWeights.semibold,
    color: colors.textSecondary,
  },
  topTabTextActive: {
    color: colors.primary,
  },
  statusRow: {
    flexDirection: "row",
    gap: spacing.xs,
    flexWrap: "wrap",
  },
  statusButton: {
    flex: 1,
    minWidth: 80,
    minHeight: 44,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  statusButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  statusText: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: typography.fontWeights.semibold,
    textAlign: "center",
  },
  statusTextActive: {
    color: "#fff",
  },
  resultText: {
    fontSize: 11,
    color: "#9B8FC4",
    fontWeight: typography.fontWeights.semibold,
    letterSpacing: 0.8,
  },
  emptyPanel: {
    minHeight: 320,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  emptyIconBubble: {
    width: 80,
    height: 80,
    borderRadius: borderRadius.xl,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primarySoft,
  },
  emptyTitle: {
    ...typography.title,
    color: colors.text,
    textAlign: "center",
  },
  emptySubtitle: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
  },
  emptyActions: {
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  emptyActionButton: {
    minHeight: 44,
    minWidth: 110,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  emptyActionText: {
    fontSize: 14,
    color: colors.text,
    fontWeight: typography.fontWeights.semibold,
  },
  tipCard: {
    minHeight: 80,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderColor: colors.border,
    ...shadows.none,
  },
  tipText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    flex: 1,
    lineHeight: 18,
  },
  tipStrong: {
    color: colors.primary,
    fontWeight: typography.fontWeights.semibold,
  },
  rowCard: {
    gap: spacing.sm,
  },
  rowHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  rowTitle: {
    flex: 1,
    ...typography.title,
    color: colors.text,
  },
  rowMeta: {
    ...typography.body,
    color: colors.textSecondary,
  },
  rowFooter: {
    ...typography.title,
    color: colors.text,
    textAlign: "right",
  },
});
