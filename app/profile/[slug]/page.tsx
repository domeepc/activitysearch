"use client";

import React, { useState, useEffect, use, useRef } from "react";
import { useQuery, useAction, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAvatarSection } from "@/components/UserAvatarSection";
import { UserPlus, UserMinus, Mail, Check, Lock } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { validateProfileField } from "@/lib/validation";
import { extractErrorMessage } from "@/lib/errors";

export default function ProfilePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const resolvedParams = use(params);
  const router = useRouter();
  const { user: clerkUser } = useUser();
  const verificationEmailSentRef = useRef(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showRemoveDialog, setShowRemoveDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showVerifyEmailDialog, setShowVerifyEmailDialog] = useState(false);
  const [showUnlinkWarningDialog, setShowUnlinkWarningDialog] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [showPasswordRequiredDialog, setShowPasswordRequiredDialog] =
    useState(false);
  const [pendingUnlinkProvider, setPendingUnlinkProvider] = useState<
    "google" | "microsoft" | "facebook" | null
  >(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [settingPassword, setSettingPassword] = useState(false);
  const [oldEmailBeforeChange, setOldEmailBeforeChange] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [verificationError, setVerificationError] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);
  const [autoSendCooldown, setAutoSendCooldown] = useState(0);
  const [usernameError, setUsernameError] = useState("");
  const [errors, setErrors] = useState({
    name: "",
    lastname: "",
    email: "",
  });
  const [formData, setFormData] = useState({
    avatar: "",
    name: "",
    lastname: "",
    username: "",
    email: "",
    description: "",
    contact: "",
    exp: 0,
    friends: [] as Id<"users">[],
  });

  const user = useQuery(api.users.getUserBySlug, { slug: resolvedParams.slug });
  const currentUser = useQuery(api.users.current);
  const updateProfile = useAction(api.users.updateUserProfile);
  const addFriend = useMutation(api.users.addFriend);
  const removeFriend = useMutation(api.users.removeFriend);
  const deleteAccount = useAction(api.users.deleteAccount);
  const finalizeEmailChange = useAction(api.users.finalizeEmailChange);
  const unlinkOAuthProvider = useAction(api.users.unlinkOAuthProvider);
  const friends = useQuery(
    api.users.getUsersByIds,
    user?.friends && user.friends.length > 0
      ? { userIds: user.friends }
      : "skip"
  );
  const usernameCheckParams =
    isEditing && formData.username !== user?.username && formData.username
      ? { username: formData.username }
      : "skip";
  const checkUsernameExists = useQuery(
    api.users.checkUsernameExists,
    usernameCheckParams
  );

  const isOwnProfile = currentUser?._id === user?._id;
  const isFriend = currentUser?.friends.includes(user?._id as Id<"users">);

  useEffect(() => {
    if (user !== undefined && user !== null) {
      setFormData({
        avatar: user.avatar || "https://via.placeholder.com/128",
        name: user.name || "",
        lastname: user.lastname || "",
        username: user.username || "",
        email: user.email || "",
        description: user.description || "",
        contact: user.contact || "",
        exp: Number(user.totalExp || 0),
        friends: user.friends || [],
      });
    }
  }, [user]);

  useEffect(() => {
    if (checkUsernameExists === true) {
      setUsernameError("This username is already taken");
    } else if (
      checkUsernameExists === false &&
      formData.username !== user?.username
    ) {
      setUsernameError("");
    }
  }, [checkUsernameExists, formData.username, user?.username]);

  const validateField = (name: string, value: string) => {
    const error = validateProfileField(name, value);
    setErrors((prev) => ({ ...prev, [name]: error }));
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === "exp" ? parseInt(value) || 0 : value,
    }));

    if (name === "name" || name === "lastname" || name === "email") {
      validateField(name, value);
    }
  };

  const handleCancel = () => {
    if (user) {
      setFormData({
        avatar: user.avatar || "https://via.placeholder.com/128",
        name: user.name || "",
        lastname: user.lastname || "",
        username: user.username || "",
        email: user.email || "",
        description: user.description || "",
        contact: user.contact || "",
        exp: Number(user.totalExp || 0),
        friends: user.friends || [],
      });
    }
    setUsernameError("");
    setErrors({ name: "", lastname: "", email: "" });
    setIsEditing(false);
  };

  const handleSave = async () => {
    validateField("name", formData.name);
    validateField("lastname", formData.lastname);
    validateField("email", formData.email);

    if (usernameError || errors.name || errors.lastname || errors.email) {
      return;
    }

    // Store old email BEFORE updating
    const emailChanged = formData.email !== user?.email;
    setOldEmailBeforeChange(user?.email || "");

    try {
      await updateProfile({
        name: formData.name,
        lastname: formData.lastname,
        username: formData.username,
        email: formData.email,
        description: formData.description,
        contact: formData.contact,
      });
      setIsEditing(false);
      setUsernameError("");
      setErrors({ name: "", lastname: "", email: "" });

      // Refresh if username changed (slug might have changed)
      if (formData.username !== user?.username) {
        setTimeout(() => window.location.reload(), 500);
      }

      // Show verification dialog if email changed
      if (emailChanged && clerkUser) {
        setOldEmailBeforeChange(oldEmailBeforeChange);
        // Wait longer for backend to create the email, then reload and show dialog
        setTimeout(async () => {
          try {
            await clerkUser.reload();
            setShowVerifyEmailDialog(true);
          } catch (error) {
            console.error("Failed to reload user:", error);
            setErrors({
              ...errors,
              email: "Failed to update email. Please try again.",
            });
          }
        }, 2500);
      }
    } catch (error: unknown) {
      console.error("Failed to update user:", error);
      const errorMessage = extractErrorMessage(error);

      // Check for specific email errors
      if (
        errorMessage.toLowerCase().includes("email") &&
        (errorMessage.toLowerCase().includes("exists") ||
          errorMessage.toLowerCase().includes("already") ||
          errorMessage.toLowerCase().includes("taken"))
      ) {
        setErrors({ ...errors, email: "This email address is already in use" });
      } else {
        setErrors({ ...errors, email: errorMessage });
      }
    }
  };

  const handleAddFriend = async () => {
    if (!user?._id) return;
    try {
      await addFriend({ friendId: user._id });
    } catch (error) {
      console.error("Failed to add friend:", error);
    }
  };

  const handleRemoveFriend = async () => {
    if (!user?._id) return;
    try {
      await removeFriend({ friendId: user._id });
      setShowRemoveDialog(false);
    } catch (error) {
      console.error("Failed to remove friend:", error);
    }
  };

  const handleDeleteAccount = async () => {
    try {
      await deleteAccount({});
      setShowDeleteDialog(false);
      // The useEffect will handle the redirect once currentUser becomes null
    } catch (error) {
      console.error("Failed to delete account:", error);
    }
  };

  const handleVerifyEmail = async () => {
    if (!clerkUser) return;

    setVerifying(true);
    setVerificationError("");

    try {
      // Reload user to get latest state
      await clerkUser.reload();

      // Find the unverified email address
      const unverifiedEmail = clerkUser.emailAddresses.find(
        (email) => email.verification?.status !== "verified"
      );

      if (!unverifiedEmail) {
        setVerificationError("No email address to verify");
        setVerifying(false);
        return;
      }

      // Attempt to verify the email with the code
      await unverifiedEmail.attemptVerification({
        code: verificationCode,
      });

      // Reload user again to get the verified status
      await clerkUser.reload();

      // Find all emails that are NOT the one we just verified
      // These are the old emails that should be deleted
      const emailsToDelete = clerkUser.emailAddresses
        .filter((email) => email.id !== unverifiedEmail.id)
        .map((email) => email.emailAddress);

      // Make new email primary and delete old emails
      await finalizeEmailChange({
        newEmailId: unverifiedEmail.id,
        oldEmail: emailsToDelete[0] || "", // Take the first old email
      });

      setShowVerifyEmailDialog(false);
      setVerificationCode("");

      // Reload the page to update the profile - this will update the verified badge
      window.location.reload();
    } catch (error: unknown) {
      setVerificationError(extractErrorMessage(error));
    } finally {
      setVerifying(false);
    }
  };

  const handleResendVerificationEmail = async () => {
    if (!clerkUser || resendCooldown > 0) return;

    try {
      await clerkUser.reload();
      const unverifiedEmail = clerkUser.emailAddresses.find(
        (email) => email.verification?.status !== "verified"
      );

      if (unverifiedEmail) {
        await unverifiedEmail.prepareVerification({ strategy: "email_code" });
        setVerificationError("");
        setResendCooldown(60); // 60 second cooldown
      } else {
        setVerificationError("No unverified email found");
      }
    } catch (error) {
      console.error("Failed to resend verification email:", error);
      setVerificationError(
        "Failed to resend verification email. Please try again."
      );
    }
  };
  const handleUnlinkOAuth = async (
    provider: "google" | "microsoft" | "facebook"
  ) => {
    // Show warning dialog for Google accounts (cannot be unlinked)
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

  const handleSetPassword = async () => {
    setPasswordError("");

    if (!newPassword || !confirmPassword) {
      setPasswordError("Please fill in all fields");
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError("Password must be at least 8 characters long");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match");
      return;
    }

    setSettingPassword(true);

    try {
      const hasPassword = clerkUser?.passwordEnabled;

      if (hasPassword) {
        // User already has a password, change it
        if (!currentPassword) {
          setPasswordError("Please enter your current password");
          setSettingPassword(false);
          return;
        }
        await clerkUser?.updatePassword({
          currentPassword,
          newPassword,
        });
      } else {
        // User doesn't have a password, create one
        await clerkUser?.updatePassword({
          newPassword,
        });
      }

      await clerkUser?.reload();
      setShowPasswordDialog(false);
      setNewPassword("");
      setConfirmPassword("");
      setCurrentPassword("");
      setPasswordError("");

      // If there's a pending unlink, show the password required dialog again
      if (pendingUnlinkProvider) {
        // Now that password is set, attempt to unlink
        try {
          await unlinkOAuthProvider({ provider: pendingUnlinkProvider });
          await clerkUser?.reload();
          setTimeout(() => window.location.reload(), 500);
        } catch (error) {
          console.error(`Failed to unlink ${pendingUnlinkProvider}:`, error);
        }
        setPendingUnlinkProvider(null);
        setShowPasswordRequiredDialog(false);
      }
    } catch (error: unknown) {
      console.error("Failed to set/update password:", error);
      setPasswordError(extractErrorMessage(error));
    } finally {
      setSettingPassword(false);
    }
  };

  const getEmailVerificationStatus = () => {
    if (!clerkUser) return null;
    // Find the email that matches the current email in formData
    const currentEmail = clerkUser.emailAddresses.find(
      (email) => email.emailAddress === formData.email
    );
    // Also check if this is the primary email
    const isPrimary = currentEmail?.id === clerkUser.primaryEmailAddressId;
    // Check if email exists and has a verification object with verified status
    if (!currentEmail?.verification) return false;
    return currentEmail.verification.status === "verified" && isPrimary;
  };
  // Cooldown timer for resend button
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => {
        setResendCooldown(resendCooldown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  // Cooldown timer for auto-send on dialog open (5 minutes)
  useEffect(() => {
    if (autoSendCooldown > 0) {
      const timer = setTimeout(() => {
        setAutoSendCooldown(autoSendCooldown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [autoSendCooldown]);

  // Send verification email when dialog opens (only if no cooldown)
  useEffect(() => {
    if (
      showVerifyEmailDialog &&
      clerkUser &&
      !verificationEmailSentRef.current &&
      autoSendCooldown === 0
    ) {
      verificationEmailSentRef.current = true;

      const sendVerificationEmail = async () => {
        try {
          await clerkUser.reload();
          const unverifiedEmail = clerkUser.emailAddresses.find(
            (email) => email.verification?.status !== "verified"
          );

          if (unverifiedEmail) {
            await unverifiedEmail.prepareVerification({
              strategy: "email_code",
            });
            setAutoSendCooldown(300); // 5 minutes cooldown for auto-send
          } else {
            setVerificationError(
              "No unverified email address found. Please try again."
            );
          }
        } catch (error) {
          console.error("Failed to send verification email:", error);
          setVerificationError(
            "Failed to send verification email. Please try resending."
          );
        }
      };

      sendVerificationEmail();
    }

    // Reset the ref when dialog closes
    if (!showVerifyEmailDialog) {
      verificationEmailSentRef.current = false;
    }
  }, [showVerifyEmailDialog, clerkUser, autoSendCooldown]);

  // Redirect to sign-in if not authenticated or user not found
  useEffect(() => {
    if (currentUser === null || user === null) {
      window.location.replace("/sign-in");
    }
  }, [currentUser, user]);

  if (user === undefined || currentUser === undefined) {
    return (
      <div className="container mx-auto p-6 max-w-4xl">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="space-y-2">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-4 w-32" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-10 w-24" />
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Avatar skeleton */}
            <div className="flex justify-center">
              <Skeleton className="h-32 w-32 rounded-full" />
            </div>

            {/* Form fields skeletons */}
            <div className="grid gap-6">
              <div className="space-y-2">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-10 w-full" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-10 w-full" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-10 w-full" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-10 w-full" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-24 w-full" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-20" />
                <div className="flex flex-wrap gap-2">
                  <Skeleton className="h-6 w-16" />
                  <Skeleton className="h-6 w-20" />
                  <Skeleton className="h-6 w-24" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (user === null || currentUser === null) {
    return (
      <div className="container mx-auto p-6 max-w-4xl">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="space-y-2">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-4 w-32" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-10 w-24" />
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Avatar skeleton */}
            <div className="flex justify-center">
              <Skeleton className="h-32 w-32 rounded-full" />
            </div>

            {/* Form fields skeletons */}
            <div className="grid gap-6">
              <div className="space-y-2">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-10 w-full" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-10 w-full" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-10 w-full" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-10 w-full" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-24 w-full" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-20" />
                <div className="flex flex-wrap gap-2">
                  <Skeleton className="h-6 w-16" />
                  <Skeleton className="h-6 w-20" />
                  <Skeleton className="h-6 w-24" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-4xl">
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
            <div>
              <CardTitle>
                {isOwnProfile ? "Profile" : `${formData.name}'s Profile`}
              </CardTitle>
              <CardDescription>
                {isOwnProfile
                  ? "Manage your profile information"
                  : `@${formData.username}`}
              </CardDescription>
            </div>
            <div className="flex gap-2 flex-wrap">
              {isOwnProfile ? (
                isEditing ? (
                  <>
                    <Button variant="outline" onClick={handleCancel}>
                      Cancel
                    </Button>
                    <Button
                      onClick={handleSave}
                      disabled={
                        usernameError ||
                        errors.name ||
                        errors.lastname ||
                        errors.email
                          ? true
                          : false
                      }
                    >
                      Save Changes
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      variant="destructive"
                      onClick={() => setShowDeleteDialog(true)}
                      className="w-full md:w-auto"
                    >
                      Delete Account
                    </Button>
                    <Button
                      onClick={() => setIsEditing(true)}
                      className="w-full md:w-auto"
                    >
                      Edit Profile
                    </Button>
                  </>
                )
              ) : (
                <>
                  {isFriend ? (
                    <Button
                      variant="outline"
                      onClick={() => setShowRemoveDialog(true)}
                      className="w-full md:w-auto"
                    >
                      <UserMinus className="h-4 w-4 mr-2" />
                      Remove Friend
                    </Button>
                  ) : (
                    <Button
                      onClick={handleAddFriend}
                      className="w-full md:w-auto"
                    >
                      <UserPlus className="h-4 w-4 mr-2" />
                      Add Friend
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Avatar */}
          <div className="flex justify-center">
            <UserAvatarSection
              currentAvatar={formData.avatar}
              userName={`${formData.name} ${formData.lastname}`}
              disabled={!isEditing || !isOwnProfile}
            />
          </div>

          {/* Form Fields */}
          <div className="grid gap-6">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              {user === undefined ? (
                <Skeleton className="h-5 w-48" />
              ) : isEditing && isOwnProfile ? (
                <>
                  <Input
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    aria-invalid={!!errors.name}
                  />
                  {errors.name && (
                    <p className="text-sm font-medium text-destructive">
                      {errors.name}
                    </p>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">{formData.name}</p>
              )}
            </div>

            {/* Last Name */}
            <div className="space-y-2">
              <Label htmlFor="lastname">Last Name</Label>
              {user === undefined ? (
                <Skeleton className="h-5 w-48" />
              ) : isEditing && isOwnProfile ? (
                <>
                  <Input
                    id="lastname"
                    name="lastname"
                    value={formData.lastname}
                    onChange={handleChange}
                    aria-invalid={!!errors.lastname}
                  />
                  {errors.lastname && (
                    <p className="text-sm font-medium text-destructive">
                      {errors.lastname}
                    </p>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {formData.lastname}
                </p>
              )}
            </div>

            {/* Username - Only show for own profile */}
            {isOwnProfile && (
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                {isEditing ? (
                  <>
                    <Input
                      id="username"
                      name="username"
                      value={formData.username}
                      onChange={handleChange}
                      aria-invalid={!!usernameError}
                    />
                    {usernameError && (
                      <p className="text-sm font-medium text-destructive">
                        {usernameError}
                      </p>
                    )}
                    {!usernameError &&
                      formData.username !== user?.username &&
                      checkUsernameExists === false && (
                        <p className="text-sm font-medium text-green-600">
                          Username is available
                        </p>
                      )}
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    @{formData.username}
                  </p>
                )}
              </div>
            )}

            {/* Email - Only show for own profile */}
            {isOwnProfile && (
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                {isEditing ? (
                  <>
                    <Input
                      id="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      aria-invalid={!!errors.email}
                      disabled={
                        clerkUser?.externalAccounts &&
                        clerkUser.externalAccounts.length > 0
                      }
                    />
                    {clerkUser?.externalAccounts &&
                      clerkUser.externalAccounts.length > 0 && (
                        <p className="text-xs text-amber-400">
                          Email cannot be changed while OAuth accounts are
                          linked. Please unlink your OAuth providers first.
                        </p>
                      )}
                    {errors.email && (
                      <p className="text-sm font-medium text-destructive">
                        {errors.email}
                      </p>
                    )}
                  </>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <p className="text-sm text-muted-foreground">
                        {formData.email}
                      </p>
                      {getEmailVerificationStatus() === true ? (
                        <Badge
                          variant="default"
                          className="flex items-center gap-1"
                        >
                          <Check className="h-3 w-3" />
                          Verified
                        </Badge>
                      ) : getEmailVerificationStatus() === false ? (
                        <Badge
                          variant="outline"
                          className="flex items-center gap-1 cursor-pointer hover:bg-accent"
                          onClick={() => setShowVerifyEmailDialog(true)}
                        >
                          <Mail className="h-3 w-3" />
                          Not Verified - Click to Verify
                        </Badge>
                      ) : null}
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Verify your email to unlock all features and ensure
                        account security.
                      </p>
                    </div>
                    {/* OAuth Provider Links */}
                    {clerkUser?.externalAccounts &&
                      clerkUser.externalAccounts.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-xs text-muted-foreground">
                            Linked accounts:
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {clerkUser.externalAccounts.map((account) => (
                              <Badge
                                key={account.id}
                                variant="secondary"
                                className="flex items-center gap-2"
                              >
                                {account.provider}
                                <button
                                  onClick={() =>
                                    handleUnlinkOAuth(
                                      account.provider as
                                        | "google"
                                        | "microsoft"
                                        | "facebook"
                                    )
                                  }
                                  className="hover:text-destructive"
                                  title={`Unlink ${account.provider}`}
                                >
                                  ×
                                </button>
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    {/* Password Section */}
                    <div className="space-y-2 pt-2">
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-muted-foreground">
                          Password:
                        </p>
                        <Badge
                          variant={
                            clerkUser?.passwordEnabled ? "default" : "outline"
                          }
                          className="flex items-center gap-1"
                        >
                          <Lock className="h-3 w-3" />
                          {clerkUser?.passwordEnabled ? "Set" : "Not Set"}
                        </Badge>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowPasswordDialog(true)}
                        className="w-full"
                      >
                        {clerkUser?.passwordEnabled
                          ? "Change Password"
                          : "Set Password"}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">
                {isOwnProfile ? "Description" : "About"}
              </Label>
              {user === undefined ? (
                <Skeleton className="h-24 w-full" />
              ) : isEditing && isOwnProfile ? (
                <Textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  rows={4}
                  className="resize-none"
                />
              ) : (
                <p className="text-sm text-muted-foreground">
                  {formData.description || "No description provided"}
                </p>
              )}
            </div>

            {/* Contact - Only show for own profile or if provided */}
            {(isOwnProfile || formData.contact) && (
              <div className="space-y-2">
                <Label htmlFor="contact">Contact</Label>
                {isEditing && isOwnProfile ? (
                  <Input
                    id="contact"
                    name="contact"
                    value={formData.contact}
                    onChange={handleChange}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {formData.contact || "No contact information"}
                  </p>
                )}
              </div>
            )}

            {/* Experience Points */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Experience Points</Label>
                {user === undefined ? (
                  <Skeleton className="h-4 w-24" />
                ) : (
                  <span className="text-sm font-medium text-muted-foreground">
                    {formData.exp} / 1000 XP
                  </span>
                )}
              </div>
              {user === undefined ? (
                <Skeleton className="h-3 w-full" />
              ) : (
                <>
                  <Progress
                    value={(formData.exp / 1000) * 100}
                    className="h-3"
                  />
                  <p className="text-xs text-muted-foreground">
                    {Math.round((formData.exp / 1000) * 100)}% to next level
                  </p>
                </>
              )}
            </div>

            {/* Friends */}
            <div className="space-y-2 flex justify-between items-end">
              <div className="space-y-2">
                <Label>
                  Friends ({friends?.length ?? formData.friends.length})
                </Label>
                {formData.friends.length > 0 && friends === undefined ? (
                  <div className="flex flex-wrap gap-2">
                    <Skeleton className="h-6 w-24" />
                    <Skeleton className="h-6 w-28" />
                    <Skeleton className="h-6 w-20" />
                  </div>
                ) : formData.friends.length > 0 && friends ? (
                  <div className="flex flex-wrap gap-2">
                    {friends.map((friend) => (
                      <Badge
                        key={friend._id}
                        variant="outline"
                        className="cursor-pointer hover:bg-accent"
                        onClick={() => router.push(`/profile/${friend.slug}`)}
                      >
                        @{friend.username}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No friends yet
                  </p>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Remove Friend Confirmation Dialog */}
      <Dialog open={showRemoveDialog} onOpenChange={setShowRemoveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Friend</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove {formData.name}{" "}
              {formData.lastname} from your friends list?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowRemoveDialog(false)}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleRemoveFriend}>
              Remove Friend
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Account Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Account</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete your account? This action cannot
              be undone. All your data, including your profile, friends, and
              activity history will be permanently deleted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteAccount}>
              Delete Account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Password Required Dialog */}
      <Dialog
        open={showPasswordRequiredDialog}
        onOpenChange={(open) => {
          setShowPasswordRequiredDialog(open);
          if (!open) setPendingUnlinkProvider(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Password Required</DialogTitle>
            <DialogDescription>
              To unlink OAuth providers, you must first set a password for your
              account. This ensures you can still sign in after removing OAuth
              providers.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowPasswordRequiredDialog(false);
                setPendingUnlinkProvider(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                setShowPasswordRequiredDialog(false);
                setShowPasswordDialog(true);
              }}
            >
              Set Password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Set/Change Password Dialog */}
      <Dialog
        open={showPasswordDialog}
        onOpenChange={(open) => {
          setShowPasswordDialog(open);
          if (!open) {
            setNewPassword("");
            setConfirmPassword("");
            setCurrentPassword("");
            setPasswordError("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              {clerkUser?.passwordEnabled ? "Change Password" : "Set Password"}
            </DialogTitle>
            <DialogDescription>
              {clerkUser?.passwordEnabled
                ? "Enter your current password and choose a new one."
                : "Set a password to secure your account and enable OAuth unlinking."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {clerkUser?.passwordEnabled && (
              <div className="space-y-2">
                <Label htmlFor="current-password">Current Password</Label>
                <Input
                  id="current-password"
                  name="current-password"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                name="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password (min. 8 characters)"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm Password</Label>
              <Input
                id="confirm-password"
                name="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
              />
            </div>
            {passwordError && (
              <p className="text-sm font-medium text-destructive">
                {passwordError}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowPasswordDialog(false);
                setNewPassword("");
                setConfirmPassword("");
                setCurrentPassword("");
                setPasswordError("");
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleSetPassword} disabled={settingPassword}>
              {settingPassword
                ? "Setting..."
                : clerkUser?.passwordEnabled
                ? "Change Password"
                : "Set Password"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Unlink Warning Dialog */}
      <Dialog
        open={showUnlinkWarningDialog}
        onOpenChange={setShowUnlinkWarningDialog}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cannot Unlink Google Account</DialogTitle>
            <DialogDescription>
              Google email accounts cannot be removed through the interface due
              to Google&apos;s security policies. If you need to unlink your
              Google account, please contact us at support@activitysearch.com
              for assistance.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setShowUnlinkWarningDialog(false)}>
              OK
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Email Verification Dialog */}
      <Dialog
        open={showVerifyEmailDialog}
        onOpenChange={setShowVerifyEmailDialog}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Verify Your Email
            </DialogTitle>
            <DialogDescription>
              We&apos;ve sent a verification code to your new email address.
              Please enter the code below to verify your email.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="verification-code">Verification Code</Label>
              <div className="flex justify-center">
                <InputOTP
                  maxLength={6}
                  value={verificationCode}
                  onChange={(value) => setVerificationCode(value)}
                >
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
              </div>
              {verificationError && (
                <p className="text-sm font-medium text-destructive text-center">
                  {verificationError}
                </p>
              )}
            </div>
            <Button
              variant="outline"
              className="w-full"
              onClick={handleResendVerificationEmail}
              disabled={resendCooldown > 0}
            >
              {resendCooldown > 0
                ? `Resend Code (${resendCooldown}s)`
                : "Resend Code"}
            </Button>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowVerifyEmailDialog(false);
                setVerificationCode("");
                setVerificationError("");
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleVerifyEmail}
              disabled={verifying || verificationCode.length !== 6}
            >
              {verifying ? "Verifying..." : "Verify Email"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
