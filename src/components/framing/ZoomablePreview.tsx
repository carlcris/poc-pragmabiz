"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Maximize2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FramePreview } from "./FramePreview";
import type { FrameConfiguration } from "@/lib/framing/types";

type ZoomablePreviewProps = {
  config: FrameConfiguration;
  matColors: string[];
  /** Size of the inline preview; the zoomed one sizes itself to the dialog. */
  size?: number;
};

/** Large enough that a 1/4" reveal clears a few pixels on a normal frame. */
const ZOOM_SIZE = 560;

/**
 * The frame preview with an on-demand zoom.
 *
 * At pane size a 1/4" reveal renders under two pixels, so a double mat looks
 * identical to a single one. Rather than exaggerate the bands — which would
 * misrepresent the border the customer is paying for — the same drawing is
 * offered larger, where the real proportions are simply legible.
 *
 * The zoom is opt-in: the inline preview is what the operator watches while
 * configuring, and it stays undisturbed.
 */
export function ZoomablePreview({ config, matColors, size = 200 }: ZoomablePreviewProps) {
  const t = useTranslations("framingDialog");
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t("zoomPreview")}
        title={t("zoomPreview")}
        className="group relative grid w-full place-items-center rounded-lg border bg-background p-4 transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <FramePreview config={config} matColors={matColors} size={size} />
        <span className="absolute right-2 top-2 rounded-md border bg-background/90 p-1 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
          <Maximize2 className="h-3.5 w-3.5" />
        </span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[min(92vw,680px)]">
          <DialogHeader>
            <DialogTitle>{t("zoomPreview")}</DialogTitle>
            <DialogDescription>{t("zoomPreviewHint")}</DialogDescription>
          </DialogHeader>
          <div className="grid place-items-center rounded-lg border bg-background p-6">
            <FramePreview config={config} matColors={matColors} size={ZOOM_SIZE} />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
