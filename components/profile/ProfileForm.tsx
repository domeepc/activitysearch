"use client";

import { Button } from "@/components/ui/button";
import { UserAvatarSection } from "./UserAvatarSection";
import { ProfileFormFields } from "./ProfileFormFields";
import type { ProfileFormData, ProfileErrors } from "@/lib/types/profile";

interface ProfileFormProps {
  formData: ProfileFormData;
  errors: ProfileErrors;
  usernameError: string;
  usernameAvailable?: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  onSave: () => void;
  onCancel: () => void;
  clerkUser?: {
    externalAccounts?: Array<{ provider: string }>;
  } | null;
  currentEmail?: string;
}

export function ProfileForm({
  formData,
  errors,
  usernameError,
  usernameAvailable,
  onChange,
  onSave,
  onCancel,
  clerkUser,
  currentEmail,
}: ProfileFormProps) {
  // Only consider email error if email has actually changed
  const emailChanged = currentEmail ? formData.email !== currentEmail : false;
  const hasEmailError = emailChanged && !!errors.email;
  const hasErrors =
    !!usernameError || !!errors.name || !!errors.lastname || hasEmailError;

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-zinc-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between md:px-6">
        <h2 className="text-lg font-semibold text-zinc-900">Edit Profile</h2>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" className="rounded-full border-zinc-200" onClick={onCancel}>
            Cancel
          </Button>
          <Button size="sm" onClick={onSave} disabled={hasErrors} className="rounded-full">
            Save Changes
          </Button>
        </div>
      </div>
      <div className="space-y-6 px-5 py-5 md:px-6 md:py-6">
        {/* Avatar */}
        <div className="flex justify-center">
          <UserAvatarSection
            currentAvatar={formData.avatar}
            userName={`${formData.name} ${formData.lastname}`}
            disabled={false}
          />
        </div>

        {/* Form Fields */}
        <ProfileFormFields
          formData={formData}
          errors={errors}
          usernameError={usernameError}
          usernameAvailable={usernameAvailable}
          onChange={onChange}
          clerkUser={clerkUser}
        />
      </div>
    </div>
  );
}

