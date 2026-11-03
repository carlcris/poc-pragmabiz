import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import { router, usePathname } from "expo-router";
import type { Href } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Modal,
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
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "@/theme/colors";
import { useBusinessUnits, useSetBusinessUnit } from "@/hooks/queries";
import { useAuthStore } from "@/stores/authStore";
import { spacing, borderRadius, shadows, sizes } from "@/theme/spacing";
import { typography } from "@/theme/typography";
import { primaryGlow, softShadow } from "@/theme/elevation";
import { canAccessPicking, canAccessReceiving } from "@/utils/permissions";
import { titleCaseStatus } from "@/utils/record";
import { createTranslator } from "use-intl/core";
import { translations } from "../../../../src/lib/i18n/translations";

// The native app currently uses English; reuse the web source of truth for shell copy.
const tShell = createTranslator({ locale: "en", messages: translations.en.mobileShell });

type ScreenProps = {
  children: React.ReactNode;
  footer?: React.ReactNode;
  onRefresh?: () => Promise<void> | void;
  refreshing?: boolean;
} & (
  // Detail screens keep their record title and context subtitle.
  | { back: true; title: string; subtitle?: string; greeting?: never }
  // Main screens show the screen title with the business unit switcher beneath it.
  // A greeting swaps in the avatar header, with the screen title as trailing meta text.
  | { back?: false; title: string; subtitle?: never; greeting?: string }
);

export const Screen = ({
  title,
  subtitle,
  back,
  greeting,
  children,
  footer,
  onRefresh,
  refreshing
}: ScreenProps) => {
  const [internalRefreshing, setInternalRefreshing] = useState(false);
  const isRefreshing = refreshing ?? internalRefreshing;

  const handleRefresh = useCallback(async () => {
    if (isRefreshing || !onRefresh) return;
    setInternalRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setInternalRefreshing(false);
    }
  }, [isRefreshing, onRefresh]);

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      {greeting ? (
        <GreetingHeader greeting={greeting} meta={title} />
      ) : (
        /* Keep scanner Enter suffixes from initially focusing and activating Back. */
        <View style={styles.header} focusable importantForAccessibility="no">
          {back ? (
            <Pressable
              onPress={() => router.back()}
              style={({ pressed }) => [styles.backButton, pressed && styles.backButtonPressed]}
            >
              <Ionicons name="arrow-back" size={22} color={colors.text} />
            </Pressable>
          ) : null}
          <View style={styles.headerTitleBlock}>
            {back ? (
              <Text style={styles.headerTitle} numberOfLines={1}>
                {title}
              </Text>
            ) : (
              <Text style={styles.screenTitle} numberOfLines={1} accessibilityRole="header">
                {title}
              </Text>
            )}
            {back ? (
              subtitle ? (
                <Text style={styles.headerSubtitle} numberOfLines={1}>
                  {subtitle}
                </Text>
              ) : null
            ) : (
              <BusinessUnitSwitcher />
            )}
          </View>
        </View>
      )}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={onRefresh ? (
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        ) : undefined}
      >
        {children}
      </ScrollView>
      {footer}
    </SafeAreaView>
  );
};

const GreetingHeader = ({ greeting, meta }: { greeting: string; meta: string }) => {
  const user = useAuthStore((state) => state.session?.user);
  const initials = [user?.firstName, user?.lastName]
    .map((part) => part?.trim().charAt(0) ?? "")
    .join("")
    .toUpperCase();

  return (
    // Keep scanner Enter suffixes from initially focusing and activating the switcher.
    <View style={styles.greetingHeader} focusable importantForAccessibility="no">
      <View style={styles.avatar} importantForAccessibility="no-hide-descendants">
        {initials ? (
          <Text style={styles.avatarText}>{initials}</Text>
        ) : (
          <Ionicons name="person" size={20} color={colors.violetDark} />
        )}
      </View>
      <View style={styles.headerTitleBlock}>
        <Text style={styles.greetingText} numberOfLines={1} accessibilityRole="header">
          {greeting}
        </Text>
        <BusinessUnitSwitcher />
      </View>
      {meta ? (
        <Text style={styles.greetingMeta} numberOfLines={1}>
          {meta}
        </Text>
      ) : null}
    </View>
  );
};

