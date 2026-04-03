"use client";

import { useAuth } from "@clerk/nextjs";
import { AvatarUpload } from "@/components/ui/avatar-upload";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useRouter } from "next/navigation";
import { uploadImage } from "@/lib/uploadImage";
import {
  MAX_IMAGE_UPLOAD_BYTES,
  MAX_IMAGE_UPLOAD_LABEL,
} from "@/lib/uploadLimits";

interface UserAvatarSectionProps {
  currentAvatar?: string;
  userName?: string;
  disabled?: boolean;
}

export function UserAvatarSection({
  currentAvatar,
  userName,
  disabled = false,
}: UserAvatarSectionProps) {
  const router = useRouter();
  const { getToken } = useAuth();
  const updateProfile = useAction(api.users.updateUserProfile);

  const handleAvatarChange = async (file: File) => {
    try {
      if (file.size > MAX_IMAGE_UPLOAD_BYTES) {
        const fileSizeMB = (file.size / 1024 / 1024).toFixed(2);
        throw new Error(
          `File is too large (${fileSizeMB}MB). Maximum is ${MAX_IMAGE_UPLOAD_LABEL}.`
        );
      }

      const avatarUrl = await uploadImage(file, "avatar", () =>
        getToken({ template: "convex" })
      );
      await updateProfile({ avatar: avatarUrl });

      // Refresh the page to show updated avatar
      router.refresh();
    } catch (error) {
      console.error("Failed to update avatar:", error);
      throw error;
    }
  };

  return (
    <AvatarUpload
      currentAvatar={currentAvatar}
      userName={userName}
      onAvatarChange={handleAvatarChange}
      disabled={disabled}
    />
  );
}
