import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { AppState } from "react-native";
import { subscribeWarehouseQueue, type WarehouseQueueKind } from "@/lib/warehouse-queue-realtime";
import { useAuthStore } from "@/stores/authStore";
import {
  canAccessDeliveryNoteReceiving,
  canAccessLoadListReceiving,
  canAccessPicking,
} from "@/utils/permissions";
import { queryKeys } from "./queries";

export const useWarehouseQueueRealtime = (
  enabled: boolean,
  queue: WarehouseQueueKind | "all" = "all"
) => {
  const client = useQueryClient();
  const session = useAuthStore((state) => state.session);
  const isSwitchingBusinessUnit = useAuthStore((state) => state.isSwitchingBusinessUnit);
  const businessUnitId = session?.currentBusinessUnit?.id || "";
  const token = session?.token || "";
  const picking = queue !== "receiving" && canAccessPicking(session);
  const loadListReceiving = queue !== "picking" && canAccessLoadListReceiving(session);
  const deliveryNoteReceiving = queue !== "picking" && canAccessDeliveryNoteReceiving(session);

  useEffect(() => {
    if (
      !enabled ||
      (!picking && !loadListReceiving && !deliveryNoteReceiving) ||
      isSwitchingBusinessUnit ||
      !businessUnitId ||
      !token
    )
      return;

    let unsubscribe: (() => void) | null = null;
    const start = () => {
      if (unsubscribe) return;
      unsubscribe = subscribeWarehouseQueue(
        businessUnitId,
        token,
        { picking, loadListReceiving, deliveryNoteReceiving },
        (queues) => {
          if (queues.includes("picking")) {
            void client.invalidateQueries({ queryKey: queryKeys.pickListsScope(businessUnitId) });
          }
          if (queues.includes("receiving")) {
            void client.invalidateQueries({
              queryKey: queryKeys.receivingInboxScope(businessUnitId),
            });
          }
          void client.invalidateQueries({ queryKey: queryKeys.dashboard(businessUnitId) });
        }
      );
    };
    const stop = () => {
      unsubscribe?.();
      unsubscribe = null;
    };

    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") start();
      else stop();
    });
    if (AppState.currentState === "active") start();

    return () => {
      subscription.remove();
      stop();
    };
  }, [
    businessUnitId,
    client,
    deliveryNoteReceiving,
    enabled,
    isSwitchingBusinessUnit,
    loadListReceiving,
    picking,
    token,
  ]);
};
