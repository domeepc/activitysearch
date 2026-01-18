"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    <Card className="border-border border-2 shadow-xl">
      <CardHeader>
        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
          <div>
            <CardTitle>Edit Profile</CardTitle>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button onClick={onSave} disabled={hasErrors}>
              Save Changes
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
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
      </CardContent>
    </Card>
  );
}

