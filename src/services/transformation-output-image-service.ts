import "server-only";

import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { createAdminClient } from "@/lib/supabase/admin";
import { ADDITIONAL_OUTPUT_IMAGE_PATH_PATTERN } from "@/lib/transformations/additional-output-images";
import type { TransformationAdditionalOutputImage } from "@/types/transformation-template";

const BUCKET = "transformation-output-images";
const SIGNED_URL_LIFETIME_SECONDS = 3600;
const MAX_IMAGE_PIXELS = 40_000_000;
const FORMAT_BY_MIME_TYPE: Record<string, string> = {
  "image/jpeg": "jpeg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export async function createAdditionalOutputThumbnail(buffer: Buffer, mimeType: string) {
  const image = sharp(buffer, { limitInputPixels: MAX_IMAGE_PIXELS, failOn: "warning" });
  const metadata = await image.metadata();
  if (!metadata.format || metadata.format !== FORMAT_BY_MIME_TYPE[mimeType]) {
    throw new Error("Invalid image content");
  }

  return image
    .rotate()
    .resize(192, 192, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer();
}

/** Sign only paths from rows whose template access has already been authorized. */
export async function signAdditionalOutputImages<T extends { image_path?: string | null }>(
  outputs: T[],
  companyId: string
) {
  const imagePaths = [
    ...new Set(
      outputs.flatMap((output) =>
        output.image_path &&
        ADDITIONAL_OUTPUT_IMAGE_PATH_PATTERN.test(output.image_path) &&
        output.image_path.startsWith(`${companyId}/`)
          ? [output.image_path]
          : []
      )
    ),
  ];
  const signedUrls = new Map<string, string>();

  if (imagePaths.length > 0) {
    const paths = imagePaths.flatMap((path) => [`${path}/original`, `${path}/thumbnail.webp`]);
    const { data, error } = await createAdminClient()
      .storage.from(BUCKET)
      .createSignedUrls(paths, SIGNED_URL_LIFETIME_SECONDS);

    if (error) {
      console.error("Failed to sign transformation additional output images", error);
      throw new Error("Additional output images could not be loaded");
    }

    for (const entry of data ?? []) {
      if (!entry.error && entry.path && entry.signedUrl) {
        signedUrls.set(entry.path, entry.signedUrl);
      }
    }
  }

  return outputs.map((output) => {
    const original = signedUrls.get(`${output.image_path}/original`);
    const thumbnail = signedUrls.get(`${output.image_path}/thumbnail.webp`);
    return {
      ...output,
      image_url: original && thumbnail ? original : null,
      image_thumbnail_url: original && thumbnail ? thumbnail : null,
    };
  });
}

export async function uploadAdditionalOutputImage({
  buffer,
  thumbnail,
  mimeType,
  companyId,
  businessUnitId,
  userId,
}: {
  buffer: Buffer;
  thumbnail: Buffer;
  mimeType: string;
  companyId: string;
  businessUnitId: string;
  userId: string;
}): Promise<TransformationAdditionalOutputImage> {
  const imagePath = `${companyId}/${businessUnitId}/${userId}/${randomUUID()}`;
  const paths = [`${imagePath}/original`, `${imagePath}/thumbnail.webp`];
  const storage = createAdminClient().storage.from(BUCKET);

  try {
    const results = await Promise.allSettled([
      storage.upload(paths[0], buffer, { contentType: mimeType, upsert: false }),
      storage.upload(paths[1], thumbnail, { contentType: "image/webp", upsert: false }),
    ]);

    for (const result of results) {
      if (result.status === "rejected") throw result.reason;
      if (result.value.error) throw result.value.error;
    }

    const [signedImage] = await signAdditionalOutputImages([{ image_path: imagePath }], companyId);
    if (!signedImage.image_url || !signedImage.image_thumbnail_url) {
      throw new Error("Uploaded image could not be loaded");
    }

    return {
      imagePath,
      imageUrl: signedImage.image_url,
      imageThumbnailUrl: signedImage.image_thumbnail_url,
    };
  } catch (error) {
    const { error: cleanupError } = await storage.remove(paths);
    if (cleanupError) {
      console.error("Failed to clean up incomplete additional output image upload", {
        imagePath,
        error: cleanupError,
      });
    }
    throw error;
  }
}
