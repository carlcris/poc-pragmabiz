import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { ActionButton, Card, ErrorState, ScannerModal, Screen } from "@/components/ui";
import type { ScannedItemInfo } from "@/contracts/itemInfo";
import { useScannedItemInfo } from "@/hooks/queries";
import { colors } from "@/theme/colors";
import { spacing, borderRadius } from "@/theme/spacing";
import { typography } from "@/theme/typography";

const formatNumber = (value: number) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);

const formatType = (value: string) =>
  value
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

export default function ItemInfoScreen() {
  const [scannerOpen, setScannerOpen] = useState(false);
  const [input, setInput] = useState("");
  const [submittedPayload, setSubmittedPayload] = useState("");
  const itemInfo = useScannedItemInfo(submittedPayload);

  const submitPayload = (value = input) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    setSubmittedPayload(trimmed);
  };

  const reset = () => {
    setInput("");
    setSubmittedPayload("");
  };

  return (
    <Screen title="Scan Item Info" subtitle="Read-only product lookup" back>
      <Card style={styles.scanCard}>
        <View style={styles.scanHeader}>
          <View style={styles.scanIcon}>
            <Ionicons name="qr-code-outline" size={24} color={colors.primary} />
          </View>
          <View style={styles.scanText}>
            <Text style={styles.cardTitle}>Product Code</Text>
            <Text style={styles.cardSubtitle}>Scan a product code or enter the printed code.</Text>
          </View>
        </View>

        <ActionButton
          label="Scan QR Code"
          icon="scan-outline"
          onPress={() => setScannerOpen(true)}
        />

        <View style={styles.inputWrap}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Enter product code"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            multiline
            style={styles.input}
          />
          {input ? (
            <Pressable onPress={reset} style={styles.clearButton}>
              <Ionicons name="close" size={18} color={colors.textSecondary} />
            </Pressable>
          ) : null}
        </View>

        <ActionButton
          label="Lookup Item"
          icon="search-outline"
          variant="secondary"
          disabled={!input.trim()}
          onPress={() => submitPayload()}
        />
      </Card>

      {!submittedPayload ? (
        <Card style={styles.readyCard}>
          <Ionicons name="information-circle-outline" size={28} color={colors.blue} />
          <Text style={styles.readyTitle}>Ready to scan</Text>
          <Text style={styles.readyText}>
            Results will show product details and aggregate inventory for the current business unit.
          </Text>
        </Card>
      ) : null}

      {itemInfo.isLoading ? (
        <Card style={styles.loadingCard}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={styles.loadingText}>Loading item information</Text>
        </Card>
      ) : null}

      {itemInfo.error ? (
        <ErrorState
          message={
            itemInfo.error instanceof Error
              ? itemInfo.error.message
              : "Unable to load item information."
          }
        />
      ) : null}

      {submittedPayload && !itemInfo.isLoading && !itemInfo.error && itemInfo.data === null ? (
        <Card style={styles.readyCard}>
          <Ionicons name="search-outline" size={28} color={colors.textSecondary} />
          <Text style={styles.readyTitle}>No product found</Text>
          <Text style={styles.readyText}>
            Check the printed code and try again.
          </Text>
        </Card>
      ) : null}

      {itemInfo.data ? <ItemInfoResult item={itemInfo.data} /> : null}

      <ScannerModal
        visible={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={(value) => {
          setInput("");
          submitPayload(value);
        }}
      />
    </Screen>
  );
}

const ItemInfoResult = ({ item }: { item: ScannedItemInfo }) => (
  <View style={styles.resultStack}>
    <Card style={styles.itemCard}>
      {item.imageUrl ? (
        <Image source={{ uri: item.imageUrl }} style={styles.itemImage} resizeMode="cover" />
      ) : (
        <View style={styles.imageFallback}>
          <Ionicons name="cube-outline" size={42} color={colors.primary} />
        </View>
      )}
      <View style={styles.itemHeader}>
        <Text style={styles.itemName}>{item.name}</Text>
        <Text style={styles.itemCode}>{item.code}</Text>
      </View>
      <View style={styles.metaGrid}>
        <InfoPill label="Type" value={formatType(item.type)} />
        <InfoPill label="Category" value={item.category} />
      </View>
      <InfoRow label="Description" value={item.description || "No description"} />
      <InfoRow label="Dimensions" value={item.dimensions?.label || "No dimensions"} />
    </Card>

    <Card style={styles.inventoryCard}>
      <View style={styles.sectionHeader}>
        <Ionicons name="stats-chart-outline" size={20} color={colors.primary} />
        <Text style={styles.sectionTitle}>Aggregate Inventory</Text>
      </View>
      <View style={styles.inventoryGrid}>
        <InventoryMetric label="Available" value={item.inventory.available} tone="green" />
        <InventoryMetric label="Reserved" value={item.inventory.reserved} tone="amber" />
        <InventoryMetric label="On Hand" value={item.inventory.onHand} tone="blue" />
      </View>
    </Card>
  </View>
);

