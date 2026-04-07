"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import Image from "next/image";
import { Loader2, QrCode } from "lucide-react";

type ItemBarcodeImageProps = {
  value?: string;
  alt: string;
  size?: number;
};

export const ItemBarcodeImage = ({ value, alt, size = 200 }: ItemBarcodeImageProps) => {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const generate = async () => {
      if (!value) {
        setDataUrl(null);
        return;
      }

      try {
        setIsLoading(true);
        const nextDataUrl = await QRCode.toDataURL(value, {
          errorCorrectionLevel: "M",
          margin: 1,
          width: size,
          color: {
            dark: "#111111",
            light: "#FFFFFF",
          },
        });

        if (!cancelled) {
          setDataUrl(nextDataUrl);
        }
      } catch {
        if (!cancelled) {
          setDataUrl(null);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    generate();

    return () => {
      cancelled = true;
    };
  }, [size, value]);

  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!dataUrl) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-muted-foreground">
        <QrCode className="h-8 w-8" />
      </div>
    );
  }

  return (
    <Image
      src={dataUrl}
      alt={alt}
      width={size}
      height={size}
      className="mx-auto object-contain"
      unoptimized
    />
  );
};
