"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type CameraScannerDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  onDetected: (code: string) => void;
};

type DetectedCode = { rawValue?: string };
type BarcodeDetectorInstance = {
  detect: (source: ImageBitmapSource) => Promise<DetectedCode[]>;
};
type BarcodeDetectorCtor = new (options?: { formats?: string[] }) => BarcodeDetectorInstance;
type Html5QrcodeInstance = {
  start: (
    cameraConfig: { facingMode: string },
    config: {
      fps?: number;
      qrbox?: { width: number; height: number };
      formatsToSupport?: number[];
    },
    onSuccess: (decodedText: string) => void,
    onError?: (errorMessage: string) => void
  ) => Promise<unknown>;
  stop: () => Promise<unknown>;
  clear: () => Promise<unknown>;
};

const getBarcodeDetectorCtor = (): BarcodeDetectorCtor | null => {
  const maybeCtor = (globalThis as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
  return maybeCtor || null;
};

export function CameraScannerDialog({
  open,
  onOpenChange,
  title,
  onDetected,
}: CameraScannerDialogProps) {
  const reactId = useId();
  const containerId = `camera-scanner-${reactId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<BarcodeDetectorInstance | null>(null);
  const frameRef = useRef<number | null>(null);
  const html5ScannerRef = useRef<Html5QrcodeInstance | null>(null);
  const detectedRef = useRef(false);

  const [isStarting, setIsStarting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fallbackMode, setFallbackMode] = useState(false);
  const [helpMessage, setHelpMessage] = useState<string | null>(null);

  const stopCamera = async () => {
    if (frameRef.current) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (html5ScannerRef.current) {
      try {
        await html5ScannerRef.current.stop();
      } catch {}
      try {
        await html5ScannerRef.current.clear();
      } catch {}
      html5ScannerRef.current = null;
    }
    detectedRef.current = false;
  };

  useEffect(() => {
    if (!open) {
      void stopCamera();
      setErrorMessage(null);
      setHelpMessage(null);
      return;
    }

    let cancelled = false;

    const startCamera = async () => {
      try {
        setIsStarting(true);
        setErrorMessage(null);
        setHelpMessage(null);

        if (!window.isSecureContext) {
          setErrorMessage("Camera requires a secure context (HTTPS).");
          setHelpMessage("Open this app using https:// or localhost. HTTP on LAN/IP is blocked.");
          return;
        }

        const Ctor = getBarcodeDetectorCtor();
        if (!Ctor) {
          setFallbackMode(true);
          const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import("html5-qrcode");
          const scanner = new Html5Qrcode(containerId, {
            verbose: false,
          }) as unknown as Html5QrcodeInstance;
          html5ScannerRef.current = scanner;

          await scanner.start(
            { facingMode: "environment" },
            {
              fps: 10,
              qrbox: { width: 250, height: 250 },
              formatsToSupport: [
                Html5QrcodeSupportedFormats.QR_CODE,
                Html5QrcodeSupportedFormats.CODE_128,
                Html5QrcodeSupportedFormats.CODE_39,
                Html5QrcodeSupportedFormats.EAN_13,
                Html5QrcodeSupportedFormats.EAN_8,
                Html5QrcodeSupportedFormats.UPC_A,
                Html5QrcodeSupportedFormats.UPC_E,
              ],
            },
            (decodedText) => {
              if (detectedRef.current) return;
              detectedRef.current = true;
              onDetected(decodedText);
              onOpenChange(false);
            }
          );
          return;
        }

        setFallbackMode(false);
        detectorRef.current = new Ctor({
          formats: ["qr_code", "code_128", "code_39", "ean_13", "ean_8", "upc_a", "upc_e"],
        });

        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
          },
          audio: false,
        });

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        const scanFrame = async () => {
          try {
            if (!videoRef.current || !detectorRef.current) return;
            if (videoRef.current.readyState < 2) {
              frameRef.current = requestAnimationFrame(scanFrame);
              return;
            }

            const detections = await detectorRef.current.detect(videoRef.current);
            const code = detections.find((d) => d.rawValue?.trim())?.rawValue?.trim();
            if (code) {
              if (detectedRef.current) return;
              detectedRef.current = true;
              onDetected(code);
              onOpenChange(false);
              return;
            }
          } catch {
            // Ignore frame-level detection errors and keep scanning
          }
          frameRef.current = requestAnimationFrame(scanFrame);
        };

        frameRef.current = requestAnimationFrame(scanFrame);
      } catch {
        setErrorMessage("Unable to access tablet camera.");
        setHelpMessage(
          "Allow camera permission in Chrome site settings and ensure no other app is using the camera."
        );
      } finally {
        setIsStarting(false);
      }
    };

    void startCamera();

    return () => {
      cancelled = true;
      void stopCamera();
    };
  }, [containerId, open, onDetected, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="overflow-hidden rounded-md border bg-black">
            <video ref={videoRef} className="h-64 w-full object-cover" muted playsInline />
          </div>
          {fallbackMode && <div id={containerId} className="min-h-10" />}

          {isStarting && <p className="text-sm text-muted-foreground">Starting camera...</p>}
          {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}
          {helpMessage && <p className="text-xs text-muted-foreground">{helpMessage}</p>}
          {fallbackMode && (
            <p className="text-xs text-muted-foreground">
              Running fallback scanner mode for this browser.
            </p>
          )}

          <div className="flex justify-end">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