const InfoPill = ({ label, value }: { label: string; value: string }) => (
  <View style={styles.infoPill}>
    <Text style={styles.infoLabel}>{label}</Text>
    <Text style={styles.infoValue} numberOfLines={2}>
      {value || "None"}
    </Text>
  </View>
);

const InfoRow = ({ label, value }: { label: string; value: string }) => (
  <View style={styles.infoRow}>
    <Text style={styles.infoLabel}>{label}</Text>
    <Text style={styles.infoValue}>{value}</Text>
  </View>
);

const InventoryMetric = ({
  label,
  value,
  tone
}: {
  label: string;
  value: number;
  tone: "green" | "amber" | "blue";
}) => {
  const color =
    tone === "green" ? colors.green : tone === "amber" ? colors.amber : colors.blue;
  const background =
    tone === "green" ? colors.greenSoft : tone === "amber" ? colors.amberSoft : colors.blueSoft;

  return (
    <View style={[styles.inventoryMetric, { backgroundColor: background }]}>
      <Text style={[styles.inventoryValue, { color }]}>{formatNumber(value)}</Text>
      <Text style={styles.inventoryLabel}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  scanCard: {
    gap: spacing.md
  },
  scanHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md
  },
  scanIcon: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.base,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center"
  },
  scanText: {
    flex: 1,
    gap: spacing.xs
  },
  cardTitle: {
    ...typography.titleSmall,
    color: colors.text
  },
  cardSubtitle: {
    ...typography.bodySmall,
    color: colors.textSecondary
  },
  inputWrap: {
    position: "relative"
  },
  input: {
    minHeight: 92,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.base,
    backgroundColor: colors.faint,
    padding: spacing.base,
    paddingRight: 44,
    color: colors.text,
    textAlignVertical: "top",
    ...typography.body
  },
  clearButton: {
    position: "absolute",
    top: spacing.sm,
    right: spacing.sm,
    width: 32,
    height: 32,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center"
  },
  readyCard: {
    alignItems: "center",
    gap: spacing.sm
  },
  readyTitle: {
    ...typography.titleSmall,
    color: colors.text
  },
  readyText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: "center"
  },
  loadingCard: {
    alignItems: "center",
    gap: spacing.md
  },
  loadingText: {
    ...typography.body,
    color: colors.textSecondary
  },
  resultStack: {
    gap: spacing.base
  },
  itemCard: {
    gap: spacing.base
  },
  itemImage: {
    width: "100%",
    aspectRatio: 16 / 9,
    borderRadius: borderRadius.base,
    backgroundColor: colors.faint
  },
  imageFallback: {
    width: "100%",
    aspectRatio: 16 / 9,
    borderRadius: borderRadius.base,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center"
  },
  itemHeader: {
    gap: spacing.xs
  },
  itemName: {
    ...typography.heading3,
    color: colors.text
  },
  itemCode: {
    ...typography.body,
    color: colors.primary,
    fontWeight: typography.fontWeights.semibold
  },
  metaGrid: {
    flexDirection: "row",
    gap: spacing.sm
  },
  infoPill: {
    flex: 1,
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: borderRadius.base,
    backgroundColor: colors.faint
  },
  infoRow: {
    gap: spacing.xs,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.divider
  },
  infoLabel: {
    ...typography.labelSmall,
    color: colors.textSecondary,
    textTransform: "uppercase"
  },
  infoValue: {
    ...typography.body,
    color: colors.text
  },
  inventoryCard: {
    gap: spacing.base
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm
  },
  sectionTitle: {
    ...typography.titleSmall,
    color: colors.text
  },
  inventoryGrid: {
    flexDirection: "row",
    gap: spacing.sm
  },
  inventoryMetric: {
    flex: 1,
    minHeight: 82,
    borderRadius: borderRadius.base,
    padding: spacing.md,
    justifyContent: "center",
    gap: spacing.xs
  },
  inventoryValue: {
    ...typography.title,
    fontWeight: typography.fontWeights.bold
  },
  inventoryLabel: {
    ...typography.bodySmall,
    color: colors.textSecondary
  }
});
