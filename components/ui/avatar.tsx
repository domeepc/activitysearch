"use client"

import * as React from "react"
import * as AvatarPrimitive from "@radix-ui/react-avatar"
import BoringAvatar from "boring-avatars"

import { cn } from "@/lib/utils"

function Avatar({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Root>) {
  return (
    <AvatarPrimitive.Root
      data-slot="avatar"
      className={cn(
        "relative flex size-8 shrink-0 overflow-hidden rounded-full",
        className
      )}
      {...props}
    />
  )
}

// Clerk's generic placeholder (base64 of {"type":"default"...}); treat it as "no photo" so the generated avatar shows
const CLERK_PLACEHOLDER = "https://img.clerk.com/eyJ0eXBlIjoiZGVmYXVsdCI"

const AVATAR_COLORS = ["#1d4ed8", "#3b82f6", "#38bdf8", "#fbbf24", "#f97316"]

function AvatarImage({
  className,
  src,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Image>) {
  return (
    <AvatarPrimitive.Image
      data-slot="avatar-image"
      className={cn("aspect-square size-full object-cover", className)}
      src={typeof src === "string" && src.startsWith(CLERK_PLACEHOLDER) ? undefined : src}
      {...props}
    />
  )
}

function AvatarFallback({
  className,
  name,
  variant = "beam",
  children,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Fallback> & {
  /** Seed for a generated avatar (same name, same avatar everywhere); children are used without it */
  name?: string
  variant?: "beam" | "marble"
}) {
  return (
    <AvatarPrimitive.Fallback
      data-slot="avatar-fallback"
      className={cn(
        "flex size-full items-center justify-center rounded-full",
        !name && "bg-muted",
        className
      )}
      {...props}
    >
      {name ? (
        <BoringAvatar name={name} variant={variant} colors={AVATAR_COLORS} size="100%" square aria-hidden="true" />
      ) : (
        children
      )}
    </AvatarPrimitive.Fallback>
  )
}

export { Avatar, AvatarImage, AvatarFallback }
