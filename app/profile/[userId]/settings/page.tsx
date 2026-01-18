"use client";

import { useEffect, useState, use } from "react";
import { useQuery, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ProfileForm } from "@/components/profile/ProfileForm";
import { EmailVerificationSection } from "@/components/profile/EmailVerificationSection";
import { PasswordSection } from "@/components/profile/PasswordSection";
import { OAuthProvidersSection } from "@/components/profile/OAuthProvidersSection";
import { DeleteAccountDialog } from "@/components/profile/dialogs/DeleteAccountDialog";
import { EmailVerificationDialog } from "@/components/profile/dialogs/EmailVerificationDialog";
import { PasswordDialog } from "@/components/profile/dialogs/PasswordDialog";
import { PasswordRequiredDialog } from "@/components/profile/dialogs/PasswordRequiredDialog";
import { UnlinkOAuthWarningDialog } from "@/components/profile/dialogs/UnlinkOAuthWarningDialog";
import { useProfileForm } from "@/lib/hooks/useProfileForm";
import { useEmailVerification } from "@/lib/hooks/useEmailVerification";
import { usePasswordManagement } from "@/lib/hooks/usePasswordManagement";
import type { OAuthProvider } from "@/lib/types/profile";

// Convex document IDs are 32 base-32 chars; treat other segments as username
function looksLikeConvexId(s: string): boolean {
  return /^[a-z0-9]{32}$/.test(s);
}

