"use client";

import * as React from "react";
import { Avatar, AvatarFallback, AvatarImage, isPlaceholderAvatar } from "./avatar";
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
import { Camera, Crosshair, Upload, X } from "lucide-react";
import { clampOffset, cropRect } from "@/lib/avatarCrop";
import { cn } from "@/lib/utils";
import {
  MAX_IMAGE_UPLOAD_BYTES,
  MAX_IMAGE_UPLOAD_LABEL,
} from "@/lib/uploadLimits";

const VIEWPORT = 224; // px, the circle in the editor
const OUTPUT = 512; // px, the uploaded square
const MAX_ZOOM = 3;

interface AvatarUploadProps {
  currentAvatar?: string;
  userName?: string;
  onAvatarChange: (file: File) => Promise<void>;
  className?: string;
  disabled?: boolean;
  size?: "sm" | "md";
  /** Generated-avatar style when there's no photo: faces for people, abstract for teams */
  fallbackVariant?: "beam" | "marble";
}

export function AvatarUpload({
  currentAvatar,
  userName = "User",
  onAvatarChange,
  className,
  disabled = false,
  size = "md",
  fallbackVariant = "beam",
}: AvatarUploadProps) {
  const [open, setOpen] = React.useState(false);
  const [preview, setPreview] = React.useState<string | null>(null);
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [isUploading, setIsUploading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const imgRef = React.useRef<HTMLImageElement>(null);
  const dragRef = React.useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const [natural, setNatural] = React.useState<{ w: number; h: number } | null>(null);
  const [zoom, setZoom] = React.useState(1);
  const [offset, setOffset] = React.useState({ x: 0, y: 0 });
  const [adjusted, setAdjusted] = React.useState(false);
  // The current photo's host must allow CORS for the browser to crop it; otherwise only a new upload can be adjusted
  const [corsBlocked, setCorsBlocked] = React.useState(false);

  const existing = isPlaceholderAvatar(currentAvatar) ? null : currentAvatar!;
  const source = preview ?? existing;
  const editable = !!source && !(source === existing && corsBlocked);
  const crop = natural ? { imageWidth: natural.w, imageHeight: natural.h, viewport: VIEWPORT, zoom } : null;

  const resetPosition = () => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    setAdjusted(false);
  };
  const moveTo = (next: { x: number; y: number }, nextZoom = zoom) => {
    if (!natural) return;
    setOffset(clampOffset({ imageWidth: natural.w, imageHeight: natural.h, viewport: VIEWPORT, zoom: nextZoom, offset: next }));
    setAdjusted(true);
  };

  /** Draw exactly what's inside the circle into a square image */
  const renderCrop = async (): Promise<File> => {
    const img = imgRef.current;
    if (!img || !crop) throw new Error("The photo hasn't loaded yet.");
    const rect = cropRect({ ...crop, offset });
    const canvas = document.createElement("canvas");
    canvas.width = OUTPUT;
    canvas.height = OUTPUT;
    canvas.getContext("2d")?.drawImage(img, rect.x, rect.y, rect.size, rect.size, 0, 0, OUTPUT, OUTPUT);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.9));
    if (!blob) throw new Error("Couldn't prepare the photo. Please try another one.");
    return new File([blob], "avatar.webp", { type: "image/webp" });
  };

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
    setNatural(null);
    resetPosition();
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleUpload = async () => {
    if (!editable) return;

    setIsUploading(true);
    setError(null);
    try {
      await onAvatarChange(await renderCrop());
      setOpen(false);
      setPreview(null);
      setSelectedFile(null);
      setError(null);
      resetPosition();
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
    setNatural(null);
    resetPosition();
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) handleCancel(); // closing discards an unsaved photo or position
      }}
    >
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
            <AvatarFallback name={userName} variant={fallbackVariant} />
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
            Upload a photo, then drag and zoom to choose what shows in the circle. Maximum file size:{" "}
            {MAX_IMAGE_UPLOAD_LABEL}.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4 py-4">
          {source ? (
            <div className="flex w-full flex-col items-center gap-3">
              <div
                role="group"
                tabIndex={editable ? 0 : -1}
                aria-label="Photo position. Drag, or use the arrow keys, to move the photo inside the circle."
                className={cn(
                  "relative touch-none select-none overflow-hidden rounded-full bg-muted ring-4 ring-background outline-none focus-visible:ring-ring",
                  editable ? "cursor-grab active:cursor-grabbing" : ""
                )}
                style={{ width: VIEWPORT, height: VIEWPORT }}
                onPointerDown={(e) => {
                  if (!editable) return;
                  e.currentTarget.setPointerCapture(e.pointerId);
                  dragRef.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
                }}
                onPointerMove={(e) => {
                  const d = dragRef.current;
                  if (d) moveTo({ x: d.ox + e.clientX - d.x, y: d.oy + e.clientY - d.y });
                }}
                onPointerUp={() => (dragRef.current = null)}
                onPointerCancel={() => (dragRef.current = null)}
                onKeyDown={(e) => {
                  const step = e.shiftKey ? 30 : 8;
                  const delta = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
                  if (!editable || !delta) return;
                  e.preventDefault();
                  moveTo({ x: offset.x + delta[0], y: offset.y + delta[1] });
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- canvas needs the raw image; next/image would serve a resized proxy */}
                <img
                  ref={imgRef}
                  key={source}
                  src={source}
                  alt={`Preview of ${userName}'s photo`}
                  crossOrigin={source === existing && !corsBlocked ? "anonymous" : undefined}
                  draggable={false}
                  onLoad={(e) => setNatural({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
                  onError={() => source === existing && !corsBlocked && setCorsBlocked(true)}
                  className="absolute left-1/2 top-1/2 max-w-none"
                  style={
                    crop
                      ? {
                          width: natural!.w * (VIEWPORT / Math.min(natural!.w, natural!.h)) * zoom,
                          transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`,
                        }
                      : { opacity: 0 }
                  }
                />
              </div>

              {editable ? (
                <div className="flex w-full max-w-[260px] items-center gap-3">
                  <label htmlFor="avatar-zoom" className="text-xs text-muted-foreground">
                    Zoom
                  </label>
                  <input
                    id="avatar-zoom"
                    type="range"
                    min={1}
                    max={MAX_ZOOM}
                    step={0.01}
                    value={zoom}
                    onChange={(e) => {
                      const z = Number(e.target.value);
                      setZoom(z);
                      moveTo(offset, z);
                    }}
                    className="flex-1 accent-primary"
                  />
                  <Button type="button" variant="ghost" size="sm" onClick={resetPosition} disabled={!adjusted}>
                    <Crosshair className="mr-1.5 size-4" aria-hidden="true" />
                    Recenter
                  </Button>
                </div>
              ) : (
                <p className="text-center text-xs text-muted-foreground">
                  To reposition this photo, choose it again with “Choose File”.
                </p>
              )}
              {editable && <p className="text-xs text-muted-foreground">Drag to reposition · zoom to fit</p>}
            </div>
          ) : (
            <Avatar
              className={cn(
                "border-4 border-background",
                size === "sm" ? "size-24" : "size-32"
              )}
            >
              <AvatarFallback name={userName} variant={fallbackVariant} />
            </Avatar>
          )}

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
            onClick={() => {
              setOpen(false);
              handleCancel();
            }}
            disabled={isUploading}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleUpload}
            // A new photo, or the current one after moving it
            disabled={isUploading || !editable || !natural || (!selectedFile && !adjusted)}
          >
            {isUploading ? "Uploading..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