const BusinessUnitSwitcher = () => {
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

  const businessUnitLabel = businessUnits.isLoading
    ? "Loading business units..."
    : currentBusinessUnit?.name || "Select business unit";

  return (
    <>
      <Pressable
        style={styles.businessUnitSwitcher}
        hitSlop={{ top: spacing.md, bottom: spacing.xs, left: spacing.sm, right: spacing.sm }}
        onPress={() => setOpen(true)}
        disabled={businessUnits.isLoading || setBusinessUnit.isPending}
        accessibilityRole="button"
        accessibilityLabel={tShell("switchBusinessUnit", { name: businessUnitLabel })}
      >
        <Text style={styles.businessUnitSwitcherText} numberOfLines={1}>
          {businessUnitLabel}
        </Text>
        <Ionicons name="chevron-down" size={14} color={colors.textSecondary} />
      </Pressable>

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
    </>
  );
};

export const Card =({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) => (
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
        color={variant === "secondary" ? colors.primaryDark : colors.surface}
        style={{ marginRight: spacing.sm }}
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
    <Ionicons name="search-outline" size={20} color={colors.muted} />
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={colors.muted}
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
            <Ionicons name={option.icon} size={18} color={active ? colors.surface : colors.textSecondary} />
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
    <Ionicons name="file-tray-outline" size={56} color={colors.primaryLight} />
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
  const scanLockedRef = useRef(false);
  const flashOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;

    scanLockedRef.current = false;
    setScanned(false);
  }, [visible]);

  const handleBarcodeScanned = (result: { data: string }) => {
    if (scanLockedRef.current) return;

    scanLockedRef.current = true;
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
              onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
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
  const session = useAuthStore((state) => state.session);
  const showReceiving = canAccessReceiving(session);
  const showPicking = canAccessPicking(session);
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
        <NavItem
          label="Receiving"
          active={active === "receiving"}
          disabled={!showReceiving}
          onPress={() => handleNavigation("/receiving", "receiving")}
          renderIcon={(color) => (
            <MaterialCommunityIcons name="package-variant-closed" size={22} color={color} />
          )}
        />
        <NavItem
          label="Picking"
          active={active === "picking"}
          disabled={!showPicking}
          onPress={() => handleNavigation("/picking", "picking")}
          renderIcon={(color) => (
            <MaterialCommunityIcons name="package-variant-plus" size={22} color={color} />
          )}
        />
        <View style={styles.navItem}>
          <Pressable
            style={styles.navCenter}
            onPress={() => handleNavigation("/", "dashboard")}
            accessibilityRole="button"
            accessibilityLabel="Dashboard"
          >
            <Ionicons name="grid-outline" size={24} color={colors.surface} />
          </Pressable>
        </View>
        <NavItem
          label="Profile"
          active={active === "profile"}
          onPress={() => handleNavigation("/profile", "profile")}
          renderIcon={(color, isActive) => (
            <Ionicons name={isActive ? "person" : "person-outline"} size={22} color={color} />
          )}
        />
        <NavItem
          label="More"
          active={active === "more"}
          onPress={() => handleNavigation("/more", "more")}
          renderIcon={(color) => <Ionicons name="ellipsis-horizontal" size={22} color={color} />}
        />
      </View>
    </SafeAreaView>
  );
};

