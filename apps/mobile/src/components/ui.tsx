import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import { router, usePathname } from "expo-router";
import type { Href } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  View,
  ViewStyle,
  Vibration
} from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "@/theme/colors";
import { useBusinessUnits, useSetBusinessUnit } from "@/hooks/queries";
import { useAuthStore } from "@/stores/authStore";
import { spacing, borderRadius, shadows, sizes } from "@/theme/spacing";
import { typography } from "@/theme/typography";
import { todayLabel } from "@/utils/format";
import { titleCaseStatus } from "@/utils/record";

export const Screen = ({
  title,
  subtitle,
  back,
  children,
  onRefresh,
  refreshing
}: {
  title: string;
  subtitle?: string;
  back?: boolean;
  children: React.ReactNode;
  onRefresh?: () => Promise<void> | void;
  refreshing?: boolean;
}) => {
  const queryClient = useQueryClient();
  const [internalRefreshing, setInternalRefreshing] = useState(false);
  const isRefreshing = refreshing ?? internalRefreshing;

  const handleRefresh = useCallback(async () => {
    if (isRefreshing) return;
    setInternalRefreshing(true);
    try {
      if (onRefresh) {
        await onRefresh();
      } else {
        await queryClient.invalidateQueries();
      }
    } finally {
      setInternalRefreshing(false);
    }
  }, [isRefreshing, onRefresh, queryClient]);

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <View style={styles.headerContent}>
          {back ? (
            <Pressable
              onPress={() => router.back()}
              style={({ pressed }) => [
                styles.backButton,
                pressed && styles.backButtonPressed
              ]}
            >
              <Ionicons name="arrow-back" size={24} color={colors.text} />
            </Pressable>
          ) : null}
          <View style={styles.headerTitleBlock}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {title}
            </Text>
            {subtitle ? (
              <Text style={styles.headerSubtitle} numberOfLines={1}>
                {subtitle}
              </Text>
            ) : null}
          </View>
        </View>
        <Pressable
          style={({ pressed }) => [
            styles.notificationButton,
            pressed && styles.notificationButtonPressed
          ]}
        >
          <Ionicons name="notifications-outline" size={22} color={colors.text} />
          <View style={styles.notificationBadge} />
        </Pressable>
      </View>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        <BusinessDateBar />
        {children}
      </ScrollView>
    </SafeAreaView>
  );
};

