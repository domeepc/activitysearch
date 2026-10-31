import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

/**
 * Returns a Clerk JWT accepted by Convex (`convex/auth.config.ts` applicationID `convex`).
 * Use: `() => getToken({ template: "convex" })` from `useAuth()`.
 */
export type ConvexAuthTokenFetcher = () => Promise<string | null | undefined>;

// Longest side after resizing. Phone photos are often 4000px+ and several MB.
const MAX_SIDE: Record<"avatar" | "activity" | "quest", number> = {
  avatar: 512,
  quest: 512,
  activity: 2000,
};

/** Resize and re-encode as WebP in the browser. Falls back to the original file. */
async function shrinkImage(file: File, maxSide: number): Promise<Blob> {
  // Keep vector and animated formats as they are.
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return file;
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", 0.85)
    );
    return blob && blob.size < file.size ? blob : file;
  } catch {
    return file;
  }
}

export async function uploadImage(
  file: File,
  kind: "avatar" | "activity" | "quest",
  getConvexJwt: ConvexAuthTokenFetcher
): Promise<string> {
  if (!convexUrl) {
    throw new Error("Missing NEXT_PUBLIC_CONVEX_URL");
  }

  const token = await getConvexJwt();
  if (!token) {
    throw new Error("You must be logged in to upload images");
  }

  const client = new ConvexHttpClient(convexUrl);
  client.setAuth(token);

  const uploadUrl = await client.mutation(api.uploads.generateUploadUrl, {
    kind,
  });

  const body = await shrinkImage(file, MAX_SIDE[kind]);
  const uploadResponse = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      "Content-Type": body.type || "application/octet-stream",
    },
    body,
  });

  if (!uploadResponse.ok) {
    throw new Error("Failed to upload image binary to storage");
  }

  const { storageId } = (await uploadResponse.json()) as {
    storageId?: string;
  };

  if (!storageId) {
    throw new Error("Upload failed: missing storageId");
  }

  const result = await client.mutation(api.uploads.resolveUploadedImageUrl, {
    storageId: storageId as Id<"_storage">,
    kind,
  });

  if (!result.url) {
    throw new Error("Upload failed: missing file URL");
  }

  return result.url;
}
