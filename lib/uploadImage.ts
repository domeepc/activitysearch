import {ConvexHttpClient} from "convex/browser";
import {api} from "@/convex/_generated/api";
import type {Id} from "@/convex/_generated/dataModel";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
const convexClient = convexUrl ? new ConvexHttpClient(convexUrl) : null;

export async function uploadImage(
  file: File,
  kind: "avatar" | "activity"
): Promise<string> {
  if (!convexClient) {
    throw new Error("Missing NEXT_PUBLIC_CONVEX_URL");
  }

  const uploadUrl = await convexClient.mutation(api.uploads.generateUploadUrl, {
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

  const result = await convexClient.mutation(
    api.uploads.resolveUploadedImageUrl,
    {
      storageId: storageId as Id<"_storage">,
      kind,
    }
  );

  if (!result.url) {
    throw new Error("Upload failed: missing file URL");
  }

  return result.url;
}
