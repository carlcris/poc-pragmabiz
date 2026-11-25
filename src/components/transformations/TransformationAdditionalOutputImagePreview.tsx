"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { TransformationAdditionalOutputThumbnail } from "./TransformationAdditionalOutputThumbnail";

type TransformationAdditionalOutputImagePreviewProps = {
  itemName: string;
  imageUrl?: string | null;
  thumbnailUrl?: string | null;
  isRefreshing: boolean;
  onRefresh: () => Promise<boolean>;
};

export function TransformationAdditionalOutputImagePreview({
  itemName,
  imageUrl,
  thumbnailUrl,
  isRefreshing,
  onRefresh,
}: TransformationAdditionalOutputImagePreviewProps) {
  const t = useTranslations("transformation");
  const tCommon = useTranslations("common");
  const [failedSrc, setFailedSrc] = useState<string>();

  if (!imageUrl) {
    return (
      <div className="flex max-w-36 flex-col gap-1">
        <TransformationAdditionalOutputThumbnail src={thumbnailUrl} alt="" />
        <p className="text-xs text-muted-foreground">{t("additionalOutputImageLoadError")}</p>
      </div>
    );
  }

  return (
    <Dialog
      onOpenChange={(open) => {
        if (open) setFailedSrc(undefined);
      }}
    >
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="size-auto shrink-0 cursor-zoom-in p-0"
          aria-label={t("additionalOutputImageView", { item: itemName })}
        >
          <TransformationAdditionalOutputThumbnail src={thumbnailUrl} alt="" />
        </Button>
      </DialogTrigger>
      <DialogContent hideCloseButton className="flex max-h-dvh max-w-4xl flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>{t("additionalOutputImagePreview")}</DialogTitle>
          <DialogDescription>{itemName}</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 overflow-auto rounded-md bg-muted">
          {imageUrl === failedSrc ? (
            <div className="space-y-3 p-6 text-center text-sm text-muted-foreground">
              <p role="alert">{t("additionalOutputImageLoadError")}</p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={isRefreshing}
                onClick={async () => {
                  if (await onRefresh()) setFailedSrc(undefined);
                }}
              >
                {t("additionalOutputImagesRetry")}
              </Button>
            </div>
          ) : (
            // The signed original can be shown directly from storage within this dialog.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl}
              alt={itemName}
              decoding="async"
              className="mx-auto max-h-dvh w-auto max-w-full object-contain"
              onError={() => setFailedSrc(imageUrl)}
            />
          )}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              {tCommon("close")}
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