export default function ProfileSettingsPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const resolvedParams = use(params);
  const router = useRouter();
  const { user: clerkUser } = useUser();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showUnlinkWarningDialog, setShowUnlinkWarningDialog] = useState(false);

  const byId = useQuery(
    api.users.getUserById,
    looksLikeConvexId(resolvedParams.userId)
      ? { userId: resolvedParams.userId as Id<"users"> }
      : "skip"
  );
  const byUsername = useQuery(
    api.users.getUserByUsername,
    !looksLikeConvexId(resolvedParams.userId)
      ? { username: resolvedParams.userId }
      : "skip"
  );
  const user = byId ?? byUsername;
  const currentUser = useQuery(api.users.current);
  const deleteAccount = useAction(api.users.deleteAccount);
  const unlinkOAuthProvider = useAction(api.users.unlinkOAuthProvider);

  const {
    formData,
    errors,
    usernameError,
    handleChange,
    resetForm,
    handleSave,
  } = useProfileForm({ user, isEditing: true });

  // Get current email from user or clerkUser for display
  const currentEmail =
    user?.email || clerkUser?.primaryEmailAddress?.emailAddress || "";

  const {
    verificationCode,
    setVerificationCode,
    verifying,
    verificationError,
    resendCooldown,
    showDialog: showEmailDialog,
    setShowDialog: setShowEmailDialog,
    handleVerifyEmail,
    handleResendVerificationEmail,
    getEmailVerificationStatus,
  } = useEmailVerification(currentEmail);

  const {
    newPassword,
    setNewPassword,
    confirmPassword,
    setConfirmPassword,
    currentPassword,
    setCurrentPassword,
    passwordError,
    settingPassword,
    showDialog: showPasswordDialog,
    setShowDialog: setShowPasswordDialog,
    showPasswordRequiredDialog,
    setShowPasswordRequiredDialog,
    setPendingUnlinkProvider,
    handleSetPassword,
    resetPasswordForm,
  } = usePasswordManagement();

  const isOwnProfile = currentUser?._id === user?._id;

  // Redirect if not own profile or not authenticated
  useEffect(() => {
    if (currentUser === null || user === null) {
      window.location.replace("/sign-in");
      return;
    }
    if (!isOwnProfile && user) {
      router.push(`/profile/${user._id}`);
    }
  }, [currentUser, user, isOwnProfile, router]);

  // Canonicalize URL when resolved by username (e.g. /profile/domepc/settings -> /profile/<id>/settings)
  useEffect(() => {
    if (user && isOwnProfile && resolvedParams.userId !== user._id) {
      router.replace(`/profile/${user._id}/settings`);
    }
  }, [user, isOwnProfile, resolvedParams.userId, router]);

  const handleSaveProfile = async () => {
    const result = await handleSave();
    if (result?.success) {
      if (result.emailChanged && result.newEmail && clerkUser) {
        // Wait for backend to create the email in Clerk, then reload and show verification dialog
        setTimeout(() => {
          clerkUser
            .reload()
            .then(() => {
              setShowEmailDialog(true);
            })
            .catch((error) => {
              console.error("Failed to reload user:", error);
            });
        }, 2500);
        // Don't reload page yet - wait for email verification
        return;
      }
      // Refresh if username changed
      if (formData.username !== user?.username) {
        setTimeout(() => router.refresh(), 500);
        return;
      }
      // Reload to show updated data (use canonical ID URL)
      router.push(`/profile/${user!._id}`);
    }
  };

  const handleCancelEdit = () => {
    resetForm();
    // Redirect back to profile view (use canonical ID URL)
    router.push(`/profile/${user!._id}`);
  };

  const handleDeleteAccount = async () => {
    try {
      await deleteAccount({});
      setShowDeleteDialog(false);
    } catch (error) {
      console.error("Failed to delete account:", error);
    }
  };

  const handleUnlinkOAuth = async (provider: OAuthProvider) => {
    // Show warning dialog for Google accounts
    if (provider === "google") {
      setShowUnlinkWarningDialog(true);
      return;
    }

    // Check if user has a password set
    const hasPassword = clerkUser?.passwordEnabled;
    if (!hasPassword) {
      setPendingUnlinkProvider(provider);
      setShowPasswordRequiredDialog(true);
      return;
    }

    try {
      await unlinkOAuthProvider({ provider });
      await clerkUser?.reload();
      setTimeout(() => window.location.reload(), 500);
    } catch (error) {
      console.error(`Failed to unlink ${provider}:`, error);
    }
  };

  const handlePasswordRequiredSetPassword = () => {
    setShowPasswordRequiredDialog(false);
    setShowPasswordDialog(true);
  };

  const handlePasswordRequiredCancel = () => {
    setShowPasswordRequiredDialog(false);
    setPendingUnlinkProvider(null);
  };

  // Loading state
  if (user === undefined || currentUser === undefined) {
    return (
      <div className="container mx-auto p-4 md:p-6 max-w-4xl">
        <Card className="border-border border-2 shadow-xl">
          <CardHeader>
            <Skeleton className="h-8 w-48" />
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex justify-center">
              <Skeleton className="h-32 w-32 rounded-full" />
            </div>
            <div className="grid gap-6">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Not found or not own profile - redirect handled in useEffect
  if (user === null || currentUser === null || !isOwnProfile) {
    return null;
  }

  const usernameAvailable =
    !usernameError &&
    formData.username !== user?.username &&
    formData.username.length > 0;

  const verificationStatus = getEmailVerificationStatus();

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-4xl">
      <ProfileForm
        formData={formData}
        errors={errors}
        usernameError={usernameError}
        usernameAvailable={usernameAvailable}
        onChange={handleChange}
        onSave={handleSaveProfile}
        onCancel={handleCancelEdit}
        clerkUser={clerkUser || undefined}
        currentEmail={currentEmail}
      />

      {/* Account Settings Section */}
      <Card className="mt-6 border-border border-2 shadow-xl">
        <CardHeader>
          <CardTitle>Account Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Email Section */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Email</label>
            <EmailVerificationSection
              email={currentEmail}
              verificationStatus={verificationStatus}
              onVerifyClick={() => setShowEmailDialog(true)}
            />
            {clerkUser?.externalAccounts &&
              clerkUser.externalAccounts.length > 0 && (
                <OAuthProvidersSection
                  externalAccounts={clerkUser.externalAccounts}
                  onUnlink={handleUnlinkOAuth}
                />
              )}
          </div>

          {/* Password Section */}
          <PasswordSection
            hasPassword={clerkUser?.passwordEnabled || false}
            onSetPassword={() => setShowPasswordDialog(true)}
          />

          {/* Delete Account Section */}
          <div className="pt-4 border-t">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Delete Account</p>
                <p className="text-xs text-muted-foreground">
                  Permanently delete your account and all associated data
                </p>
              </div>
              <Button
                variant="destructive"
                onClick={() => setShowDeleteDialog(true)}
                className="cursor-pointer"
              >
                Delete Account
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dialogs */}
      <DeleteAccountDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        onConfirm={handleDeleteAccount}
      />

      <EmailVerificationDialog
        open={showEmailDialog}
        onOpenChange={setShowEmailDialog}
        verificationCode={verificationCode}
        onVerificationCodeChange={setVerificationCode}
        verifying={verifying}
        verificationError={verificationError}
        resendCooldown={resendCooldown}
        onVerify={handleVerifyEmail}
        onResend={handleResendVerificationEmail}
      />

      <PasswordDialog
        open={showPasswordDialog}
        onOpenChange={setShowPasswordDialog}
        currentPassword={currentPassword}
        onCurrentPasswordChange={setCurrentPassword}
        newPassword={newPassword}
        onNewPasswordChange={setNewPassword}
        confirmPassword={confirmPassword}
        onConfirmPasswordChange={setConfirmPassword}
        passwordError={passwordError}
        settingPassword={settingPassword}
        hasPassword={clerkUser?.passwordEnabled || false}
        onConfirm={handleSetPassword}
        onCancel={resetPasswordForm}
      />

      <PasswordRequiredDialog 
        open={showPasswordRequiredDialog}
        onOpenChange={setShowPasswordRequiredDialog}
        onSetPassword={handlePasswordRequiredSetPassword}
        onCancel={handlePasswordRequiredCancel}
      />

      <UnlinkOAuthWarningDialog
        open={showUnlinkWarningDialog}
        onOpenChange={setShowUnlinkWarningDialog}
      />
    </div>
  );
}
