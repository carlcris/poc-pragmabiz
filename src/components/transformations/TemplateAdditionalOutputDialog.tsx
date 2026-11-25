"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { AsyncSearchCombobox } from "@/components/shared/AsyncSearchCombobox";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useTransformationAdditionalOutputItems } from "@/hooks/useTransformationAdditionalOutputItems";
import { useUploadTransformationAdditionalOutputImage } from "@/hooks/useTransformationTemplates";
import { getApiErrorCode } from "@/lib/api";
import {
  ADDITIONAL_OUTPUT_IMAGE_MAX_SIZE,
  ADDITIONAL_OUTPUT_IMAGE_MIME_TYPES,
  ADDITIONAL_OUTPUT_IMAGE_UPLOAD_ERROR_CODES,
} from "@/lib/transformations/additional-output-images";
import type { TransformationAdditionalOutputItem } from "@/types/transformation-template";
import { TransformationAdditionalOutputThumbnail } from "./TransformationAdditionalOutputThumbnail";

export type TemplateAdditionalOutputDialogValue = {
  item: TransformationAdditionalOutputItem;
  quantity: number;
  notes?: string;
  imagePath?: string;
  imageThumbnailUrl?: string;
};

type TemplateAdditionalOutputDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (value: TemplateAdditionalOutputDialogValue) => void;
  excludedItemIds: string[];
};

