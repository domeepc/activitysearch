"use client";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { ProfileFormData, ProfileErrors } from "@/lib/types/profile";

interface ProfileFormFieldsProps {
  formData: ProfileFormData;
  errors: ProfileErrors;
  usernameError: string;
  usernameAvailable?: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  clerkUser?: {
    externalAccounts?: Array<{ provider: string }>;
  } | null;
}

export function ProfileFormFields({
  formData,
  errors,
  usernameError,
  usernameAvailable,
  onChange,
  clerkUser,
}: ProfileFormFieldsProps) {
  const hasOAuthAccounts =
    clerkUser?.externalAccounts && clerkUser.externalAccounts.length > 0;

  return (
    <div className="grid gap-6">
      {/* Name */}
      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          name="name"
          value={formData.name}
          onChange={onChange}
          aria-invalid={!!errors.name}
        />
        {errors.name && (
          <p className="text-sm font-medium text-destructive">{errors.name}</p>
        )}
      </div>

      {/* Last Name */}
      <div className="space-y-2">
        <Label htmlFor="lastname">Last Name</Label>
        <Input
          id="lastname"
          name="lastname"
          value={formData.lastname}
          onChange={onChange}
          aria-invalid={!!errors.lastname}
        />
        {errors.lastname && (
          <p className="text-sm font-medium text-destructive">
            {errors.lastname}
          </p>
        )}
      </div>

      {/* Username */}
      <div className="space-y-2">
        <Label htmlFor="username">Username</Label>
        <Input
          id="username"
          name="username"
          value={formData.username}
          onChange={onChange}
          aria-invalid={!!usernameError}
        />
        {usernameError && (
          <p className="text-sm font-medium text-destructive">
            {usernameError}
          </p>
        )}
        {!usernameError && usernameAvailable && (
          <p className="text-sm font-medium text-green-600">
            Username is available
          </p>
        )}
      </div>

      {/* Email */}
      <div className="space-y-2">
        <Label htmlFor="email">New Email (leave unchanged to keep current email)</Label>
        <Input
          id="email"
          name="email"
          value={formData.email}
          onChange={onChange}
          placeholder="Enter new email address"
          aria-invalid={!!errors.email}
          disabled={hasOAuthAccounts}
        />
        {hasOAuthAccounts && (
          <p className="text-xs text-amber-400">
            Email cannot be changed while OAuth accounts are linked. Please
            unlink your OAuth providers first.
          </p>
        )}
        {errors.email && (
          <p className="text-sm font-medium text-destructive">{errors.email}</p>
        )}
        <p className="text-xs text-muted-foreground">
          Your current email is shown in Account Settings below. Enter a new email here to change it.
        </p>
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          name="description"
          value={formData.description}
          onChange={onChange}
          rows={4}
          className="resize-none"
        />
      </div>

      {/* Contact */}
      <div className="space-y-2">
        <Label htmlFor="contact">Contact</Label>
        <Input
          id="contact"
          name="contact"
          value={formData.contact}
          onChange={onChange}
        />
      </div>
    </div>
  );
}

