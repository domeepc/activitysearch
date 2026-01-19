"use client";

import { AvatarUpload } from "@/components/ui/avatar-upload";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useIsMobile } from "@/lib/hooks/useIsMobile";

interface TeamIconSectionProps {
  teamId: Id<"teams">;
  currentIcon?: string;
  teamName: string;
  disabled?: boolean;
}

export function TeamIconSection({
  teamId,
  currentIcon,
  teamName,
  disabled = false,
}: TeamIconSectionProps) {
  const isMobile = useIsMobile();
  const updateTeamIcon = useMutation(api.teams.updateTeamIcon);

  const handleIconChange = async (file: File) => {
    try {
      // Validate file size (max 750KB to account for base64 encoding overhead)
      // Base64 encoding adds ~33% overhead, so 750KB becomes ~1MB when encoded
      // This ensures we stay under Convex's 1MB document size limit
      const MAX_FILE_SIZE = 750 * 1024; // 750KB in bytes
      if (file.size > MAX_FILE_SIZE) {
        const fileSizeMB = (file.size / 1024 / 1024).toFixed(2);
        throw new Error(`File is too large (${fileSizeMB}MB)`);
      }

      // Convert the file to base64
      const base64 = await fileToBase64(file);

      // Update team icon
      await updateTeamIcon({ teamId, icon: base64 });
    } catch (error) {
      console.error("Failed to update team icon:", error);
      throw error;
    }
  };

  return (
    <AvatarUpload
      currentAvatar={currentIcon}
      userName={teamName}
      onAvatarChange={handleIconChange}
      disabled={disabled}
      size={isMobile ? "sm" : "md"}
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
