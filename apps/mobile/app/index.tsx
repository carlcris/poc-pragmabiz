import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useRef } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { createTranslator } from "use-intl/core";
import { Card, ErrorState, LoadingState, Screen } from "@/components/ui";
import type { DashboardPickList } from "@/contracts/dashboard";
import { queryKeys, useDashboard } from "@/hooks/queries";
import { useScreenFocusState } from "@/hooks/useScreenFocusState";
import { useAuthStore } from "@/stores/authStore";
import { colors } from "@/theme/colors";
import { spacing, borderRadius, sizes } from "@/theme/spacing";
import { typography } from "@/theme/typography";
import { formatTimeOfDay, formatWeekdayDate } from "@/utils/format";
import { canAccessPicking, canAccessReceiving } from "@/utils/permissions";
import { translations } from "../../../src/lib/i18n/translations";

// The native app currently uses English; reuse the web source of truth for dashboard copy.
const tDashboard = createTranslator({ locale: "en", messages: translations.en.mobileDashboard });

const receivingDetail = (ready: number, inProgress: number) => {
  if (ready > 0 && inProgress > 0) {
    return tDashboard("receivingReadyAndInProgress", { ready, inProgress });
  }
  if (ready > 0) return tDashboard("receivingReady", { count: ready });
  if (inProgress > 0) return tDashboard("receivingInProgress", { count: inProgress });
  return tDashboard("receivingEmpty");
};

const pickingDetail = (pending: number, inProgress: number) => {
  if (pending > 0 && inProgress > 0) {
    return tDashboard("pickingInProgressAndPending", { inProgress, pending });
  }
  if (pending > 0) return tDashboard("pickingPending", { count: pending });
  if (inProgress > 0) return tDashboard("pickingInProgress", { count: inProgress });
  return tDashboard("pickingEmpty");
};

export default function DashboardScreen() {
  const hasFocusedOnce = useRef(false);
  const refreshOnFocusRef = useRef<() => void>(() => undefined);
  const queryClient = useQueryClient();
  const isFocused = useScreenFocusState();
  const dashboard = useDashboard(isFocused);
  const session = useAuthStore((state) => state.session);
  const businessUnitId = session?.currentBusinessUnit?.id || "";
  const showReceiving = canAccessReceiving(session);
  const showPicking = canAccessPicking(session);
  const showTodaysWork = showReceiving || showPicking;
  const today = formatWeekdayDate(new Date());
  const headerTitle = dashboard.dataUpdatedAt
    ? tDashboard("updatedAt", {
        date: today,
        time: formatTimeOfDay(new Date(dashboard.dataUpdatedAt)),
      })
    : today;

  refreshOnFocusRef.current = () => {
    if (
      businessUnitId &&
      queryClient.getQueryState(queryKeys.dashboard(businessUnitId))?.isInvalidated
    ) {
      void dashboard.refetch();
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

  const data = dashboard.data;
  const assignedPickList = showPicking ? (data?.picking.assignedPickList ?? null) : null;
  const receivingTotal = data ? data.receiving.ready + data.receiving.inProgress : 0;
  const pickingTotal = data ? data.picking.pending + data.picking.inProgress : 0;
  const hasNoWork =
    (!showReceiving || receivingTotal === 0) && (!showPicking || pickingTotal === 0);

  return (
    <Screen
      title={headerTitle}
      onRefresh={async () => {
        await dashboard.refetch();
      }}
      refreshing={dashboard.isRefetching}
    >
      {dashboard.isLoading ? <LoadingState /> : null}
      {dashboard.error ? <ErrorState message={tDashboard("loadError")} /> : null}
      {data ? (
        <>
          {assignedPickList ? (
            <AssignedPickListCard
              pickList={assignedPickList}
              onPress={() => router.push(`/picking/${assignedPickList.id}`)}
            />
          ) : null}

          {showTodaysWork ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle} accessibilityRole="header">
                {tDashboard("todaysWork")}
              </Text>
              <Card style={styles.workCard}>
                {showReceiving ? (
                  <WorkRow
                    title={tDashboard("receiving")}
                    detail={receivingDetail(data.receiving.ready, data.receiving.inProgress)}
                    icon="package-variant-closed"
                    count={receivingTotal}
                    tone="indigo"
                    onPress={() => router.push("/receiving")}
                  />
                ) : null}
                {showReceiving && showPicking ? <View style={styles.divider} /> : null}
                {showPicking ? (
                  <WorkRow
                    title={tDashboard("picking")}
                    detail={pickingDetail(data.picking.pending, data.picking.inProgress)}
                    icon="package-variant-plus"
                    count={pickingTotal}
                    tone="green"
                    onPress={() => router.push("/picking")}
                  />
                ) : null}
              </Card>
              {hasNoWork ? <Text style={styles.noWorkHint}>{tDashboard("noWorkHint")}</Text> : null}
            </View>
          ) : null}

          {data.urgentStockRequests > 0 ? (
            <Card style={styles.attentionCard}>
              <Ionicons name="alert-circle-outline" size={24} color={colors.statusWarning} />
              <View style={styles.attentionContent}>
                <Text style={styles.attentionTitle}>
                  {tDashboard("urgentStockRequests", { count: data.urgentStockRequests })}
                </Text>
                <Text style={styles.attentionDetail}>{tDashboard("urgentStockRequestsHint")}</Text>
              </View>
            </Card>
          ) : (
            <Card style={[styles.attentionCard, styles.allClearCard]}>
              <Ionicons name="checkmark-circle-outline" size={24} color={colors.statusSuccess} />
              <View style={styles.attentionContent}>
                <Text style={[styles.attentionTitle, styles.allClearTitle]}>
                  {tDashboard("noUrgentTasks")}
                </Text>
                <Text style={styles.attentionDetail}>{tDashboard("noUrgentTasksHint")}</Text>
              </View>
            </Card>
          )}
        </>
      ) : null}
    </Screen>
  );
}

