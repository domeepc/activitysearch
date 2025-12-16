"use client";

import { AvatarUpload } from "@/components/ui/avatar-upload";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";

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
  const updateProfile = useAction(api.users.updateUserProfile);

  const handleAvatarChange = async (file: File) => {
    try {
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

      // Optionally refresh the page or refetch user data
      window.location.reload();
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
