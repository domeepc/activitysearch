"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import React, { Dispatch, useCallback, useState } from "react";
import { Button } from "./button";
import { api } from "@/convex/_generated/api";
import { useMutation } from "convex/react";
import { AddressCoordinates } from "./address-autocomplete";
import {
  ActivityFormData,
  FormErrors,
  initialFormData,
} from "@/components/activities/ActivityFormTypes";
import {
  BasicInformationSection,
  LocationSection,
  ActivityDetailsSection,
  TagsEquipmentSection,
  ImagesSection,
  TimeSlotsSection,
} from "@/components/activities/ActivityFormSections";
import { validateActivityField } from "@/lib/validation";
import { geocodeAddress } from "@/lib/geocoding";

export default function DialogAddActivity({
  showDialog,
  setShowDialog,
}: {
  showDialog: boolean;
  setShowDialog: Dispatch<React.SetStateAction<boolean>>;
}) {
  const createActivity = useMutation(api.activity.createActivity);
  const [formData, setFormData] = useState<ActivityFormData>(initialFormData);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [selectedDifficulty, setSelectedDifficulty] = useState<string[]>([]);
  const [imageError, setImageError] = useState<string>("");

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    // Validate all required fields
    newErrors.activityName = validateActivityField(
      "activityName",
      formData.activityName
    );
    newErrors.description = validateActivityField("description", formData.description);
    newErrors.address = validateActivityField("address", formData.address);
    newErrors.coordinates = validateActivityField("coordinates", formData.coordinates);
    newErrors.price = validateActivityField("price", formData.price);
    newErrors.duration = validateActivityField("duration", formData.duration);
    newErrors.difficulty = validateActivityField("difficulty", formData.difficulty);
    newErrors.maxParticipants = validateActivityField(
      "maxParticipants",
      formData.maxParticipants
    );
    newErrors.minAge = validateActivityField("minAge", formData.minAge);
    newErrors.tags = validateActivityField("tags", formData.tags);

    setErrors(newErrors);
    return Object.values(newErrors).every((error) => !error);
  };

  // Update form field
  const updateField = <K extends keyof ActivityFormData>(
    field: K,
    value: ActivityFormData[K]
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error for this field when user starts typing
    if (errors[field as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  // Handle address selection
  const handleAddressSelect = (address: string, coords: AddressCoordinates) => {
    updateField("address", address);
    updateField("coordinates", coords);
    if (errors.address) {
      setErrors((prev) => ({ ...prev, address: undefined }));
    }
    if (errors.coordinates) {
      setErrors((prev) => ({ ...prev, coordinates: undefined }));
    }
  };

  // Handle address change (when typing)
  const handleAddressChange = (address: string) => {
    updateField("address", address);
    updateField("coordinates", null);
  };

  // Handle difficulty selection (only allow one selection)
  const handleDifficultyChange = (values: string[]) => {
    // Only allow one difficulty to be selected at a time
    // If a new value is added and we already have one, replace it
    // If a value is removed (toggle off), clear the selection
    let newValues: string[] = [];
    if (values.length > 0) {
      // If multiple values, take the last one (most recently selected)
      // If only one value, use it
      newValues = [values[values.length - 1]];
    }
    setSelectedDifficulty(newValues);
    updateField("difficulty", newValues[0] || "");
    if (errors.difficulty) {
      setErrors((prev) => ({ ...prev, difficulty: undefined }));
    }
  };

  // Handle image selection
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    
    const MAX_FILE_SIZE = 1024 * 1024; // 1MB in bytes
    const arr = Array.from(files);
    const invalidFiles: string[] = [];
    
    arr.forEach((file) => {
      // Check file type
      if (!file.type.startsWith("image/")) {
        invalidFiles.push(`${file.name} is not an image file`);
        return;
      }
      
      // Check file size
      if (file.size > MAX_FILE_SIZE) {
        invalidFiles.push(`${file.name} exceeds 1MB limit (${(file.size / 1024 / 1024).toFixed(2)}MB)`);
        return;
      }
      
      // Process valid file
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData((prev) => ({
          ...prev,
          images: [...prev.images, reader.result as string],
        }));
        setImageError(""); // Clear error on successful upload
      };
      reader.readAsDataURL(file);
    });
    
    // Show error if any files were invalid
    if (invalidFiles.length > 0) {
      setImageError(invalidFiles.join(", "));
      setTimeout(() => setImageError(""), 5000); // Clear error after 5 seconds
    }
    
    e.currentTarget.value = "";
  };

  const removeImage = (idx: number) => {
    setFormData((prev) => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== idx),
    }));
  };

  // Reset form
  const resetForm = useCallback(() => {
    setFormData(initialFormData);
    setErrors({});
    setIsSubmitting(false);
    setIsGeocoding(false);
    setSelectedDifficulty([]);
  }, []);

  // Handle dialog open change
  const handleOpenChange = useCallback(
    (open: boolean) => {
      setShowDialog(open);
      if (!open) {
        resetForm();
      }
    },
    [resetForm, setShowDialog]
  );

  // Handle form submission
  const handleSubmit = async () => {
    if (!validateForm()) {
      // Scroll to first error
      const firstErrorField = Object.keys(errors).find(
        (key) => errors[key as keyof FormErrors]
      );
      if (firstErrorField) {
        const element = document.getElementById(firstErrorField);
        element?.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      return;
    }

    setIsSubmitting(true);

    try {
      // Ensure we have coordinates
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

      const durationInt = parseInt(formData.duration, 10);
      const maxParticipantsInt = parseInt(formData.maxParticipants, 10);
      const minAgeInt = parseInt(formData.minAge, 10);
      const priceFloat = parseFloat(formData.price);

      const args = {
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
        availableTimeSlots: formData.availableTimeSlots.length > 0
          ? formData.availableTimeSlots
          : undefined,
      } as unknown;

      await (
        createActivity as unknown as (...args: unknown[]) => Promise<unknown>
      )(args);

      resetForm();
      setShowDialog(false);
    } catch (err) {
      console.error("createActivity error:", err);
      setErrors((prev) => ({
        ...prev,
        _general: "Failed to create activity. Please try again.",
      }));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Check if form is valid for submit button
  const isFormValid = () => {
    return (
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
    );
  };

  return (
    <div className="hidden md:block">
      <Dialog open={showDialog} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Activity</DialogTitle>
          <DialogDescription>
            Fill in all required fields to create a new activity. Fields marked
            with * are required.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 py-4">
          <BasicInformationSection
            formData={formData}
            errors={errors}
            onFieldChange={updateField}
            onFieldBlur={(field, value) => {
              const error = validateActivityField(field, value);
              setErrors((prev) => ({ ...prev, [field]: error }));
            }}
          />
          <LocationSection
            formData={formData}
            errors={errors}
            onAddressChange={handleAddressChange}
            onAddressSelect={handleAddressSelect}
          />
          <ActivityDetailsSection
            formData={formData}
            errors={errors}
            selectedDifficulty={selectedDifficulty}
            onFieldChange={updateField}
            onFieldBlur={(field, value) => {
              const error = validateActivityField(field, value);
              setErrors((prev) => ({ ...prev, [field]: error }));
            }}
            onDifficultyChange={handleDifficultyChange}
          />
          <TimeSlotsSection
            formData={formData}
            onFieldChange={updateField}
          />
          <TagsEquipmentSection
            formData={formData}
            errors={errors}
            onFieldChange={updateField}
            onFieldBlur={(field, value) => {
              const error = validateActivityField(field, value);
              setErrors((prev) => ({ ...prev, [field]: error }));
            }}
          />
              <ImagesSection
                formData={formData}
                onImageSelect={handleImageSelect}
                onRemoveImage={removeImage}
                error={imageError}
              />
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setShowDialog(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={!isFormValid()}
          >
            {isSubmitting ? "Creating..." : "Create Activity"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </div>
  );
}
