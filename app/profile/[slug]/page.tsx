"use client";

import React, { useState, useEffect, use } from "react";
import { useQuery, useAction, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useRouter } from "next/navigation";
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
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { UserAvatarSection } from "@/components/UserAvatarSection";
import { UserPlus, UserMinus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function ProfilePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const resolvedParams = use(params);
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [showRemoveDialog, setShowRemoveDialog] = useState(false);
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
    const newErrors = { ...errors };

    if (name === "name" && !value.trim()) {
      newErrors.name = "Name is required";
    } else if (name === "name") {
      newErrors.name = "";
    }

    if (name === "lastname" && !value.trim()) {
      newErrors.lastname = "Last name is required";
    } else if (name === "lastname") {
      newErrors.lastname = "";
    }

    if (name === "email") {
      if (!value.trim()) {
        newErrors.email = "Email is required";
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        newErrors.email = "Please enter a valid email";
      } else {
        newErrors.email = "";
      }
    }

    setErrors(newErrors);
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
    } catch (error) {
      console.error("Failed to update user:", error);
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

  if (user === undefined) {
    return (
      <div className="container mx-auto p-6 max-w-4xl">
        <Card>
          <CardContent className="flex items-center justify-center py-8">
            <p className="text-muted-foreground">Loading profile...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (user === null) {
    return (
      <div className="container mx-auto p-6 max-w-4xl">
        <Card>
          <CardContent className="flex items-center justify-center py-8">
            <p className="text-muted-foreground">User not found</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
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
            <div className="flex gap-2">
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
                  <Button onClick={() => setIsEditing(true)}>
                    Edit Profile
                  </Button>
                )
              ) : (
                <>
                  {isFriend ? (
                    <Button
                      variant="outline"
                      onClick={() => setShowRemoveDialog(true)}
                    >
                      <UserMinus className="h-4 w-4 mr-2" />
                      Remove Friend
                    </Button>
                  ) : (
                    <Button onClick={handleAddFriend}>
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
              {isEditing && isOwnProfile ? (
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
              {isEditing && isOwnProfile ? (
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
                    />
                    {errors.email && (
                      <p className="text-sm font-medium text-destructive">
                        {errors.email}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {formData.email}
                  </p>
                )}
              </div>
            )}

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">
                {isOwnProfile ? "Description" : "About"}
              </Label>
              {isEditing && isOwnProfile ? (
                <Textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  rows={4}
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
                <span className="text-sm font-medium text-muted-foreground">
                  {formData.exp} / 1000 XP
                </span>
              </div>
              <Progress value={(formData.exp / 1000) * 100} className="h-3" />
              <p className="text-xs text-muted-foreground">
                {Math.round((formData.exp / 1000) * 100)}% to next level
              </p>
            </div>

            {/* Friends */}
            <div className="space-y-2">
              <Label>Friends ({formData.friends.length})</Label>
              {formData.friends.length > 0 && friends ? (
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
              ) : formData.friends.length > 0 ? (
                <p className="text-sm text-muted-foreground">
                  Loading friends...
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">No friends yet</p>
              )}
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
    </div>
  );
}