export function TemplateAdditionalOutputDialog({
  open,
  onOpenChange,
  onSave,
  excludedItemIds,
}: TemplateAdditionalOutputDialogProps) {
  const t = useTranslations("transformation");
  const tCommon = useTranslations("common");
  const [search, setSearch] = useState("");
  const [selectedItem, setSelectedItem] = useState<TransformationAdditionalOutputItem | null>(null);
  const [quantity, setQuantity] = useState("1");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string>();
  const [imageError, setImageError] = useState<
    (typeof ADDITIONAL_OUTPUT_IMAGE_UPLOAD_ERROR_CODES)[number] | null
  >(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const imageHelpId = useId();
  const isSavingRef = useRef(false);
  const uploadImage = useUploadTransformationAdditionalOutputImage();
  const debouncedSearch = useDebouncedValue(search.trim());
  const { data, isLoading, isError } = useTransformationAdditionalOutputItems({
    search: debouncedSearch || undefined,
    limit: 5,
    excludedItemIds,
  });

  const options = useMemo(() => data?.data ?? [], [data?.data]);
  const hasInvalidImage =
    imageError === "ADDITIONAL_OUTPUT_IMAGE_TOO_LARGE" ||
    imageError === "ADDITIONAL_OUTPUT_IMAGE_INVALID";

  useEffect(() => {
    setImageFile(null);
    setImageError(null);
    if (!open) return;
    setSearch("");
    setSelectedItem(null);
    setQuantity("1");
    setNotes("");
    setError(null);
  }, [open]);

  useEffect(() => {
    if (!open || !imageFile) {
      setImagePreviewUrl(undefined);
      return;
    }

    const url = URL.createObjectURL(imageFile);
    setImagePreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [open, imageFile]);

  const handleImageSelection = (file: File) => {
    if (file.size > ADDITIONAL_OUTPUT_IMAGE_MAX_SIZE) {
      setImageFile(null);
      setImageError("ADDITIONAL_OUTPUT_IMAGE_TOO_LARGE");
      return;
    }
    if (!file.size || !ADDITIONAL_OUTPUT_IMAGE_MIME_TYPES.some((type) => type === file.type)) {
      setImageFile(null);
      setImageError("ADDITIONAL_OUTPUT_IMAGE_INVALID");
      return;
    }

    setImageFile(file);
    setImageError(null);
  };

  const handleSave = async () => {
    if (isSavingRef.current || hasInvalidImage) return;
    const outputQuantity = Number(quantity);
    if (!selectedItem) {
      setError(t("additionalOutputItemRequired"));
      return;
    }
    if (!Number.isFinite(outputQuantity) || outputQuantity <= 0) {
      setError(t("plannedQuantityGreaterThanZero"));
      return;
    }

    isSavingRef.current = true;
    setImageError(null);
    try {
      const image = imageFile ? await uploadImage.mutateAsync(imageFile) : undefined;
      onSave({
        item: selectedItem,
        quantity: outputQuantity,
        notes: notes.trim() || undefined,
        imagePath: image?.imagePath,
        imageThumbnailUrl: image?.imageThumbnailUrl,
      });
      onOpenChange(false);
    } catch (error) {
      setImageError(
        getApiErrorCode(error, ADDITIONAL_OUTPUT_IMAGE_UPLOAD_ERROR_CODES) ??
          "ADDITIONAL_OUTPUT_IMAGE_UPLOAD_FAILED"
      );
    } finally {
      isSavingRef.current = false;
      uploadImage.reset();
    }
  };

  const imageErrorMessage =
    imageError === "ADDITIONAL_OUTPUT_IMAGE_TOO_LARGE"
      ? t("additionalOutputImageTooLarge")
      : imageError === "ADDITIONAL_OUTPUT_IMAGE_INVALID"
        ? t("additionalOutputImageInvalid")
        : imageError === "ADDITIONAL_OUTPUT_IMAGE_UPLOAD_FAILED"
          ? t("additionalOutputImageUploadFailed")
          : null;

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!isSavingRef.current) onOpenChange(nextOpen);
      }}
    >
      <DialogContent
        className="flex max-h-dvh max-w-xl flex-col overflow-hidden"
        hideCloseButton={uploadImage.isPending}
      >
        <DialogHeader>
          <DialogTitle>{t("addAdditionalOutput")}</DialogTitle>
          <DialogDescription>{t("additionalOutputDialogDescription")}</DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">{tCommon("item")} *</label>
            <AsyncSearchCombobox
              value={selectedItem?.id ?? ""}
              onValueChange={(itemId) => {
                setSelectedItem(options.find((item) => item.id === itemId) ?? null);
                setError(null);
              }}
              searchValue={search}
              onSearchValueChange={setSearch}
              options={options}
              selectedOption={selectedItem}
              getOptionValue={(item) => item.id}
              getOptionLabel={(item) => `${item.item_code} - ${item.item_name}`}
              getOptionSearchValue={(item) => `${item.item_code} ${item.item_name}`}
              placeholder={t("selectAdditionalOutputItem")}
              searchPlaceholder={t("searchAdditionalOutputItems")}
              emptyMessage={
                isError ? t("additionalOutputItemsLoadError") : t("noAdditionalOutputItems")
              }
              loadingMessage={tCommon("loading")}
              isLoading={isLoading}
              disabled={uploadImage.isPending}
              renderOption={(item, selected) => (
                <div className="flex min-w-0 items-center gap-2">
                  <Check className={`h-4 w-4 ${selected ? "opacity-100" : "opacity-0"}`} />
                  <div className="min-w-0">
                    <div className="truncate font-medium">{item.item_code}</div>
                    <div className="truncate text-xs text-muted-foreground">{item.item_name}</div>
                  </div>
                </div>
              )}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("quantityPerTemplate")} *</label>
              <Input
                type="number"
                min="0.01"
                step="0.01"
                value={quantity}
                disabled={uploadImage.isPending}
                onChange={(event) => {
                  setQuantity(event.target.value);
                  setError(null);
                }}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("baseUnit")}</label>
              <Input
                value={
                  selectedItem
                    ? `${selectedItem.uom_code} - ${selectedItem.uom_name}`
                    : t("selectItemForBaseUnit")
                }
                disabled
              />
              <p className="text-xs text-muted-foreground">{t("baseUnitIsAutomatic")}</p>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">{tCommon("notes")}</label>
            <Textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              disabled={uploadImage.isPending}
              maxLength={500}
              rows={3}
              placeholder={t("additionalOutputNotesPlaceholder")}
            />
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">{t("additionalOutputImageOptional")}</p>
            <input
              ref={imageInputRef}
              type="file"
              accept={ADDITIONAL_OUTPUT_IMAGE_MIME_TYPES.join(",")}
              className="hidden"
              disabled={uploadImage.isPending}
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                if (file) handleImageSelection(file);
                event.currentTarget.value = "";
              }}
            />
            {imageFile && (
              <div className="flex items-center gap-2">
                <TransformationAdditionalOutputThumbnail src={imagePreviewUrl} alt="" />
                <span className="truncate text-sm">{imageFile.name}</span>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={uploadImage.isPending}
                aria-describedby={imageHelpId}
                onClick={() => imageInputRef.current?.click()}
              >
                {t("additionalOutputImageChoose")}
              </Button>
              {(imageFile || imageError) && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={uploadImage.isPending}
                  onClick={() => {
                    setImageFile(null);
                    setImageError(null);
                  }}
                >
                  {t("additionalOutputImageRemove")}
                </Button>
              )}
            </div>
            <p id={imageHelpId} className="text-xs text-muted-foreground">
              {t("additionalOutputImageRequirements")}
            </p>
            {imageErrorMessage && (
              <p role="alert" className="text-sm text-destructive">
                {imageErrorMessage}
              </p>
            )}
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>

        <DialogFooter className="shrink-0 gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={uploadImage.isPending}
          >
            {tCommon("cancel")}
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={uploadImage.isPending || hasInvalidImage}
          >
            {uploadImage.isPending && (
              <Loader2 aria-hidden="true" className="mr-2 size-4 animate-spin" />
            )}
            {uploadImage.isPending ? t("additionalOutputImageUploading") : t("addOutput")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
