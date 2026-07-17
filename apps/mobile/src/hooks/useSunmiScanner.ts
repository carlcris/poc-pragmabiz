import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef } from "react";
import { sunmiScannerModule, type SunmiScanEvent } from "@/native/sunmi-scanner";

const DUPLICATE_SCAN_WINDOW_MS = 350;

type UseSunmiScannerOptions = {
  enabled?: boolean;
  onScan: (value: string) => void | Promise<void>;
};

type LastScan = {
  value: string;
  receivedAt: number;
};

export const useSunmiScanner = ({ enabled = true, onScan }: UseSunmiScannerOptions) => {
  const onScanRef = useRef(onScan);
  const processingRef = useRef(false);
  const lastScanRef = useRef<LastScan | null>(null);

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useFocusEffect(
    useCallback(() => {
      if (!enabled || !sunmiScannerModule) return;

      const subscription = sunmiScannerModule.addListener(
        "onScan",
        (event: SunmiScanEvent) => {
          const value = typeof event.value === "string" ? event.value.trim() : "";
          if (!value || processingRef.current) return;

          const receivedAt = Date.now();
          const lastScan = lastScanRef.current;
          if (
            lastScan?.value === value &&
            receivedAt - lastScan.receivedAt < DUPLICATE_SCAN_WINDOW_MS
          ) {
            return;
          }

          lastScanRef.current = { value, receivedAt };
          processingRef.current = true;

          void Promise.resolve()
            .then(() => onScanRef.current(value))
            .catch((error: unknown) => {
              console.error("SUNMI scanner handler failed", error);
            })
            .finally(() => {
              processingRef.current = false;
            });
        },
      );

      return () => {
        subscription.remove();
        processingRef.current = false;
        lastScanRef.current = null;
      };
    }, [enabled]),
  );
};
