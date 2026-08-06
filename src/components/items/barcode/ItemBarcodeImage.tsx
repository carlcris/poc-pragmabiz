"use client";

import { useEffect, useRef, useState } from "react";
import JsBarcode from "jsbarcode";
import { Barcode } from "lucide-react";

type ItemBarcodeImageProps = {
  value?: string;
  alt: string;
};

export const ItemBarcodeImage = ({ value, alt }: ItemBarcodeImageProps) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (!value || !svgRef.current) return;

    try {
      JsBarcode(svgRef.current, value, {
        format: "CODE128",
        width: 2,
        height: 96,
        displayValue: false,
        margin: 0,
        background: "#FFFFFF",
        lineColor: "#111111",
      });
      setHasError(false);
    } catch {
      svgRef.current.replaceChildren();
      setHasError(true);
    }
  }, [value]);

  if (!value) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-muted-foreground">
        <Barcode className="h-8 w-8" />
      </div>
    );
  }

  return (
    <div role="img" aria-label={alt} className="flex h-full w-full items-center justify-center">
      <svg
        key={value}
        ref={svgRef}
        aria-hidden="true"
        focusable="false"
        className={hasError ? "hidden" : "h-auto max-h-24 w-auto max-w-full"}
      />
      {hasError ? <Barcode className="h-8 w-8 text-muted-foreground" /> : null}
    </div>
  );
};
