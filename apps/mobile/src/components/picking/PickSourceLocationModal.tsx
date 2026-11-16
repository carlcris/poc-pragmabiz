import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { createTranslator } from "use-intl/core";
import { translations } from "../../../../../src/lib/i18n/translations";
import {
  getWholePickSourceQuantities,
  type WholePickSourceQuantities,
} from "../../../../../src/lib/picking-quantities";
import type { PickSourceResolution } from "@/api/picking";
import type { PickListItem } from "@/contracts/picking";
import { colors } from "@/theme/colors";
import { spacing, borderRadius } from "@/theme/spacing";

const t = createTranslator({ locale: "en", messages: translations.en.mobilePickDetail });
const quantityFormatter = new Intl.NumberFormat("en", { maximumFractionDigits: 4 });

type Props = {
  visible: boolean;
  items: PickListItem[];
  sources: PickSourceResolution[];
  hasMore: boolean;
  busy: boolean;
  error: string;
  onSelect: (locationId: string) => void;
  onLoadMore: () => void;
  onClose: () => void;
};

type SourceOption = {
  locationId: string;
  bin: string;
  context: string;
  unit: string;
  remainingQty: number;
  quantities: WholePickSourceQuantities;
};

// Location names arrive as "Zone 1 / Rack A / Bin 1"; the leaf is what the picker walks to.
const toSourceOption = (
  source: PickSourceResolution,
  unit: string,
  showWarehouse: boolean
): SourceOption => {
  const segments = (source.source.locationName || source.source.locationCode).split(" / ");
  const path = segments.slice(0, -1).join(" / ");
  return {
    locationId: source.source.locationId,
    bin: segments[segments.length - 1] || source.source.locationCode,
    context: [showWarehouse ? source.source.warehouseName : "", path].filter(Boolean).join(" · "),
    unit,
    remainingQty: source.line.remainingQty,
    quantities: getWholePickSourceQuantities(source),
  };
};

