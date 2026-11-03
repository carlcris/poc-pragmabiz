import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { router, useFocusEffect, type Href } from "expo-router";
import { useCallback, useRef } from "react";
import { Pressable, StyleSheet, Text, View, type StyleProp, type TextStyle } from "react-native";
import { createTranslator } from "use-intl/core";
import { ErrorState, LoadingState, Screen } from "@/components/ui";
import type { DashboardPickList } from "@/contracts/dashboard";
import { queryKeys, useDashboard } from "@/hooks/queries";
import { useWarehouseQueueRealtime } from "@/hooks/useWarehouseQueueRealtime";
import { useScreenFocusState } from "@/hooks/useScreenFocusState";
import { useAuthStore } from "@/stores/authStore";
import { colors } from "@/theme/colors";
import { spacing, borderRadius } from "@/theme/spacing";
import { typography } from "@/theme/typography";
import { formatTimeOfDay } from "@/utils/format";
import { canAccessPicking, canAccessReceiving } from "@/utils/permissions";
import { translations } from "../../../src/lib/i18n/translations";

// The native app currently uses English; reuse the web source of truth for dashboard copy.
const tDashboard = createTranslator({ locale: "en", messages: translations.en.mobileDashboard });

type CountPart = {
  text: string;
  color?: string;
};

const greetingFor = (date: Date, name: string) => {
  const hour = date.getHours();
  if (hour < 12) return tDashboard("goodMorning", { name });
  if (hour < 18) return tDashboard("goodAfternoon", { name });
  return tDashboard("goodEvening", { name });
};

// Only non-zero counts are shown, so an empty queue falls back to its empty copy.
const countParts = (parts: (CountPart & { count: number })[]) =>
  parts.filter((part) => part.count > 0);

