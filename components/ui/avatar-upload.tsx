"use client";

import * as React from "react";
import { Avatar, AvatarFallback, AvatarImage } from "./avatar";
import { Button } from "./button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./dialog";
import { Camera, Upload, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  MAX_IMAGE_UPLOAD_BYTES,
  MAX_IMAGE_UPLOAD_LABEL,
} from "@/lib/uploadLimits";

interface AvatarUploadProps {
  currentAvatar?: string;
  userName?: string;
  onAvatarChange: (file: File) => Promise<void>;
  className?: string;
  disabled?: boolean;
  size?: "sm" | "md";
}

export function AvatarUpload({
  currentAvatar,
  userName = "User",
  onAvatarChange,
  className,
  disabled = false,
  size = "md",
}: AvatarUploadProps) {
  const [open, setOpen] = React.useState(false);
  const [preview, setPreview] = React.useState<string | null>(null);
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [isUploading, setIsUploading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      setError("Please select an image file.");
      return;
    }

    if (file.size > MAX_IMAGE_UPLOAD_BYTES) {
      const fileSizeMB = (file.size / 1024 / 1024).toFixed(2);
      setError(
        `File is too large (${fileSizeMB}MB). Maximum is ${MAX_IMAGE_UPLOAD_LABEL}.`
      );
      return;
    }

    // Clear any previous errors
    setError(null);
    setSelectedFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    setError(null);
    try {
      await onAvatarChange(selectedFile);
      setOpen(false);
      setPreview(null);
      setSelectedFile(null);
      setError(null);
    } catch (error) {
      console.error("Failed to upload avatar:", error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to upload avatar. Please try again.";
      setError(errorMessage);
    } finally {
      setIsUploading(false);
    }
  };

  const handleCancel = () => {
    setPreview(null);
    setSelectedFile(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const initials = userName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild disabled={disabled}>
        <button
          className={cn(
            "relative group",
            className,
            disabled ? "cursor-default" : "cursor-pointer"
          )}
          disabled={disabled}
        >
          <Avatar
            className={cn(
              "border-4 border-background",
              size === "sm" ? "size-16" : "size-24"
            )}
          >
            <AvatarImage src={currentAvatar} alt={userName} />
            <AvatarFallback
              className={size === "sm" ? "text-lg" : "text-2xl"}
            >
              {initials}
            </AvatarFallback>
          </Avatar>
          {!disabled && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
              <Camera
                className={cn("text-white", size === "sm" ? "size-4" : "size-6")}
              />
            </div>
          )}
        </button>
      </DialogTrigger>
      <DialogContent
        className="sm:max-w-md"
        onOpenAutoFocus={() => setError(null)}
      >
        <DialogHeader>
          <DialogTitle>Change Avatar</DialogTitle>
          <DialogDescription>
            Upload a new profile picture. Recommended size: 400x400px. Maximum
            file size: {MAX_IMAGE_UPLOAD_LABEL}.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4 py-4">
          <Avatar
            className={cn(
              "border-4 border-background",
              size === "sm" ? "size-24" : "size-32"
            )}
          >
            <AvatarImage src={preview || currentAvatar} alt={userName} />
            <AvatarFallback
              className={size === "sm" ? "text-2xl" : "text-3xl"}
            >
              {initials}
            </AvatarFallback>
          </Avatar>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
            id="avatar-upload"
          />

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="size-4 mr-2" />
              Choose File
            </Button>

            {preview && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleCancel}
              >
                <X className="size-4 mr-2" />
                Clear
              </Button>
            )}
          </div>

          {selectedFile && (
            <p className="text-sm text-muted-foreground">{selectedFile.name}</p>
          )}
          {error && <p className="text-sm text-destructive mt-2">{error}</p>}
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isUploading}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleUpload}
            disabled={!selectedFile || isUploading}
          >
            {isUploading ? "Uploading..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
