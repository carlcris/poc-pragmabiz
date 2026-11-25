"use client";

import { useState } from "react";
import { ImageOff } from "lucide-react";

type TransformationAdditionalOutputThumbnailProps = {
  src?: string | null;
  alt: string;
};

export function TransformationAdditionalOutputThumbnail({
  src,
  alt,
}: TransformationAdditionalOutputThumbnailProps) {
  const [failedSrc, setFailedSrc] = useState<string>();

  return (
    <span className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
      {src && src !== failedSrc ? (
        // Storage serves an already-sized thumbnail at a short-lived signed URL.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          className="size-full object-contain"
          onError={() => setFailedSrc(src)}
        />
      ) : (
        <ImageOff className="size-5 text-muted-foreground" aria-hidden="true" />
      )}
    </span>
  );
}
