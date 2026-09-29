"use client";

import { useMemo } from "react";
import { resolveGeometry } from "@/lib/framing/geometry";
import type { FrameConfiguration } from "@/lib/framing/types";

type FramePreviewProps = {
  config: FrameConfiguration;
  /** Hex fill per mat layer, index-aligned with `config.mat.layers`. */
  matColors: string[];
  size?: number;
};

const ARTWORK_PATTERN_ID = "frame-preview-artwork";

/**
 * Scale drawing to the frame's longest edge so the proportions stay true and the
 * whole frame always fits the box.
 */
function useScale(outsideLength: number, outsideWidth: number, size: number) {
  return useMemo(() => {
    const longest = Math.max(outsideLength, outsideWidth, 1);
    const scale = (size - 18) / longest;
    return { scale, centre: size / 2 };
  }, [outsideLength, outsideWidth, size]);
}

/**
 * The same concentric cross-section drawn as an outline, for a line with no
 * size yet. It stands in the space the real preview will occupy so the pane
 * keeps its shape — and so the reader can see what is coming — without
 * inventing geometry that would read as a configured frame.
 */
export function FramePreviewPlaceholder({ size = 240 }: { size?: number }) {
  const centre = size / 2;
  // A 4:5 portrait, the commonest shape on the shop's forms.
  const outer = size - 40;
  const box = (inset: number) => ({
    x: centre - (outer * 0.8) / 2 + inset,
    y: centre - outer / 2 + inset,
    width: outer * 0.8 - inset * 2,
    height: outer - inset * 2,
  });

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width={size}
      height={size}
      role="img"
      aria-hidden="true"
      className="text-muted-foreground/35"
    >
      <rect
        {...box(0)}
        rx={2}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeDasharray="5 4"
      />
      <rect {...box(14)} rx={1} fill="none" stroke="currentColor" strokeWidth={1} strokeDasharray="4 4" />
      <rect {...box(26)} rx={1} fill="currentColor" opacity={0.08} />
    </svg>
  );
}

/** Concentric cross-section: frame, then each mat layer, then the artwork. */
export function FramePreview({ config, matColors, size = 240 }: FramePreviewProps) {
  const geometry = resolveGeometry(config);
  const { scale, centre } = useScale(geometry.outside.lengthIn, geometry.outside.widthIn, size);

  const rect = (lengthIn: number, widthIn: number) => ({
    x: centre - (lengthIn * scale) / 2,
    y: centre - (widthIn * scale) / 2,
    width: Math.max(0, lengthIn * scale),
    height: Math.max(0, widthIn * scale),
  });

  const frameFill = config.billingMode === "framing" ? "#8A4B2A" : "#2F6B5E";
  const layers = config.mat.included ? config.mat.layers : [];
  const innermostOpening = geometry.openings[geometry.openings.length - 1];

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width={size}
      height={size}
      role="img"
      aria-label={`Frame cross-section: ${geometry.artwork.lengthIn} by ${geometry.artwork.widthIn} inch artwork in a ${geometry.outside.lengthIn} by ${geometry.outside.widthIn} inch frame`}
    >
      <defs>
        <pattern id={ARTWORK_PATTERN_ID} width="7" height="7" patternUnits="userSpaceOnUse">
          <rect width="7" height="7" fill="#EFEBE2" />
          <path d="M0 7 L7 0" stroke="#CFC7B6" strokeWidth="1" />
        </pattern>
      </defs>

      <rect {...rect(geometry.outside.lengthIn, geometry.outside.widthIn)} rx={2} fill={frameFill} />

      {layers.map((layer, index) => {
        // Layer 0 is bounded by the mat outer; every layer below by the opening above it.
        const bounds = index === 0 ? geometry.matOuter : geometry.openings[index - 1];
        if (!bounds) return null;
        return (
          <rect
            key={layer.layerIndex}
            {...rect(bounds.lengthIn, bounds.widthIn)}
            fill={matColors[index] ?? "#F2EDDF"}
            stroke="rgba(0,0,0,.18)"
            strokeWidth={0.7}
          />
        );
      })}

      <rect
        {...rect(
          innermostOpening?.lengthIn ?? geometry.artwork.lengthIn,
          innermostOpening?.widthIn ?? geometry.artwork.widthIn
        )}
        fill={`url(#${ARTWORK_PATTERN_ID})`}
        stroke="rgba(0,0,0,.22)"
        strokeWidth={0.7}
      />
    </svg>
  );
}