export const BusinessDateBar = () => {
  const [open, setOpen] = useState(false);
  const session = useAuthStore((state) => state.session);
  const businessUnits = useBusinessUnits();
  const setBusinessUnit = useSetBusinessUnit();
  const currentBusinessUnit =
    session?.currentBusinessUnit ||
    businessUnits.data?.find((unit) => unit.access?.is_default) ||
    businessUnits.data?.[0] ||
    null;

  useEffect(() => {
    if (
      session &&
      currentBusinessUnit?.id &&
      session.currentBusinessUnit?.id !== currentBusinessUnit.id &&
      !setBusinessUnit.isPending
    ) {
      setBusinessUnit.mutate(currentBusinessUnit.id);
    }
  }, [
    currentBusinessUnit?.id,
    session,
    session?.currentBusinessUnit?.id,
    setBusinessUnit
  ]);

  const handleSelect = (businessUnitId: string) => {
    setOpen(false);
    setBusinessUnit.mutate(businessUnitId, {
      onError: () => setOpen(true)
    });
  };

  return (
    <View style={styles.contextBar}>
      <Pressable
        style={[styles.contextPill, { flex: 1 }]}
        onPress={() => setOpen(true)}
        disabled={businessUnits.isLoading || setBusinessUnit.isPending}
      >
        <MaterialCommunityIcons name="warehouse" size={18} color={colors.primary} />
        <Text style={styles.contextText} numberOfLines={1}>
          {businessUnits.isLoading ? "Loading business units..." : currentBusinessUnit?.name || "Select business unit"}
        </Text>
        <Ionicons name="chevron-expand" size={16} color={colors.muted} style={{ marginLeft: "auto" }} />
      </Pressable>
      <View style={styles.contextPill}>
        <Text style={styles.dateIcon}>📅</Text>
        <Text style={styles.contextText}>{todayLabel()}</Text>
      </View>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.switcherBackdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.switcherPanel}>
            <View style={styles.switcherHeader}>
              <Text style={styles.switcherTitle}>Business Unit</Text>
              <Pressable onPress={() => setOpen(false)} style={styles.switcherClose}>
                <Ionicons name="close" size={22} color={colors.text} />
              </Pressable>
            </View>
            {businessUnits.error ? (
              <Text style={styles.switcherError}>Unable to load business units.</Text>
            ) : null}
            {(businessUnits.data || []).map((unit) => {
              const active = unit.id === currentBusinessUnit?.id;
              return (
                <Pressable
                  key={unit.id}
                  style={[styles.switcherOption, active ? styles.switcherOptionActive : null]}
                  disabled={setBusinessUnit.isPending || active}
                  onPress={() => handleSelect(unit.id)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.switcherOptionName}>{unit.name}</Text>
                    <Text style={styles.switcherOptionMeta}>
                      {unit.code} {unit.access?.role ? `• ${unit.access.role}` : ""}
                    </Text>
                  </View>
                  {active ? (
                    <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
                  ) : null}
                </Pressable>
              );
            })}
            {setBusinessUnit.error ? (
              <Text style={styles.switcherError}>
                {setBusinessUnit.error instanceof Error
                  ? setBusinessUnit.error.message
                  : "Failed to switch business unit."}
              </Text>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
};

export const Card = ({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) => (
  <View style={[styles.card, style]}>{children}</View>
);

export const ActionButton = ({
  label,
  icon,
  variant = "primary",
  disabled,
  onPress,
  style
}: {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  variant?: "primary" | "secondary" | "success";
  disabled?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}) => (
  <Pressable
    disabled={disabled}
    onPress={onPress}
    style={[
      styles.button,
      variant === "secondary" ? styles.buttonSecondary : null,
      variant === "success" ? styles.buttonSuccess : null,
      disabled ? styles.buttonDisabled : null,
      style
    ]}
  >
    {icon ? (
      <Ionicons
        name={icon}
        size={22}
        color={variant === "secondary" ? "#000" : "#fff"}
        style={{ marginRight: 12 }}
      />
    ) : null}
    <Text style={[styles.buttonText, variant === "secondary" ? styles.buttonTextSecondary : null]}>
      {label}
    </Text>
  </Pressable>
);

export const SearchInput = ({
  value,
  onChangeText,
  placeholder
}: {
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
}) => (
  <View style={styles.searchBox}>
    <Ionicons name="search-outline" size={30} color="#9aa2b1" />
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor="#9aa2b1"
      style={styles.searchInput}
      autoCapitalize="none"
    />
  </View>
);

export const SegmentedControl = ({
  options,
  value,
  onChange
}: {
  options: { value: string; label: string; icon?: keyof typeof Ionicons.glyphMap }[];
  value: string;
  onChange: (value: string) => void;
}) => (
  <View style={styles.segmented}>
    {options.map((option) => {
      const active = option.value === value;
      return (
        <Pressable
          key={option.value}
          onPress={() => onChange(option.value)}
          style={[styles.segment, active ? styles.segmentActive : null]}
        >
          {option.icon ? (
            <Ionicons name={option.icon} size={22} color={active ? "#000" : colors.muted} />
          ) : null}
          <Text style={[styles.segmentText, active ? styles.segmentTextActive : null]}>
            {option.label}
          </Text>
        </Pressable>
      );
    })}
  </View>
);

export const StatusBadge = ({ status }: { status: string }) => (
  <View style={styles.badge}>
    <Text style={styles.badgeText}>{titleCaseStatus(status)}</Text>
  </View>
);

export const EmptyState = ({ title, subtitle }: { title: string; subtitle: string }) => (
  <Card style={styles.emptyCard}>
    <Ionicons name="file-tray-outline" size={66} color="#9aa2b1" />
    <Text style={styles.emptyTitle}>{title}</Text>
    <Text style={styles.emptySubtitle}>{subtitle}</Text>
  </Card>
);

export const LoadingState = () => (
  <Card style={styles.emptyCard}>
    <ActivityIndicator color={colors.primary} size="large" />
    <Text style={styles.emptySubtitle}>Loading warehouse data</Text>
  </Card>
);

export const ErrorState = ({ message }: { message: string }) => (
  <Card style={styles.noticeCard}>
    <Ionicons name="alert-circle-outline" size={28} color={colors.danger} />
    <Text style={styles.noticeText}>{message}</Text>
  </Card>
);

export const ScannerModal = ({
  visible,
  onClose,
  onScan
}: {
  visible: boolean;
  onClose: () => void;
  onScan: (value: string) => void;
}) => {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const flashOpacity = useRef(new Animated.Value(0)).current;

  const handleBarcodeScanned = (result: { data: string }) => {
    if (scanned) return;

    setScanned(true);

    // Haptic feedback
    Vibration.vibrate(100);

    // Flash animation
    Animated.sequence([
      Animated.timing(flashOpacity, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true
      }),
      Animated.timing(flashOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true
      })
    ]).start();

    // Delay close to show feedback
    setTimeout(() => {
      onScan(result.data);
      onClose();
      // Reset for next scan
      setTimeout(() => setScanned(false), 300);
    }, 300);
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.scannerShell}>
        <View style={styles.scannerHeader}>
          <Text style={styles.scannerTitle}>Scan Barcode</Text>
          <Pressable onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={28} color="#fff" />
          </Pressable>
        </View>
        {permission?.granted ? (
          <View style={styles.cameraContainer}>
            <CameraView
              style={styles.camera}
              barcodeScannerSettings={{
                barcodeTypes: ["qr", "code128", "code39", "ean13", "ean8", "upc_a", "upc_e"]
              }}
              onBarcodeScanned={handleBarcodeScanned}
            />
            <View style={styles.scannerOverlay}>
              <View style={styles.scannerFrame}>
                <View style={[styles.corner, styles.cornerTopLeft]} />
                <View style={[styles.corner, styles.cornerTopRight]} />
                <View style={[styles.corner, styles.cornerBottomLeft]} />
                <View style={[styles.corner, styles.cornerBottomRight]} />
              </View>
              <View style={styles.scannerInstructions}>
                <Ionicons name="scan-outline" size={32} color="#fff" />
                <Text style={styles.scannerInstructionText}>
                  Position the barcode within the frame
                </Text>
                <Text style={styles.scannerHintText}>
                  Scanning happens automatically
                </Text>
              </View>
            </View>
            <Animated.View
              style={[
                styles.scanFlash,
                { opacity: flashOpacity }
              ]}
            />
            {scanned ? (
              <View style={styles.scanSuccessOverlay}>
                <View style={styles.scanSuccessIcon}>
                  <Ionicons name="checkmark-circle" size={64} color={colors.green} />
                </View>
                <Text style={styles.scanSuccessText}>Scanned!</Text>
              </View>
            ) : null}
          </View>
        ) : (
          <View style={styles.cameraPermission}>
            <Ionicons name="camera-outline" size={64} color="#fff" style={{ opacity: 0.5 }} />
            <Text style={styles.cameraPermissionText}>Camera access is required for scanning.</Text>
            <ActionButton label="Allow Camera" onPress={requestPermission} />
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
};

export const BottomNav = () => {
  const pathname = usePathname();
  const active = useMemo(() => {
    if (pathname.startsWith("/receiving")) return "receiving";
    if (pathname.startsWith("/picking")) return "picking";
    if (pathname.startsWith("/profile")) return "profile";
    if (pathname.startsWith("/more")) return "more";
    return "dashboard";
  }, [pathname]);

  const handleNavigation = (route: Href, target: string) => {
    if (active !== target) {
      router.push(route);
    }
  };

  return (
    <SafeAreaView edges={["bottom"]} style={styles.bottomSafe}>
      <View style={styles.bottomNav}>
        <Pressable style={styles.navItem} onPress={() => handleNavigation("/receiving", "receiving")}>
          <MaterialCommunityIcons
            name="package-variant-closed"
            size={22}
            color={active === "receiving" ? colors.primary : "#9B8FC4"}
          />
          <Text style={[styles.navText, active === "receiving" ? styles.navTextActive : null]}>
            Receiving
          </Text>
        </Pressable>
        <Pressable style={styles.navItem} onPress={() => handleNavigation("/picking", "picking")}>
          <MaterialCommunityIcons
            name="package-variant-plus"
            size={22}
            color={active === "picking" ? colors.primary : "#9B8FC4"}
          />
          <Text style={[styles.navText, active === "picking" ? styles.navTextActive : null]}>
            Picking
          </Text>
        </Pressable>
        <Pressable style={styles.navCenter} onPress={() => handleNavigation("/", "dashboard")}>
          <Ionicons name="grid-outline" size={26} color="#fff" />
        </Pressable>
        <Pressable style={styles.navItem} onPress={() => handleNavigation("/profile", "profile")}>
          <Ionicons
            name="person-outline"
            size={22}
            color={active === "profile" ? colors.primary : "#9B8FC4"}
          />
          <Text style={[styles.navText, active === "profile" ? styles.navTextActive : null]}>
            Profile
          </Text>
        </Pressable>
        <Pressable style={styles.navItem} onPress={() => handleNavigation("/more", "more")}>
          <Ionicons
            name="ellipsis-horizontal"
            size={22}
            color={active === "more" ? colors.primary : "#9B8FC4"}
          />
          <Text style={[styles.navText, active === "more" ? styles.navTextActive : null]}>
            More
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
};

export const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.surface
  },
  scroll: {
    flex: 1,
    backgroundColor: colors.background
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: 120,
    gap: spacing.base
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.md
  },
  headerContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    minWidth: 0
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.lg,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.backgroundSecondary
  },
  backButtonPressed: {
    backgroundColor: colors.border,
    opacity: 0.8
  },
  headerTitleBlock: {
    flex: 1,
    minWidth: 0,
    gap: 2
  },
  headerTitle: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: typography.fontWeights.bold,
    color: colors.text
  },
  headerSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: typography.fontWeights.medium,
    color: colors.textSecondary
  },
  notificationButton: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.lg,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.backgroundSecondary,
    position: "relative"
  },
  notificationButtonPressed: {
    backgroundColor: colors.border,
    opacity: 0.8
  },
  notificationBadge: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.danger,
    borderWidth: 2,
    borderColor: colors.surface
  },
  contextBar: {
    flexDirection: "row",
    gap: spacing.md,
    marginBottom: spacing.base
  },
  contextPill: {
    minHeight: 40,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm
  },
  contextText: {
    fontSize: 12,
    fontWeight: typography.fontWeights.semibold,
    color: colors.text,
    flexShrink: 1
  },
  dateIcon: { fontSize: 14 },
  switcherBackdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: "center",
    padding: spacing.xl
  },
  switcherPanel: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
    ...shadows.base
  },
  switcherHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.xs
  },
  switcherTitle: {
    ...typography.heading3,
    color: colors.text
  },
  switcherClose: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.full,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.backgroundSecondary
  },
  switcherOption: {
    minHeight: 58,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm
  },
  switcherOptionActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft
  },
  switcherOptionName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: typography.fontWeights.semibold
  },
  switcherOptionMeta: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 2
  },
  switcherError: {
    color: colors.danger,
    fontSize: 12,
    lineHeight: 16
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    ...shadows.base
  },
  button: {
    minHeight: sizes.button.lg,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    paddingHorizontal: spacing.xl,
    ...shadows.sm
  },
  buttonSecondary: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border
  },
  buttonSuccess: {
    backgroundColor: colors.green
  },
  buttonDisabled: {
    opacity: 0.5
  },
  buttonText: {
    ...typography.button,
    color: "#FFFFFF"
  },
  buttonTextSecondary: {
    color: colors.text
  },
  searchBox: {
    minHeight: sizes.input.lg,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.base,
    gap: spacing.md,
    ...shadows.sm
  },
  searchInput: {
    flex: 1,
    ...typography.body,
    color: colors.text
  },
  segmented: {
    flexDirection: "row",
    backgroundColor: colors.backgroundSecondary,
    borderRadius: borderRadius.md,
    padding: spacing.xs,
    gap: spacing.xs
  },
  segment: {
    flex: 1,
    minHeight: sizes.button.base,
    borderRadius: borderRadius.base,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: spacing.sm
  },
  segmentActive: {
    backgroundColor: colors.surface,
    ...shadows.sm
  },
  segmentText: {
    ...typography.body,
    fontWeight: typography.fontWeights.semibold,
    color: colors.textSecondary
  },
  segmentTextActive: {
    color: colors.text
  },
  badge: {
    alignSelf: "flex-start",
    backgroundColor: colors.primarySoft,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs
  },
  badgeText: {
    ...typography.labelSmall,
    color: colors.primary
  },
  emptyCard: {
    minHeight: 240,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md
  },
  emptyTitle: {
    ...typography.title,
    color: colors.text,
    textAlign: "center"
  },
  emptySubtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: "center"
  },
  noticeCard: {
    flexDirection: "row",
    gap: spacing.md,
    alignItems: "center",
    backgroundColor: colors.amberSoft,
    borderColor: colors.amber
  },
  noticeText: {
    ...typography.body,
    color: colors.amberDark,
    fontWeight: typography.fontWeights.medium,
    flex: 1
  },
  bottomSafe: {
    backgroundColor: colors.surface
  },
  bottomNav: {
    height: 72,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.sm,
    ...shadows.lg
  },
  navItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    paddingVertical: spacing.xs
  },
  navText: {
    fontSize: 11,
    color: "#9B8FC4",
    fontWeight: typography.fontWeights.medium
  },
  navTextActive: {
    color: colors.primary
  },
  navCenter: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginTop: -28,
    ...Platform.select({
      android: { elevation: 12 },
      ios: {
        shadowColor: colors.primary,
        shadowOpacity: 0.4,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 4 }
      }
    })
  },
  scannerShell: {
    flex: 1,
    backgroundColor: "#000"
  },
  scannerHeader: {
    height: 72,
    paddingHorizontal: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  scannerTitle: {
    ...typography.heading3,
    color: "#FFFFFF"
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center"
  },
  cameraContainer: {
    flex: 1,
    position: "relative"
  },
  camera: {
    flex: 1
  },
  scannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center"
  },
  scannerFrame: {
    width: 280,
    height: 200,
    position: "relative"
  },
  corner: {
    position: "absolute",
    width: 40,
    height: 40,
    borderColor: colors.primary,
    borderWidth: 4
  },
  cornerTopLeft: {
    top: 0,
    left: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    borderTopLeftRadius: 8
  },
  cornerTopRight: {
    top: 0,
    right: 0,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
    borderTopRightRadius: 8
  },
  cornerBottomLeft: {
    bottom: 0,
    left: 0,
    borderRightWidth: 0,
    borderTopWidth: 0,
    borderBottomLeftRadius: 8
  },
  cornerBottomRight: {
    bottom: 0,
    right: 0,
    borderLeftWidth: 0,
    borderTopWidth: 0,
    borderBottomRightRadius: 8
  },
  scannerInstructions: {
    position: "absolute",
    bottom: 80,
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.xl
  },
  scannerInstructionText: {
    ...typography.bodyLarge,
    color: "#FFFFFF",
    textAlign: "center",
    fontWeight: typography.fontWeights.semibold
  },
  scannerHintText: {
    ...typography.body,
    color: "rgba(255,255,255,0.7)",
    textAlign: "center"
  },
  cameraPermission: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.xl,
    gap: spacing.lg
  },
  cameraPermissionText: {
    ...typography.bodyLarge,
    color: "#FFFFFF",
    textAlign: "center"
  },
  scanFlash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.primary,
    pointerEvents: "none"
  },
  scanSuccessOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.7)",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md
  },
  scanSuccessIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center"
  },
  scanSuccessText: {
    ...typography.heading2,
    color: "#FFFFFF",
    fontWeight: typography.fontWeights.bold
  }
});
