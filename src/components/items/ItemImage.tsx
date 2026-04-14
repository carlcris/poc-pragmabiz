"use client";

import { useEffect, useState } from "react";
import Image, { type StaticImageData } from "next/image";
import noImagePlaceholder from "@/assets/no-image.jpeg";

type ItemImageProps = {
  src?: string;
  alt: string;
  className?: string;
  sizes?: string;
};

export function ItemImage({ src, alt, className, sizes }: ItemImageProps) {
  const [imageSrc, setImageSrc] = useState<string | StaticImageData>(src || noImagePlaceholder);

  useEffect(() => {
    setImageSrc(src || noImagePlaceholder);
  }, [src]);

  return (
    <Image
      src={imageSrc}
      alt={alt}
      fill
      className={className}
      sizes={sizes}
      unoptimized
      onError={() => setImageSrc(noImagePlaceholder)}
    />
  );
}
