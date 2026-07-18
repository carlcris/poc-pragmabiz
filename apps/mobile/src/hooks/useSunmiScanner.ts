import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
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
  const appIsActiveRef = useRef(AppState.currentState === "active");
  const [appIsActive, setAppIsActive] = useState(appIsActiveRef.current);

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      const isActive = nextAppState === "active";
      appIsActiveRef.current = isActive;
      setAppIsActive(isActive);
    });

    return () => subscription.remove();
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!enabled || !appIsActive || !sunmiScannerModule) return;

      const subscription = sunmiScannerModule.addListener(
        "onScan",
        (event: SunmiScanEvent) => {
          if (!appIsActiveRef.current) return;

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
    }, [appIsActive, enabled]),
  );
};