export default function DashboardScreen() {
  const hasFocusedOnce = useRef(false);
  const refreshOnFocusRef = useRef<() => void>(() => undefined);
  const queryClient = useQueryClient();
  const isFocused = useScreenFocusState();
  useWarehouseQueueRealtime(isFocused);
  const dashboard = useDashboard(isFocused);
  const session = useAuthStore((state) => state.session);
  const businessUnitId = session?.currentBusinessUnit?.id || "";
  const showReceiving = canAccessReceiving(session);
  const showPicking = canAccessPicking(session);
  const showTodaysWork = showReceiving || showPicking;
  const greeting = greetingFor(
    new Date(),
    session?.user.firstName || session?.user.name || ""
  );
  const updatedTime = dashboard.dataUpdatedAt
    ? tDashboard("updatedTime", { time: formatTimeOfDay(new Date(dashboard.dataUpdatedAt)) })
    : "";

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
  const waitingTotal = data
    ? (showReceiving ? data.receiving.ready : 0) + (showPicking ? data.picking.pending : 0)
    : 0;
  const inProgressTotal = data
    ? (showReceiving ? data.receiving.inProgress : 0) + (showPicking ? data.picking.inProgress : 0)
    : 0;
  const hasNoWork = waitingTotal === 0 && inProgressTotal === 0;

  return (
    <Screen
      title={updatedTime}
      greeting={greeting}
      onRefresh={async () => {
        await dashboard.refetch();
      }}
      refreshing={dashboard.isRefetching}
    >
      {dashboard.isLoading ? <LoadingState /> : null}
      {dashboard.error ? <ErrorState message={tDashboard("loadError")} /> : null}
      {data ? (
        <>
          {showTodaysWork ? (
            <View style={styles.hero}>
              <View style={[styles.heroCircle, styles.heroCircleLarge]} />
              <View style={[styles.heroCircle, styles.heroCircleSmall]} />
              <HeroBox />
              {hasNoWork ? (
                <View style={styles.heroSummary}>
                  <Text style={styles.heroLabel}>{tDashboard("openTasksToday")}</Text>
                  <Text style={styles.heroCaughtUp} accessibilityRole="header">
                    {tDashboard("allCaughtUp")}
                  </Text>
                  <Text style={styles.heroLabel}>{tDashboard("noWorkHint")}</Text>
                </View>
              ) : (
                <View style={styles.heroSummary}>
                  <Text style={styles.heroLabel} accessibilityRole="header">
                    {tDashboard("openTasksToday")}
                  </Text>
                  <Text style={styles.heroCount}>{waitingTotal + inProgressTotal}</Text>
                  <CountLine
                    style={styles.heroLabel}
                    parts={countParts([
                      {
                        count: inProgressTotal,
                        text: tDashboard("inProgressCount", { count: inProgressTotal }),
                        color: colors.statusInfo,
                      },
                      { count: waitingTotal, text: tDashboard("waitingCount", { count: waitingTotal }) },
                    ])}
                  />
                </View>
              )}

              <View style={styles.queueStrip}>
                {showReceiving ? (
                  <QueueHalf
                    title={tDashboard("receiving")}
                    count={data.receiving.ready + data.receiving.inProgress}
                    emptyText={tDashboard("receivingEmpty")}
                    parts={countParts([
                      {
                        count: data.receiving.ready,
                        text: tDashboard("readyCount", { count: data.receiving.ready }),
                        color: colors.statusSuccess,
                      },
                      {
                        count: data.receiving.inProgress,
                        text: tDashboard("startedCount", { count: data.receiving.inProgress }),
                        color: colors.statusInfo,
                      },
                    ])}
                    onPress={() => router.push("/receiving")}
                  />
                ) : null}
                {showReceiving && showPicking ? <View style={styles.queueStripDivider} /> : null}
                {showPicking ? (
                  <QueueHalf
                    title={tDashboard("picking")}
                    count={data.picking.pending + data.picking.inProgress}
                    emptyText={tDashboard("pickingEmpty")}
                    parts={countParts([
                      {
                        count: data.picking.inProgress,
                        text: tDashboard("startedCount", { count: data.picking.inProgress }),
                        color: colors.statusInfo,
                      },
                      {
                        count: data.picking.pending,
                        text: tDashboard("pendingCount", { count: data.picking.pending }),
                      },
                    ])}
                    onPress={() => router.push("/picking")}
                  />
                ) : null}
              </View>
            </View>
          ) : null}

          <QuickActions showReceiving={showReceiving} showPicking={showPicking} />

          {assignedPickList ? (
            <AssignedPickListCard
              pickList={assignedPickList}
              onPress={() => router.push(`/picking/${assignedPickList.id}`)}
            />
          ) : null}

          {data.urgentStockRequests > 0 ? (
            <View style={[styles.banner, styles.bannerUrgent]}>
              <View style={[styles.bannerCircle, styles.bannerCircleUrgent]} />
              <View style={styles.bannerIcon} importantForAccessibility="no-hide-descendants">
                <Ionicons name="warning-outline" size={44} color={colors.amberDark} />
              </View>
              <Text style={[styles.bannerTitle, styles.bannerTitleUrgent]}>
                {tDashboard("urgentStockRequests", { count: data.urgentStockRequests })}
              </Text>
              <Text style={[styles.bannerText, styles.bannerTextUrgent]}>
                {tDashboard("urgentStockRequestsHint")}
              </Text>
            </View>
          ) : (
            <View style={styles.statusRow}>
              <View style={styles.statusIcon}>
                <Ionicons name="checkmark" size={16} color={colors.statusSuccess} />
              </View>
              <Text style={styles.statusText}>{tDashboard("noUrgentStockRequests")}</Text>
            </View>
          )}

          {hasNoWork ? (
            <Pressable
              onPress={() => router.push("/more/item-info")}
              accessibilityRole="button"
              accessibilityLabel={tDashboard("quickScanItem")}
              style={({ pressed }) => [styles.banner, styles.bannerItem, pressed && styles.pressed]}
            >
              <View style={[styles.bannerCircle, styles.bannerCircleItem]} />
              <View style={[styles.bannerIcon, styles.bannerIconItem]} importantForAccessibility="no-hide-descendants">
                <Ionicons name="scan-outline" size={70} color={colors.violet} />
              </View>
              <Text style={styles.bannerTitle}>{tDashboard("checkAnItem")}</Text>
              <Text style={styles.bannerText}>{tDashboard("checkAnItemHint")}</Text>
              <View style={styles.bannerButton}>
                <Text style={styles.bannerButtonText}>{tDashboard("quickScanItem")}</Text>
              </View>
            </Pressable>
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}

const CountLine = ({
  parts,
  style,
}: {
  parts: CountPart[];
  style: StyleProp<TextStyle>;
}) => (
  <Text style={style}>
    {parts.map((part, index) => (
      <Text key={part.text}>
        {index > 0 ? " · " : ""}
        <Text style={part.color ? [styles.countPart, { color: part.color }] : null}>{part.text}</Text>
      </Text>
    ))}
  </Text>
);

const QueueHalf = ({
  title,
  count,
  emptyText,
  parts,
  onPress,
}: {
  title: string;
  count: number;
  emptyText: string;
  parts: CountPart[];
  onPress: () => void;
}) => {
  const isEmpty = count === 0;
  const detail = isEmpty ? emptyText : parts.map((part) => part.text).join(" · ");

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={tDashboard("queueRowAccessibilityLabel", { title, count, detail })}
      style={({ pressed }) => [styles.queueHalf, pressed && styles.pressed]}
    >
      <View style={styles.queueHalfText}>
        <Text style={styles.queueHalfTitle}>{title}</Text>
        <Text style={[styles.queueHalfCount, isEmpty && styles.queueHalfCountEmpty]}>{count}</Text>
        {isEmpty ? (
          <Text style={styles.queueHalfDetail} numberOfLines={1}>
            {emptyText}
          </Text>
        ) : (
          <CountLine style={styles.queueHalfDetail} parts={parts} />
        )}
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.muted} />
    </Pressable>
  );
};

type QuickAction = {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  route: Href;
  background: string;
  color: string;
  featured?: boolean;
};

const QuickActions = ({
  showReceiving,
  showPicking,
}: {
  showReceiving: boolean;
  showPicking: boolean;
}) => {
  const actions: QuickAction[] = [
    ...(showReceiving
      ? [
          {
            key: "receive",
            label: tDashboard("quickReceive"),
            icon: "cube-outline" as const,
            route: "/receiving" as const,
            background: colors.violet,
            color: colors.surface,
            featured: true,
          },
        ]
      : []),
    ...(showPicking
      ? [
          {
            key: "pick",
            label: tDashboard("quickPick"),
            icon: "checkbox-outline" as const,
            route: "/picking" as const,
            background: colors.mintSoft,
            color: colors.statusSuccess,
          },
        ]
      : []),
    {
      key: "scan",
      label: tDashboard("quickScanItem"),
      icon: "scan-outline",
      route: "/more/item-info",
      background: colors.violetSoft,
      color: colors.statusReview,
    },
    {
      key: "profile",
      label: tDashboard("quickProfile"),
      icon: "person-outline",
      route: "/profile",
      background: colors.limeSoft,
      color: colors.limeDark,
    },
  ];

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle} accessibilityRole="header">
        {tDashboard("quickActions")}
      </Text>
      <View style={styles.quickActions}>
        {actions.map((action) => (
          <Pressable
            key={action.key}
            onPress={() => router.push(action.route)}
            accessibilityRole="button"
            accessibilityLabel={action.label}
            style={({ pressed }) => [styles.quickAction, pressed && styles.pressed]}
          >
            <View
              style={[
                styles.quickActionCircle,
                { backgroundColor: action.background },
                action.featured && styles.quickActionFeatured,
              ]}
            >
              <Ionicons name={action.icon} size={26} color={action.color} />
            </View>
            <Text style={styles.quickActionLabel} numberOfLines={1}>
              {action.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
};

const AssignedPickListCard = ({
  pickList,
  onPress,
}: {
  pickList: DashboardPickList;
  onPress: () => void;
}) => {
  const isStarted = pickList.status !== "pending";
  const context = [pickList.deliveryNoteCode, pickList.warehouseName].filter(Boolean).join(" · ");
  const progress = pickList.lineCount > 0 ? pickList.pickedLineCount / pickList.lineCount : 0;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={tDashboard("pickListActionAccessibilityLabel", {
        action: tDashboard(isStarted ? "resumePicking" : "startPicking"),
        code: pickList.code,
      })}
      style={({ pressed }) => [styles.card, styles.pickCard, pressed && styles.pressed]}
    >
      <View style={styles.pickCardHeader}>
        <Text style={styles.cardTitle}>{tDashboard(isStarted ? "continuePicking" : "nextUp")}</Text>
        <Text style={styles.pickCardAction}>{tDashboard(isStarted ? "resume" : "start")}</Text>
      </View>
      <View style={styles.pickCardBody}>
        <View style={styles.pickCardIcon}>
          <Ionicons name="checkbox-outline" size={24} color={colors.statusReview} />
        </View>
        <View style={styles.pickCardText}>
          <View style={styles.pickCardTop}>
            <Text style={styles.pickCardCode} numberOfLines={1}>
              {pickList.code}
            </Text>
            <Text style={styles.pickCardMeta}>
              {isStarted
                ? tDashboard("linesProgress", {
                    picked: pickList.pickedLineCount,
                    total: pickList.lineCount,
                  })
                : tDashboard("lineCount", { count: pickList.lineCount })}
            </Text>
          </View>
          {isStarted ? (
            <View
              style={styles.progressTrack}
              accessibilityRole="progressbar"
              accessibilityValue={{ min: 0, max: pickList.lineCount, now: pickList.pickedLineCount }}
            >
              <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
            </View>
          ) : null}
          {context ? (
            <Text style={styles.pickCardMeta} numberOfLines={1}>
              {context}
            </Text>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
};

// Android elevation shadows take shadowColor (API 28+), keeping the soft violet tint of the mock.
const softShadow = {
  shadowColor: colors.violetDark,
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.05,
  shadowRadius: 3,
  elevation: 1,
};

const BOX_WIDTH = 88;
const BOX_HALF = BOX_WIDTH / 2;
const BOX_QUARTER = BOX_WIDTH / 4;
const BOX_SIDE_HEIGHT = 52;

// Android cannot render skewed views, so the isometric faces are built from border triangles
// (top rhombus: two triangles; each side: a rectangle with a triangle cap above and below).
const HeroBox = () => (
  <View style={styles.heroBox} importantForAccessibility="no-hide-descendants">
    <View style={[styles.boxShape, styles.boxTopUp]} />
    <View style={[styles.boxShape, styles.boxTopDown]} />
    <View style={[styles.boxShape, styles.boxLeftCap]} />
    <View style={[styles.boxShape, styles.boxLeftBody]} />
    <View style={[styles.boxShape, styles.boxLeftFoot]} />
    <View style={[styles.boxShape, styles.boxRightCap]} />
    <View style={[styles.boxShape, styles.boxRightBody]} />
    <View style={[styles.boxShape, styles.boxRightFoot]} />
  </View>
);

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.7,
  },
  hero: {
    overflow: "hidden",
    borderRadius: 22,
    backgroundColor: colors.violetSoft,
    shadowColor: colors.violetDark,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 8,
    paddingTop: 18,
    paddingHorizontal: 18,
    paddingBottom: 14,
    gap: spacing.base,
  },
  heroCircle: {
    position: "absolute",
    backgroundColor: colors.violet,
  },
  heroCircleLarge: {
    right: -40,
    top: -50,
    width: 180,
    height: 180,
    borderRadius: 90,
    opacity: 0.12,
  },
  heroCircleSmall: {
    right: 50,
    top: 60,
    width: 70,
    height: 70,
    borderRadius: 35,
    opacity: 0.08,
  },
  heroBox: {
    position: "absolute",
    right: 22,
    top: 12,
    width: BOX_WIDTH,
    height: BOX_HALF + BOX_SIDE_HEIGHT,
    transform: [{ rotate: "-10deg" }],
  },
  boxShape: {
    position: "absolute",
    width: 0,
    height: 0,
    borderColor: "transparent",
  },
  boxTopUp: {
    left: 0,
    top: 0,
    borderLeftWidth: BOX_HALF,
    borderRightWidth: BOX_HALF,
    borderBottomWidth: BOX_QUARTER,
    borderBottomColor: colors.violetLight,
  },
  boxTopDown: {
    left: 0,
    top: BOX_QUARTER,
    borderLeftWidth: BOX_HALF,
    borderRightWidth: BOX_HALF,
    borderTopWidth: BOX_QUARTER,
    borderTopColor: colors.violetLight,
  },
  boxLeftCap: {
    left: 0,
    top: BOX_QUARTER,
    borderRightWidth: BOX_HALF,
    borderBottomWidth: BOX_QUARTER,
    borderBottomColor: colors.violetMid,
  },
  boxLeftBody: {
    left: 0,
    top: BOX_HALF - 0.5,
    width: BOX_HALF,
    height: BOX_SIDE_HEIGHT - BOX_QUARTER + 1,
    backgroundColor: colors.violetMid,
  },
  boxLeftFoot: {
    left: 0,
    top: BOX_QUARTER + BOX_SIDE_HEIGHT,
    borderLeftWidth: BOX_HALF,
    borderTopWidth: BOX_QUARTER,
    borderTopColor: colors.violetMid,
  },
  boxRightCap: {
    left: BOX_HALF,
    top: BOX_QUARTER,
    borderLeftWidth: BOX_HALF,
    borderBottomWidth: BOX_QUARTER,
    borderBottomColor: colors.violet,
  },
  boxRightBody: {
    left: BOX_HALF,
    top: BOX_HALF - 0.5,
    width: BOX_HALF,
    height: BOX_SIDE_HEIGHT - BOX_QUARTER + 1,
    backgroundColor: colors.violet,
  },
  boxRightFoot: {
    left: BOX_HALF,
    top: BOX_QUARTER + BOX_SIDE_HEIGHT,
    borderRightWidth: BOX_HALF,
    borderTopWidth: BOX_QUARTER,
    borderTopColor: colors.violet,
  },
  heroSummary: {
    gap: spacing.xs,
    paddingRight: 112,
  },
  heroLabel: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.violetText,
  },
  heroCount: {
    fontSize: 40,
    lineHeight: 44,
    fontWeight: typography.fontWeights.bold,
    color: colors.text,
    letterSpacing: -0.5,
    fontVariant: ["tabular-nums"],
  },
  heroCaughtUp: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: typography.fontWeights.bold,
    color: colors.text,
    letterSpacing: -0.3,
  },
  countPart: {
    fontWeight: typography.fontWeights.medium,
  },
  queueStrip: {
    flexDirection: "row",
    borderRadius: borderRadius.lg,
    backgroundColor: colors.surface,
    shadowColor: colors.text,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  queueStripDivider: {
    width: 1,
    marginVertical: spacing.md,
    backgroundColor: colors.violetFaint,
  },
  queueHalf: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingVertical: spacing.md,
    paddingLeft: 14,
    paddingRight: 10,
  },
  queueHalfText: {
    flex: 1,
    gap: 2,
  },
  queueHalfTitle: {
    fontSize: 12,
    lineHeight: 16,
    color: colors.textSecondary,
  },
  queueHalfCount: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: typography.fontWeights.bold,
    color: colors.text,
    fontVariant: ["tabular-nums"],
  },
  queueHalfCountEmpty: {
    color: colors.muted,
  },
  queueHalfDetail: {
    fontSize: 12,
    lineHeight: 16,
    color: colors.textSecondary,
  },
  card: {
    borderRadius: borderRadius.xl,
    backgroundColor: colors.surface,
    padding: 14,
    ...softShadow,
  },
  cardTitle: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: typography.fontWeights.bold,
    color: colors.text,
  },
  quickActions: {
    flexDirection: "row",
    marginTop: 14,
  },
  quickAction: {
    flex: 1,
    alignItems: "center",
    gap: spacing.sm,
  },
  quickActionCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  quickActionFeatured: {
    shadowColor: colors.violet,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  quickActionLabel: {
    fontSize: 12,
    lineHeight: 16,
    color: colors.text,
  },
  pickCard: {
    paddingHorizontal: spacing.base,
    gap: 10,
  },
  pickCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  pickCardAction: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: typography.fontWeights.medium,
    color: colors.statusReview,
  },
  pickCardBody: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  pickCardIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.violetSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  pickCardText: {
    flex: 1,
    gap: 6,
  },
  pickCardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  pickCardCode: {
    flexShrink: 1,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: typography.fontWeights.medium,
    color: colors.text,
  },
  pickCardMeta: {
    fontSize: 12,
    lineHeight: 16,
    color: colors.textSecondary,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.violetFaint,
    overflow: "hidden",
  },
  progressFill: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.violet,
  },
  banner: {
    overflow: "hidden",
    borderRadius: borderRadius.xl,
    padding: spacing.base,
    gap: spacing.xs,
    alignItems: "flex-start",
  },
  bannerUrgent: {
    backgroundColor: colors.amberBanner,
  },
  bannerItem: {
    backgroundColor: colors.violetSoft,
    paddingVertical: 18,
    gap: 6,
  },
  bannerCircle: {
    position: "absolute",
  },
  bannerCircleUrgent: {
    right: -24,
    bottom: -36,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.amber,
    opacity: 0.14,
  },
  bannerCircleItem: {
    right: -30,
    bottom: -40,
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: colors.violet,
    opacity: 0.12,
  },
  bannerIcon: {
    position: "absolute",
    right: 18,
    top: spacing.base,
  },
  bannerIconItem: {
    right: 22,
    top: 22,
    transform: [{ rotate: "8deg" }],
  },
  bannerTitle: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: typography.fontWeights.bold,
    color: colors.text,
    maxWidth: 240,
  },
  bannerTitleUrgent: {
    color: colors.amberText,
  },
  bannerText: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.violetText,
    maxWidth: 220,
  },
  bannerTextUrgent: {
    color: colors.amberText,
  },
  bannerButton: {
    marginTop: 6,
    borderRadius: borderRadius.full,
    backgroundColor: colors.violetDark,
    paddingVertical: spacing.sm,
    paddingHorizontal: 14,
  },
  bannerButtonText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: typography.fontWeights.medium,
    color: colors.surface,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.surface,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.base,
    ...softShadow,
  },
  statusIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.mintSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  statusText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: colors.text,
  },
});