const NavItem = ({
  label,
  active,
  disabled = false,
  onPress,
  renderIcon
}: {
  label: string;
  active: boolean;
  disabled?: boolean;
  onPress: () => void;
  renderIcon: (color: string, isActive: boolean) => React.ReactNode;
}) => {
  const isActive = active && !disabled;
  const color = disabled ? colors.textDisabled : isActive ? colors.primary : colors.navInactive;

  return (
    <Pressable
      style={styles.navItem}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled, selected: isActive }}
      onPress={onPress}
    >
      {renderIcon(color, isActive)}
      <Text
        style={[
          styles.navText,
          isActive ? styles.navTextActive : null,
          disabled ? styles.navTextDisabled : null
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
};

export const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background
  },
  scroll: {
    flex: 1,
    backgroundColor: colors.background
  },
  scrollContent: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.md,
    paddingBottom: spacing["2xl"],
    gap: 14
  },
  header: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.background,
    gap: spacing.md
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    ...softShadow
  },
  backButtonPressed: {
    opacity: 0.7
  },
  headerTitleBlock: {
    flex: 1,
    minWidth: 0,
    gap: 2
  },
  screenTitle: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: typography.fontWeights.bold,
    letterSpacing: -0.3,
    color: colors.text
  },
  headerTitle: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: typography.fontWeights.bold,
    color: colors.text
  },
  headerSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary
  },
  businessUnitSwitcher: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    maxWidth: "100%",
    gap: spacing.xs
  },
  businessUnitSwitcherText: {
    flexShrink: 1,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary
  },
  greetingHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.base,
    paddingTop: spacing.base,
    paddingBottom: spacing.xs,
    backgroundColor: colors.background
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.violetAvatar,
    alignItems: "center",
    justifyContent: "center"
  },
  avatarText: {
    fontSize: 15,
    fontWeight: typography.fontWeights.bold,
    color: colors.violetDark
  },
  greetingText: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: typography.fontWeights.medium,
    color: colors.text
  },
  greetingMeta: {
    fontSize: 12,
    lineHeight: 16,
    color: colors.muted
  },
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
    borderRadius: borderRadius.xl,
    padding: spacing.base,
    ...softShadow
  },
  button: {
    minHeight: sizes.button.lg,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    paddingHorizontal: spacing.xl,
    ...primaryGlow
  },
  buttonSecondary: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.violetAvatar,
    ...shadows.none
  },
  buttonSuccess: {
    backgroundColor: colors.green
  },
  buttonDisabled: {
    opacity: 0.5
  },
  buttonText: {
    ...typography.button,
    color: colors.surface
  },
  buttonTextSecondary: {
    color: colors.primaryDark
  },
  searchBox: {
    minHeight: 50,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.surface,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    gap: 10,
    ...softShadow
  },
  searchInput: {
    flex: 1,
    ...typography.body,
    color: colors.text
  },
  segmented: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderRadius: borderRadius.full,
    padding: spacing.xs,
    gap: spacing.xs,
    ...softShadow
  },
  segment: {
    flex: 1,
    minHeight: 36,
    borderRadius: borderRadius.full,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: spacing.sm
  },
  segmentActive: {
    backgroundColor: colors.primary,
    ...primaryGlow
  },
  segmentText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: typography.fontWeights.medium,
    color: colors.textSecondary
  },
  segmentTextActive: {
    color: colors.surface
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
    backgroundColor: colors.amberBanner
  },
  noticeText: {
    ...typography.body,
    color: colors.amberDark,
    fontWeight: typography.fontWeights.medium,
    flex: 1
  },
  bottomSafe: {
    backgroundColor: colors.background
  },
  bottomNav: {
    height: 68,
    marginHorizontal: spacing.md,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
    borderRadius: 34,
    backgroundColor: colors.surface,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    boxShadow: "0px 10px 24px rgba(91, 33, 182, 0.14)"
  },
  navItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  navText: {
    fontSize: 11,
    color: colors.navInactive,
    fontWeight: typography.fontWeights.medium
  },
  navTextActive: {
    color: colors.primaryDark,
    fontWeight: typography.fontWeights.bold
  },
  navTextDisabled: {
    color: colors.textDisabled
  },
  navCenter: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 4,
    borderColor: colors.surface,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginTop: -22,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8
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
