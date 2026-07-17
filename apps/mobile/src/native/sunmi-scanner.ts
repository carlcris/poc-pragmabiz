import {
  NativeModule,
  requireOptionalNativeModule,
} from "expo";

export type SunmiScanEvent = {
  value: string;
};

type SunmiScannerModuleEvents = {
  onScan: (event: SunmiScanEvent) => void;
};

declare class SunmiScannerNativeModule extends NativeModule<SunmiScannerModuleEvents> {}

export const sunmiScannerModule =
  requireOptionalNativeModule<SunmiScannerNativeModule>("SunmiScanner");