const AssignedPickListCard = ({
  pickList,
  onPress,
}: {
  pickList: DashboardPickList;
  onPress: () => void;
}) => {
  const isStarted = pickList.status !== "pending";
  const context = [pickList.warehouseName, pickList.deliveryNoteCode].filter(Boolean).join(" · ");
  const progress = pickList.lineCount > 0 ? pickList.pickedLineCount / pickList.lineCount : 0;

  return (
    <Card style={styles.pickCard}>
      <Text style={styles.sectionTitle} accessibilityRole="header">
        {tDashboard(isStarted ? "continuePicking" : "nextUp")}
      </Text>
      <View style={styles.pickIdentity}>
        <Text style={styles.pickCode}>{pickList.code}</Text>
        <Text style={styles.pickContext}>
          {[context, isStarted ? null : tDashboard("lineCount", { count: pickList.lineCount })]
            .filter(Boolean)
            .join(" · ")}
        </Text>
      </View>
      {isStarted ? (
        <View style={styles.progressBlock}>
          <View
            style={styles.progressTrack}
            accessibilityRole="progressbar"
            accessibilityValue={{ min: 0, max: pickList.lineCount, now: pickList.pickedLineCount }}
          >
            <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
          </View>
          <Text style={styles.progressText}>
            {tDashboard("linesPicked", {
              picked: pickList.pickedLineCount,
              total: pickList.lineCount,
            })}
          </Text>
        </View>
      ) : null}
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        style={({ pressed }) => [styles.pickButton, pressed && styles.pickButtonPressed]}
      >
        <Text style={styles.pickButtonText}>
          {tDashboard(isStarted ? "resumePicking" : "startPicking")}
        </Text>
        <Ionicons name="arrow-forward" size={18} color={colors.surface} />
      </Pressable>
    </Card>
  );
};

const WorkRow = ({
  title,
  detail,
  icon,
  count,
  tone,
  onPress,
}: {
  title: string;
  detail: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  count: number;
  tone: "indigo" | "green";
  onPress: () => void;
}) => {
  const isEmpty = count === 0;
  const iconColor = isEmpty
    ? colors.textSecondary
    : tone === "green"
      ? colors.statusSuccess
      : colors.primaryDark;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={tDashboard("workRowAccessibilityLabel", { title, count, detail })}
      style={({ pressed }) => [styles.workRow, pressed && styles.workRowPressed]}
    >
      <View
        style={[
          styles.workIcon,
          isEmpty ? styles.workIconEmpty : tone === "green" ? styles.workIconGreen : styles.workIconIndigo,
        ]}
      >
        <MaterialCommunityIcons name={icon} size={24} color={iconColor} />
      </View>
      <View style={styles.workContent}>
        <Text style={styles.workTitle}>{title}</Text>
        <Text style={styles.workDetail}>{detail}</Text>
      </View>
      <Text style={[styles.workCount, isEmpty && styles.workCountEmpty]}>{count}</Text>
      <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textSecondary} />
    </Pressable>
  );
};

const styles = StyleSheet.create({
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: typography.fontWeights.semibold,
    color: colors.statusNeutral,
    marginHorizontal: spacing.xs,
  },
  pickCard: {
    gap: spacing.md,
    padding: spacing.base,
    borderWidth: 0,
  },
  pickIdentity: {
    gap: 2,
  },
  pickCode: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: typography.fontWeights.bold,
    color: colors.text,
  },
  pickContext: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  progressBlock: {
    gap: 6,
  },
  progressTrack: {
    height: 8,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.border,
    overflow: "hidden",
  },
  progressFill: {
    height: 8,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.primaryDark,
  },
  progressText: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary,
  },
  pickButton: {
    minHeight: sizes.button.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primaryDark,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  pickButtonPressed: {
    opacity: 0.85,
  },
  pickButtonText: {
    fontSize: 15,
    fontWeight: typography.fontWeights.semibold,
    color: colors.surface,
  },
  workCard: {
    padding: 0,
    overflow: "hidden",
    borderWidth: 0,
  },
  workRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.base,
    minHeight: 80,
  },
  workRowPressed: {
    backgroundColor: colors.backgroundSecondary,
  },
  workIcon: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  workIconIndigo: {
    backgroundColor: colors.primarySoft,
  },
  workIconGreen: {
    backgroundColor: colors.greenSoft,
  },
  workIconEmpty: {
    backgroundColor: colors.backgroundSecondary,
  },
  workContent: {
    flex: 1,
    gap: 2,
  },
  workTitle: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: typography.fontWeights.semibold,
    color: colors.text,
  },
  workDetail: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  workCount: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: typography.fontWeights.bold,
    color: colors.text,
    fontVariant: ["tabular-nums"],
  },
  workCountEmpty: {
    color: colors.textSecondary,
  },
  divider: {
    height: 1,
    marginLeft: 76,
    backgroundColor: colors.backgroundSecondary,
  },
  noWorkHint: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary,
    marginHorizontal: spacing.xs,
  },
  attentionCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
    padding: spacing.base,
    borderColor: colors.amber,
  },
  attentionContent: {
    flex: 1,
    gap: 2,
  },
  attentionTitle: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: typography.fontWeights.semibold,
    color: colors.statusWarning,
  },
  attentionDetail: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  allClearCard: {
    borderColor: colors.green,
  },
  allClearTitle: {
    color: colors.statusSuccess,
  },
});
