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
    <section id="profile" aria-labelledby="profile-h" className="scroll-mt-24 rounded-2xl border border-border bg-white shadow-sm dark:bg-zinc-900">
      <div className="border-b border-border px-5 py-4 md:px-6">
        <h2 id="profile-h" className="text-[17px] font-semibold text-zinc-900 dark:text-zinc-50">Profile</h2>
        <p className="text-sm text-muted-foreground">How friends and teams see you.</p>
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
      <div className="flex justify-end gap-2 border-t border-border px-5 py-4 md:px-6">
        <Button variant="outline" className="rounded-xl" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={onSave} disabled={hasErrors} className="rounded-xl">
          Save changes
        </Button>
      </div>
    </section>
  );
}

