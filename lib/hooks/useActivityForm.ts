"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import type { AddressCoordinates } from "@/lib/types/coordinates";
import {
  type ActivityFormData,
  type FormErrors,
  initialFormData,
} from "@/components/activities/ActivityFormTypes";
import { validateActivityField } from "@/lib/validation";
import { geocodeAddress } from "@/lib/geocoding";

function buildActivityMutationArgs(
  formData: ActivityFormData,
  coords: { latitude: number; longitude: number }
) {
  const durationInt = parseInt(formData.duration, 10);
  const maxParticipantsInt = parseInt(formData.maxParticipants, 10);
  const minAgeInt = parseInt(formData.minAge, 10);
  const priceFloat = parseFloat(formData.price);
  return {
    activityName: formData.activityName.trim(),
    longitude: coords.longitude,
    latitude: coords.latitude,
    description: formData.description.trim(),
    address: formData.address.trim(),
    price: priceFloat,
    duration: BigInt(durationInt),
    difficulty: formData.difficulty.trim(),
    maxParticipants: BigInt(maxParticipantsInt),
    minAge: BigInt(minAgeInt),
    tags: formData.tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean),
    equipment: formData.equipment
      .split(",")
      .map((e) => e.trim())
      .filter(Boolean),
    images: formData.images,
    availableTimeSlots: formData.availableTimeSlots,
  };
}

export interface UseActivityFormOptions {
  activityId?: Id<"activities">;
  onSuccess?: () => void;
}

