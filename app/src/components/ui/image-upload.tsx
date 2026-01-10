"use client";

import { useState, useRef } from "react";
import { X, Image as ImageIcon, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import Image from "next/image";

interface ImageUploadProps {
  value?: string;
  onChange: (url: string | undefined) => void;
  disabled?: boolean;
  itemId?: string;
  className?: string;
}

export function ImageUpload({
  value,
  onChange,
  disabled,
  itemId,
  className,
}: ImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [preview, setPreview] = useState<string | undefined>(value);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"];
    if (!allowedTypes.includes(file.type)) {
      alert("Invalid file type. Only JPEG, PNG, WebP, and GIF are allowed.");
      return;
    }

    // Validate file size (5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      alert("File too large. Maximum size is 5MB.");
      return;
    }

    // Show preview immediately
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    // Upload file
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      if (itemId) {
        formData.append("itemId", itemId);
      }

      const response = await fetch("/api/items/upload-image", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to upload image");
      }

      const data = await response.json();
      onChange(data.imageUrl);
      setPreview(data.imageUrl);
    } catch (error) {

      alert(error instanceof Error ? error.message : "Failed to upload image");
      setPreview(value);
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemove = async () => {
    if (!value) return;

    // Extract path from URL if it's a full URL
    try {
      const url = new URL(value);
      const pathMatch = url.pathname.match(/\/item-images\/(.+)/);
      const path = pathMatch ? pathMatch[1] : null;

      if (path) {
        await fetch(`/api/items/upload-image?path=${encodeURIComponent(path)}`, {
          method: "DELETE",
        });
      }
    } catch {
    }

    setPreview(undefined);
    onChange(undefined);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className={cn("space-y-2", className)}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
        onChange={handleFileSelect}
        disabled={disabled || isUploading}
        className="hidden"
      />

      {preview ? (
        <div className="relative w-full max-w-[250px] h-[215px] flex flex-col items-center justify-center gap-2 rounded-lg border bg-muted overflow-hidden">
          <Image
            src={preview}
            alt="Item image"
            fill
            className="object-contain p-2"
            unoptimized
          />
          {!disabled && (
            <Button
              type="button"
              variant="destructive"
              size="icon"
              className="absolute top-2 right-2 h-8 w-8"
              onClick={handleRemove}
              disabled={isUploading}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
          {isUploading && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-white" />
            </div>
          )}
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          className="w-full max-w-[250px] h-[215px] flex flex-col items-center justify-center gap-2 border-dashed"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || isUploading}
        >
          {isUploading ? (
            <>
              <Loader2 className="h-8 w-8 animate-spin" />
              <span className="text-sm text-muted-foreground">Uploading...</span>
            </>
          ) : (
            <>
              <ImageIcon className="h-8 w-8 text-muted-foreground" />
              <div className="text-sm text-center">
                <span className="text-primary">Click to upload</span>
                <p className="text-xs text-muted-foreground mt-1">
                  PNG, JPG, WebP or GIF (max 5MB)
                </p>
              </div>
            </>
          )}
        </Button>
      )}
    </div>
  );
}