export function PickSourceLocationModal(props: Props) {
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);

  useEffect(() => {
    if (!props.visible) setSelectedLocationId(null);
  }, [props.visible]);

  const first = props.sources[0];
  const itemsById = useMemo(
    () => new Map(props.items.map((item) => [item.id, item])),
    [props.items]
  );
  const itemName = first && itemsById.get(first.line.pickListItemId)?.name;
  const sharedWarehouse = props.sources.every(
    (source) => source.source.warehouseName === first?.source.warehouseName
  )
    ? (first?.source.warehouseName ?? "")
    : "";
  const options = props.sources.map((source) => ({
    isSuggested: !source.isMismatch,
    option: toSourceOption(
      source,
      itemsById.get(source.line.pickListItemId)?.uom ?? t("pickUnit"),
      !sharedWarehouse
    ),
  }));
  const suggested = options.filter((entry) => entry.isSuggested).map((entry) => entry.option);
  const others = options.filter((entry) => !entry.isSuggested).map((entry) => entry.option);
  const selected =
    options.find((entry) => entry.option.locationId === selectedLocationId)?.option ??
    suggested[0] ??
    others[0];

  const renderOption = (option: SourceOption, emphasized: boolean) => {
    const checked = option.locationId === selected?.locationId;
    return (
      <Pressable
        key={option.locationId}
        accessibilityRole="radio"
        accessibilityState={{ checked, disabled: props.busy }}
        disabled={props.busy}
        style={[styles.option, checked && styles.optionChecked]}
        onPress={() => setSelectedLocationId(option.locationId)}
      >
        <View style={[styles.radio, checked && styles.radioChecked]}>
          {checked ? <View style={styles.radioDot} /> : null}
        </View>
        <View style={styles.optionBody}>
          <Text style={emphasized ? styles.binEmphasized : styles.bin}>{option.bin}</Text>
          {option.context ? <Text style={styles.secondary}>{option.context}</Text> : null}
          {option.quantities.kind === "whole_units" && option.quantities.shortQty > 0 ? (
            <Text style={styles.shortText}>
              {t("shortByQuantity", {
                quantity: quantityFormatter.format(option.quantities.shortQty),
                unit: option.unit,
              })}
            </Text>
          ) : null}
        </View>
        <View style={styles.optionQty}>
          {option.quantities.kind === "whole_units" ? (
            <>
              <Text style={emphasized ? styles.qtyEmphasized : styles.qty}>
                {quantityFormatter.format(option.quantities.availableQty)} {option.unit}
              </Text>
              <Text style={styles.caption}>{t("availableToPick")}</Text>
            </>
          ) : (
            <Text style={styles.remainingAvailable}>{t("remainingQuantityAvailable")}</Text>
          )}
        </View>
      </Pressable>
    );
  };

  return (
    <Modal visible={props.visible} transparent animationType="fade" onRequestClose={props.onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View style={styles.handle} />
            <View style={styles.titleBlock}>
              {first ? (
                <Text style={styles.subtitle}>
                  {[itemName, t("batchCode", { batchCode: first.source.batchCode })]
                    .filter(Boolean)
                    .join(" · ")}
                </Text>
              ) : null}
              <Text style={styles.title}>{t("chooseLocation")}</Text>
            </View>
            {selected ? (
              <View style={styles.contextStrip}>
                <Text style={styles.contextWarehouse}>{sharedWarehouse}</Text>
                <Text style={styles.contextNeed}>
                  {t("quantityToPick", {
                    quantity: quantityFormatter.format(selected.remainingQty),
                    unit: selected.unit,
                  })}
                </Text>
              </View>
            ) : null}
          </View>
          <ScrollView
            style={styles.list}
            contentContainerStyle={styles.listContent}
            accessibilityRole="radiogroup"
          >
            {suggested.length ? (
              <>
                <Text style={styles.sectionLabel}>{t("suggestedLocation")}</Text>
                {suggested.map((option) => renderOption(option, true))}
              </>
            ) : null}
            {others.length ? (
              <>
                <Text style={[styles.sectionLabel, suggested.length ? styles.sectionGap : null]}>
                  {t("otherLocations")}
                </Text>
                {others.map((option) => renderOption(option, false))}
              </>
            ) : null}
            {props.hasMore ? (
              <Pressable
                accessibilityRole="button"
                disabled={props.busy}
                style={[styles.loadMore, props.busy && styles.disabled]}
                onPress={props.onLoadMore}
              >
                <Text style={styles.loadMoreText}>{t("loadMoreLocations")}</Text>
              </Pressable>
            ) : null}
          </ScrollView>
          <View style={styles.footer}>
            {props.busy ? (
              <View style={styles.statusRow}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.secondary}>{t("loadingLocations")}</Text>
              </View>
            ) : null}
            {props.error ? <Text style={styles.error}>{props.error}</Text> : null}
            <View style={styles.actions}>
              <Pressable
                accessibilityRole="button"
                style={[styles.button, styles.cancelButton]}
                onPress={props.onClose}
              >
                <Text style={styles.cancelText}>{t("cancelLocation")}</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={props.busy || !selected}
                style={[
                  styles.button,
                  styles.confirmButton,
                  (props.busy || !selected) && styles.disabled,
                ]}
                onPress={() => {
                  if (selected) props.onSelect(selected.locationId);
                }}
              >
                <Text style={styles.confirmText} numberOfLines={1}>
                  {t("pickFromLocation", { location: selected?.bin ?? "" })}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(30, 27, 75, 0.55)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: borderRadius["2xl"],
    borderTopRightRadius: borderRadius["2xl"],
    maxHeight: "90%",
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.base,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: borderRadius.full,
    backgroundColor: colors.border,
  },
  titleBlock: { gap: spacing.xs },
  subtitle: { fontSize: 13, fontWeight: "600", color: colors.textSecondary },
  title: { fontSize: 22, fontWeight: "700", color: colors.text },
  contextStrip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.primarySoft,
  },
  contextWarehouse: { flexShrink: 1, fontSize: 14, fontWeight: "600", color: colors.primaryDark },
  contextNeed: {
    flexShrink: 1,
    textAlign: "right",
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
  },
  list: { flexGrow: 0, flexShrink: 1 },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.base,
    paddingBottom: spacing.lg,
    gap: 10,
  },
  sectionLabel: { fontSize: 13, fontWeight: "700", color: colors.violetText },
  sectionGap: { marginTop: spacing.sm },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  optionChecked: {
    borderWidth: 2,
    borderColor: colors.primary,
    backgroundColor: colors.faint,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: borderRadius.full,
    borderWidth: 2,
    borderColor: colors.violetLight,
    alignItems: "center",
    justifyContent: "center",
  },
  radioChecked: { borderColor: colors.primary },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary,
  },
  optionBody: { flex: 1, gap: 2 },
  bin: { fontSize: 18, fontWeight: "800", color: colors.text },
  binEmphasized: { fontSize: 20, fontWeight: "800", color: colors.text },
  secondary: { fontSize: 13, color: colors.textSecondary },
  shortText: { fontSize: 12, fontWeight: "600", color: colors.statusWarning },
  optionQty: { flexShrink: 1, alignItems: "flex-end", gap: 2 },
  qty: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.text,
    fontVariant: ["tabular-nums"],
    textAlign: "right",
  },
  qtyEmphasized: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text,
    fontVariant: ["tabular-nums"],
    textAlign: "right",
  },
  caption: { fontSize: 12, color: colors.textSecondary },
  remainingAvailable: {
    maxWidth: 112,
    textAlign: "right",
    fontSize: 13,
    fontWeight: "700",
    color: colors.text,
  },
  loadMore: {
    alignSelf: "center",
    minHeight: 44,
    marginTop: spacing.xs,
    paddingHorizontal: spacing.lg,
    justifyContent: "center",
    borderRadius: borderRadius.full,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  loadMoreText: { fontSize: 14, fontWeight: "600", color: colors.primaryDark },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  statusRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  error: { fontSize: 13, color: colors.statusError },
  actions: { flexDirection: "row", gap: spacing.md },
  button: {
    minHeight: 52,
    borderRadius: borderRadius.full,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.base,
  },
  cancelButton: { flex: 1, borderWidth: 1.5, borderColor: colors.border },
  cancelText: { fontSize: 15, fontWeight: "600", color: colors.text },
  confirmButton: { flex: 2, backgroundColor: colors.primary },
  confirmText: { fontSize: 15, fontWeight: "700", color: colors.surface },
  disabled: { opacity: 0.4 },
});