export function useActivityForm({
  activityId,
  onSuccess,
}: UseActivityFormOptions = {}) {
  const createActivity = useMutation(api.activity.createActivity);
  const updateActivity = useMutation(api.activity.updateActivity);
  const activity = useQuery(
    api.activity.getActivityById,
    activityId ? { activityId } : "skip"
  );
  const prefillDoneFor = useRef<Id<"activities"> | null>(null);

  const [formData, setFormData] = useState<ActivityFormData>(initialFormData);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [selectedDifficulty, setSelectedDifficulty] = useState<string[]>([]);
  const [imageError, setImageError] = useState<string>("");
  const [currentStep, setCurrentStep] = useState(1);

  const validateForm = useCallback((): { valid: boolean; errors: FormErrors } => {
    const newErrors: FormErrors = {};
    newErrors.activityName = validateActivityField(
      "activityName",
      formData.activityName
    );
    newErrors.description = validateActivityField(
      "description",
      formData.description
    );
    newErrors.address = validateActivityField("address", formData.address);
    newErrors.coordinates = validateActivityField(
      "coordinates",
      formData.coordinates
    );
    newErrors.price = validateActivityField("price", formData.price);
    newErrors.duration = validateActivityField("duration", formData.duration);
    newErrors.difficulty = validateActivityField(
      "difficulty",
      formData.difficulty
    );
    newErrors.maxParticipants = validateActivityField(
      "maxParticipants",
      formData.maxParticipants
    );
    newErrors.minAge = validateActivityField("minAge", formData.minAge);
    newErrors.tags = validateActivityField("tags", formData.tags);

    setErrors(newErrors);
    const valid = Object.values(newErrors).every((e) => !e);
    return { valid, errors: newErrors };
  }, [formData]);

  const updateField = useCallback(
    <K extends keyof ActivityFormData>(field: K, value: ActivityFormData[K]) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
      setErrors((prev) =>
        prev[field as keyof FormErrors]
          ? { ...prev, [field]: undefined }
          : prev
      );
    },
    []
  );

  const handleAddressSelect = useCallback(
    (address: string, coords: AddressCoordinates) => {
      updateField("address", address);
      updateField("coordinates", coords);
      setErrors((prev) => {
        const next = { ...prev };
        if (prev.address) next.address = undefined;
        if (prev.coordinates) next.coordinates = undefined;
        return next;
      });
    },
    [updateField]
  );

  const handleAddressChange = useCallback(
    (address: string) => {
      updateField("address", address);
      updateField("coordinates", null);
    },
    [updateField]
  );

  const handleDifficultyChange = useCallback(
    (values: string[]) => {
      const newValues =
        values.length > 0 ? [values[values.length - 1]] : [];
      setSelectedDifficulty(newValues);
      updateField("difficulty", newValues[0] || "");
      setErrors((prev) =>
        prev.difficulty ? { ...prev, difficulty: undefined } : prev
      );
    },
    [updateField]
  );

  const handleImageSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files) return;

      const MAX_FILE_SIZE = 1024 * 1024;
      const arr = Array.from(files);
      const invalidFiles: string[] = [];

      arr.forEach((file) => {
        if (!file.type.startsWith("image/")) {
          invalidFiles.push(`${file.name} is not an image file`);
          return;
        }
        if (file.size > MAX_FILE_SIZE) {
          invalidFiles.push(
            `${file.name} exceeds 1MB limit (${(file.size / 1024 / 1024).toFixed(2)}MB)`
          );
          return;
        }
        const reader = new FileReader();
        reader.onloadend = () => {
          setFormData((prev) => ({
            ...prev,
            images: [...prev.images, reader.result as string],
          }));
          setImageError("");
        };
        reader.readAsDataURL(file);
      });

      if (invalidFiles.length > 0) {
        setImageError(invalidFiles.join(", "));
        setTimeout(() => setImageError(""), 5000);
      }

      e.currentTarget.value = "";
    },
    []
  );

  const removeImage = useCallback((idx: number) => {
    setFormData((prev) => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== idx),
    }));
  }, []);

  const resetForm = useCallback(() => {
    setFormData(initialFormData);
    setErrors({});
    setIsSubmitting(false);
    setIsGeocoding(false);
    setSelectedDifficulty([]);
    setCurrentStep(1);
    prefillDoneFor.current = null;
  }, []);

  useEffect(() => {
    if (!activityId || !activity || activityId === prefillDoneFor.current)
      return;
    setFormData({
      activityName: activity.activityName ?? "",
      description: activity.description ?? "",
      address: activity.address ?? "",
      coordinates: {
        latitude: activity.latitude,
        longitude: activity.longitude,
      },
      price: String(activity.price ?? 0),
      duration: String(activity.duration ?? 0),
      difficulty: activity.difficulty ?? "",
      maxParticipants: String(activity.maxParticipants ?? 0),
      minAge: String(activity.minAge ?? 0),
      tags: (activity.tags ?? []).join(", "),
      equipment: (activity.equipment ?? []).join(", "),
      images: activity.images ?? [],
      availableTimeSlots: activity.availableTimeSlots ?? [],
    });
    setSelectedDifficulty(activity.difficulty ? [activity.difficulty] : []);
    setErrors({});
    prefillDoneFor.current = activityId;
  }, [activityId, activity]);

  const isFormValid = useCallback(
    () =>
      !!(
        formData.activityName.trim() &&
        formData.description.trim() &&
        formData.address.trim() &&
        formData.coordinates !== null &&
        formData.price.trim() &&
        formData.duration.trim() &&
        formData.difficulty.trim() &&
        ["easy", "intermediate", "hard"].includes(
          formData.difficulty.toLowerCase().trim()
        ) &&
        formData.maxParticipants.trim() &&
        formData.minAge.trim() &&
        formData.tags.trim() &&
        !isSubmitting &&
        !isGeocoding
      ),
    [formData, isSubmitting, isGeocoding]
  );

  const handleSubmit = useCallback(async () => {
    const result = validateForm();
    if (!result.valid) {
      const first = Object.keys(result.errors).find((k) =>
        result.errors[k as keyof FormErrors]
      );
      if (first) {
        document
          .getElementById(first)
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      return;
    }

    setIsSubmitting(true);

    try {
      let coords = formData.coordinates;
      if (!coords && formData.address.trim()) {
        setIsGeocoding(true);
        coords = await geocodeAddress(formData.address);
        setIsGeocoding(false);
        if (!coords) {
          setErrors((prev) => ({
            ...prev,
            coordinates:
              "Could not geocode address. Please select from suggestions.",
          }));
          setIsSubmitting(false);
          return;
        }
      }

      if (!coords) {
        setErrors((prev) => ({
          ...prev,
          coordinates: "Coordinates are required",
        }));
        setIsSubmitting(false);
        return;
      }

      const base = buildActivityMutationArgs(formData, coords);

      if (activityId) {
        await updateActivity({ activityId, ...base });
      } else {
        await (
          createActivity as unknown as (...args: unknown[]) => Promise<unknown>
        )(base as unknown);
      }

      resetForm();
      onSuccess?.();
    } catch (err) {
      console.error(
        activityId ? "updateActivity error:" : "createActivity error:",
        err
      );
      setErrors((prev) => ({
        ...prev,
        _general:
          activityId
            ? "Failed to update activity. Please try again."
            : "Failed to create activity. Please try again.",
      }));
    } finally {
      setIsSubmitting(false);
    }
  }, [
    activityId,
    formData,
    validateForm,
    createActivity,
    updateActivity,
    resetForm,
    onSuccess,
  ]);

  return {
    formData,
    errors,
    setErrors,
    updateField,
    handleAddressSelect,
    handleAddressChange,
    handleDifficultyChange,
    handleImageSelect,
    removeImage,
    selectedDifficulty,
    imageError,
    currentStep,
    setCurrentStep,
    isSubmitting,
    isGeocoding,
    validateForm,
    isFormValid,
    handleSubmit,
    resetForm,
    activity,
    isEdit: !!activityId,
  };
}
