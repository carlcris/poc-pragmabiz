import AsyncStorage from "@react-native-async-storage/async-storage";
import type { RecordPickProgressInput } from "@/api/picking";

const STORAGE_KEY_PREFIX = "pragmabiz.mobile.pending-pick-confirmation";

export type PendingPickConfirmation = {
  version: 1;
  userId: string;
  businessUnitId: string;
  pickListId: string;
  createdAt: string;
  payload: RecordPickProgressInput;
};

const storageKey = (userId: string, pickListId: string) =>
  `${STORAGE_KEY_PREFIX}.${userId}.${pickListId}`;

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const optionalText = (value: unknown) =>
  value === null || value === undefined || typeof value === "string";

const parsePendingConfirmation = (value: unknown): PendingPickConfirmation | null => {
  const record = asRecord(value);
  const payload = asRecord(record?.payload);
  if (
    record?.version !== 1 ||
    typeof record.userId !== "string" ||
    typeof record.businessUnitId !== "string" ||
    typeof record.pickListId !== "string" ||
    typeof record.createdAt !== "string" ||
    !payload ||
    typeof payload.pickListItemId !== "string" ||
    typeof payload.operationId !== "string" ||
    typeof payload.pickedQty !== "number" ||
    !Number.isFinite(payload.pickedQty) ||
    payload.pickedQty <= 0 ||
    !optionalText(payload.batchLocationSku) ||
    !optionalText(payload.pickedLocationId) ||
    !optionalText(payload.pickedBatchCode) ||
    !optionalText(payload.pickedBatchReceivedAt) ||
    !optionalText(payload.mismatchReason) ||
    (payload.isMismatchWarningAcknowledged !== undefined &&
      typeof payload.isMismatchWarningAcknowledged !== "boolean")
  ) {
    return null;
  }

  return {
    version: 1,
    userId: record.userId,
    businessUnitId: record.businessUnitId,
    pickListId: record.pickListId,
    createdAt: record.createdAt,
    payload: {
      pickListItemId: payload.pickListItemId,
      operationId: payload.operationId,
      pickedQty: payload.pickedQty,
      batchLocationSku: payload.batchLocationSku as string | null | undefined,
      pickedLocationId: payload.pickedLocationId as string | null | undefined,
      pickedBatchCode: payload.pickedBatchCode as string | null | undefined,
      pickedBatchReceivedAt: payload.pickedBatchReceivedAt as string | null | undefined,
      isMismatchWarningAcknowledged: payload.isMismatchWarningAcknowledged as boolean | undefined,
      mismatchReason: payload.mismatchReason as string | null | undefined,
    },
  };
};

export const savePendingPickConfirmation = async (pending: PendingPickConfirmation) => {
  await AsyncStorage.setItem(
    storageKey(pending.userId, pending.pickListId),
    JSON.stringify(pending)
  );
};

export const loadPendingPickConfirmation = async (userId: string, pickListId: string) => {
  const key = storageKey(userId, pickListId);
  const serialized = await AsyncStorage.getItem(key);
  if (!serialized) return null;

  try {
    const pending = parsePendingConfirmation(JSON.parse(serialized) as unknown);
    if (pending?.userId === userId && pending.pickListId === pickListId) return pending;
  } catch {}

  await AsyncStorage.removeItem(key);
  return null;
};

export const clearPendingPickConfirmation = async (
  userId: string,
  pickListId: string,
  operationId: string
) => {
  const key = storageKey(userId, pickListId);
  const pending = await loadPendingPickConfirmation(userId, pickListId);
  if (!pending || pending.payload.operationId === operationId) {
    await AsyncStorage.removeItem(key);
  }
};
