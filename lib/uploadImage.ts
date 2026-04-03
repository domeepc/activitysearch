import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

/**
 * Returns a Clerk JWT accepted by Convex (`convex/auth.config.ts` applicationID `convex`).
 * Use: `() => getToken({ template: "convex" })` from `useAuth()`.
 */
export type ConvexAuthTokenFetcher = () => Promise<string | null | undefined>;

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

  const uploadResponse = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      "Content-Type": file.type || "application/octet-stream",
    },
    body: file,
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
