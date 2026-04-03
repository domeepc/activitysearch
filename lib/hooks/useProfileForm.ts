import { useState, useEffect } from "react";
import { useQuery, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useRouter } from "next/navigation";
import { validateProfileField } from "@/lib/validation";
import { extractErrorMessage } from "@/lib/errors";
import type { ProfileFormData, ProfileErrors } from "@/lib/types/profile";

interface UseProfileFormProps {
  user: {
    _id: Id<"users">;
    name: string;
    lastname: string;
    username: string;
    email: string;
    description: string;
    contact: string;
    avatar: string;
    totalExp: bigint;
    friends: Id<"users">[];
  } | null | undefined;
  isEditing: boolean;
}

export function useProfileForm({ user, isEditing }: UseProfileFormProps) {
  const router = useRouter();
  const [formData, setFormData] = useState<ProfileFormData>({
    avatar: "",
    name: "",
    lastname: "",
    username: "",
    email: "",
    description: "",
    contact: "",
    friends: [],
  });
  const [errors, setErrors] = useState<ProfileErrors>({
    name: "",
    lastname: "",
    email: "",
  });
  const [usernameError, setUsernameError] = useState("");

  const updateProfile = useAction(api.users.updateUserProfile);
  const usernameCheckParams =
    isEditing && formData.username !== user?.username && formData.username
      ? { username: formData.username }
      : "skip";
  const checkUsernameExists = useQuery(
    api.users.checkUsernameExists,
    usernameCheckParams
  );

  // Initialize form data from user
  useEffect(() => {
    if (user !== undefined && user !== null) {
      queueMicrotask(() => {
        setFormData({
          avatar: user.avatar || "https://via.placeholder.com/128",
          name: user.name || "",
          lastname: user.lastname || "",
          username: user.username || "",
          email: user.email || "",
          description: user.description || "",
          contact: user.contact || "",
          friends: user.friends || [],
        });
      });
    }
  }, [user]);

  // Check username availability
  useEffect(() => {
    queueMicrotask(() => {
      if (checkUsernameExists === true) {
        setUsernameError("This username is already taken");
      } else if (
        checkUsernameExists === false &&
        formData.username !== user?.username
      ) {
        setUsernameError("");
      }
    });
  }, [checkUsernameExists, formData.username, user?.username]);

  const validateField = (name: string, value: string) => {
    const error = validateProfileField(name, value);
    setErrors((prev) => ({ ...prev, [name]: error || "" }));
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    if (name === "name" || name === "lastname") {
      validateField(name, value);
    } else if (name === "email") {
      // Only validate email if it's different from current email
      if (value !== user?.email) {
        // Validate and immediately update error state
        const error = validateProfileField(name, value);
        setErrors((prev) => ({ ...prev, email: error || "" }));
      } else {
        // Clear email error if it matches current email
        setErrors((prev) => ({ ...prev, email: "" }));
      }
    }
  };

  const resetForm = () => {
    if (user) {
      setFormData({
        avatar: user.avatar || "https://via.placeholder.com/128",
        name: user.name || "",
        lastname: user.lastname || "",
        username: user.username || "",
        email: user.email || "",
        description: user.description || "",
        contact: user.contact || "",
        friends: user.friends || [],
      });
    }
    setUsernameError("");
    setErrors({ name: "", lastname: "", email: "" });
  };

  const handleSave = async (): Promise<{ success: boolean; emailChanged?: boolean; newEmail?: string }> => {
    // Validate all fields and get immediate results
    const nameError = validateProfileField("name", formData.name);
    const lastnameError = validateProfileField("lastname", formData.lastname);
    
    // Only validate email if it's different from current email
    const emailChanged = formData.email !== user?.email;
    const emailError = emailChanged ? validateProfileField("email", formData.email) : undefined;
    
    // Update error state
    setErrors({
      name: nameError || "",
      lastname: lastnameError || "",
      email: emailError || "",
    });

    // Check for validation errors
    const hasValidationErrors = usernameError || nameError || lastnameError || emailError;
    if (hasValidationErrors) {
      return { success: false };
    }

    try {
      // Only include email in update if it has changed
      const updateData: {
        name: string;
        lastname: string;
        username: string;
        email?: string;
        description: string;
        contact: string;
      } = {
        name: formData.name,
        lastname: formData.lastname,
        username: formData.username,
        description: formData.description,
        contact: formData.contact,
      };

      if (emailChanged) {
        updateData.email = formData.email;
      }

      await updateProfile(updateData);
      setUsernameError("");
      setErrors({ name: "", lastname: "", email: "" });

      // Refresh if username changed (slug might have changed)
      if (formData.username !== user?.username) {
        setTimeout(() => router.refresh(), 500);
      }

      return { success: true, emailChanged, newEmail: emailChanged ? formData.email : undefined };
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
      } else if (emailChanged) {
        setErrors({ ...errors, email: errorMessage });
      }
      return { success: false };
    }
  };

  return {
    formData,
    errors,
    usernameError,
    handleChange,
    resetForm,
    handleSave,
  };
}

