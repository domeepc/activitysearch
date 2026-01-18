"use client";

import { AvatarUpload } from "@/components/ui/avatar-upload";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useRouter } from "next/navigation";

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
  const updateProfile = useAction(api.users.updateUserProfile);

  const handleAvatarChange = async (file: File) => {
    try {
      // Validate file size (max 750KB to account for base64 encoding overhead)
      // Base64 encoding adds ~33% overhead, so 750KB becomes ~1MB when encoded
      // This ensures we stay under Convex's 1MB document size limit
      const MAX_FILE_SIZE = 750 * 1024; // 750KB in bytes
      if (file.size > MAX_FILE_SIZE) {
        const fileSizeMB = (file.size / 1024 / 1024).toFixed(2);
        throw new Error(`File is too large (${fileSizeMB}MB)`);
      }

      // Convert the file to base64 or upload to a service
      // For this example, we'll convert to base64
      const base64 = await fileToBase64(file);

      // In a real application, you'd upload to a service like:
      // - Clerk's profile image endpoint
      // - AWS S3
      // - Cloudinary
      // - Convex storage (if configured)

      // For now, we'll use the base64 directly (not recommended for production)
      await updateProfile({ avatar: base64 });

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

// Helper function to convert file to base64
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
