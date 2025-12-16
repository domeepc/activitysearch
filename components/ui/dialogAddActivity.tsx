"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import React, { Dispatch, useCallback, useState } from "react";
import { Button } from "./button";
import { Textarea } from "./textarea";
import { Avatar, AvatarImage, AvatarFallback } from "./avatar";
import { Upload, X, AlertCircle } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { useMutation } from "convex/react";
import {
  AddressAutocomplete,
  AddressCoordinates,
} from "./address-autocomplete";
import { cn } from "@/lib/utils";
import {
  MultiSelect,
  MultiSelectContent,
  MultiSelectItem,
  MultiSelectTrigger,
  MultiSelectValue,
  MultiSelectGroup,
} from "./multi-select";

// TypeScript types
interface ActivityFormData {
  activityName: string;
  description: string;
  address: string;
  coordinates: AddressCoordinates | null;
  price: string;
  duration: string;
  difficulty: string;
  maxParticipants: string;
  minAge: string;
  tags: string;
  equipment: string;
  images: string[];
}

interface FormErrors {
  activityName?: string;
  description?: string;
  address?: string;
  coordinates?: string;
  price?: string;
  duration?: string;
  difficulty?: string;
  maxParticipants?: string;
  minAge?: string;
  tags?: string;
}

const initialFormData: ActivityFormData = {
  activityName: "",
  description: "",
  address: "",
  coordinates: null,
  price: "",
  duration: "",
  difficulty: "",
  maxParticipants: "",
  minAge: "",
  tags: "",
  equipment: "",
  images: [],
};

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

  // Geocode an address using OpenStreetMap Nominatim
  const geocodeAddress = async (
    q: string
  ): Promise<AddressCoordinates | null> => {
    if (!q || !q.trim()) return null;
    try {
      setIsGeocoding(true);
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&countrycodes=hr&q=${encodeURIComponent(
          q
        )}`,
        { headers: { "User-Agent": "activitysearch/1.0" } }
      );
      if (!res.ok) return null;
      const data = await res.json();
      if (!Array.isArray(data) || data.length === 0) return null;
      const first = data[0];
      return {
        latitude: parseFloat(first.lat),
        longitude: parseFloat(first.lon),
      };
    } catch (err) {
      console.error("geocode error", err);
      return null;
    } finally {
      setIsGeocoding(false);
    }
  };

  // Validation functions
  const validateField = (
    field: keyof FormErrors,
    value: string | AddressCoordinates | null
  ): string | undefined => {
    switch (field) {
      case "activityName":
        if (!value || (typeof value === "string" && !value.trim())) {
          return "Activity name is required";
        }
        break;
      case "description":
        if (!value || (typeof value === "string" && !value.trim())) {
          return "Description is required";
        }
        break;
      case "address":
        if (!value || (typeof value === "string" && !value.trim())) {
          return "Address is required";
        }
        break;
      case "coordinates":
        if (!value || (typeof value === "object" && value === null)) {
          return "Please select an address from the suggestions";
        }
        break;
      case "price":
        if (!value || (typeof value === "string" && !value.trim())) {
          return "Price is required";
        }
        const priceNum = parseFloat(value as string);
        if (isNaN(priceNum) || priceNum < 0) {
          return "Price must be a valid number >= 0";
        }
        break;
      case "duration":
        if (!value || (typeof value === "string" && !value.trim())) {
          return "Duration is required";
        }
        const durationInt = parseInt(value as string, 10);
        if (isNaN(durationInt) || durationInt < 0) {
          return "Duration must be a valid integer >= 0";
        }
        break;
      case "difficulty":
        if (!value || (typeof value === "string" && !value.trim())) {
          return "Difficulty is required";
        }
        if (typeof value === "string") {
          const lowerValue = value.toLowerCase().trim();
          if (!["easy", "intermediate", "hard"].includes(lowerValue)) {
            return "Difficulty must be Easy, Intermediate, or Hard";
          }
        }
        break;
      case "maxParticipants":
        if (!value || (typeof value === "string" && !value.trim())) {
          return "Max participants is required";
        }
        const maxPartInt = parseInt(value as string, 10);
        if (isNaN(maxPartInt) || maxPartInt < 1) {
          return "Max participants must be a valid integer >= 1";
        }
        break;
      case "minAge":
        if (!value || (typeof value === "string" && !value.trim())) {
          return "Min age is required";
        }
        const minAgeInt = parseInt(value as string, 10);
        if (isNaN(minAgeInt) || minAgeInt < 12) {
          return "Min age must be a valid integer >= 12";
        }
        break;
      case "tags":
        if (!value || (typeof value === "string" && !value.trim())) {
          return "At least one tag is required";
        }
        const tagsArray = (value as string)
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean);
        if (tagsArray.length === 0) {
          return "At least one tag is required";
        }
        break;
    }
    return undefined;
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    // Validate all required fields
    newErrors.activityName = validateField(
      "activityName",
      formData.activityName
    );
    newErrors.description = validateField("description", formData.description);
    newErrors.address = validateField("address", formData.address);
    newErrors.coordinates = validateField("coordinates", formData.coordinates);
    newErrors.price = validateField("price", formData.price);
    newErrors.duration = validateField("duration", formData.duration);
    newErrors.difficulty = validateField("difficulty", formData.difficulty);
    newErrors.maxParticipants = validateField(
      "maxParticipants",
      formData.maxParticipants
    );
    newErrors.minAge = validateField("minAge", formData.minAge);
    newErrors.tags = validateField("tags", formData.tags);

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
    const arr = Array.from(files);
    arr.forEach((file) => {
      if (!file.type.startsWith("image/")) return;
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData((prev) => ({
          ...prev,
          images: [...prev.images, reader.result as string],
        }));
      };
      reader.readAsDataURL(file);
    });
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
        coords = await geocodeAddress(formData.address);
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
          {/* Basic Information Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground">
              Basic Information
            </h3>

            <div className="grid gap-4 md:grid-cols-2">
              {/* Activity Name */}
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="activityName">
                  Activity Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="activityName"
                  type="text"
                  value={formData.activityName}
                  onChange={(e) => updateField("activityName", e.target.value)}
                  onBlur={() => {
                    const error = validateField(
                      "activityName",
                      formData.activityName
                    );
                    setErrors((prev) => ({ ...prev, activityName: error }));
                  }}
                  className={cn(errors.activityName && "border-destructive")}
                  aria-required="true"
                  aria-invalid={!!errors.activityName}
                />
                {errors.activityName && (
                  <p className="text-sm text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {errors.activityName}
                  </p>
                )}
              </div>

              {/* Description */}
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="description">
                  Description <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="description"
                  className={cn(
                    "resize-none min-h-[100px]",
                    errors.description && "border-destructive"
                  )}
                  value={formData.description}
                  onChange={(e) => updateField("description", e.target.value)}
                  onBlur={() => {
                    const error = validateField(
                      "description",
                      formData.description
                    );
                    setErrors((prev) => ({ ...prev, description: error }));
                  }}
                  aria-required="true"
                  aria-invalid={!!errors.description}
                />
                {errors.description && (
                  <p className="text-sm text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {errors.description}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Location Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Location</h3>

            <div className="grid gap-4">
              {/* Address */}
              <div className="space-y-2">
                <Label htmlFor="address">
                  Address <span className="text-destructive">*</span>
                </Label>
                <AddressAutocomplete
                  id="address"
                  value={formData.address}
                  onChange={handleAddressChange}
                  onSelect={handleAddressSelect}
                  placeholder="Start typing an address..."
                  error={errors.address || errors.coordinates}
                  required
                />
                {errors.coordinates && !errors.address && (
                  <p className="text-sm text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {errors.coordinates}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Activity Details Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground">
              Activity Details
            </h3>

            <div className="grid gap-4 md:grid-cols-2">
              {/* Price */}
              <div className="space-y-2">
                <Label htmlFor="price">
                  Price (HRK) <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.price}
                  onChange={(e) => updateField("price", e.target.value)}
                  onBlur={() => {
                    const error = validateField("price", formData.price);
                    setErrors((prev) => ({ ...prev, price: error }));
                  }}
                  className={cn(errors.price && "border-destructive")}
                  aria-required="true"
                  aria-invalid={!!errors.price}
                />
                {errors.price && (
                  <p className="text-sm text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {errors.price}
                  </p>
                )}
              </div>

              {/* Duration */}
              <div className="space-y-2">
                <Label htmlFor="duration">
                  Duration (minutes) <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="duration"
                  type="number"
                  min="0"
                  step="1"
                  value={formData.duration}
                  onChange={(e) => updateField("duration", e.target.value)}
                  onBlur={() => {
                    const error = validateField("duration", formData.duration);
                    setErrors((prev) => ({ ...prev, duration: error }));
                  }}
                  className={cn(errors.duration && "border-destructive")}
                  aria-required="true"
                  aria-invalid={!!errors.duration}
                />
                {errors.duration && (
                  <p className="text-sm text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {errors.duration}
                  </p>
                )}
              </div>

              {/* Difficulty */}
              <div className="space-y-2">
                <Label htmlFor="difficulty">
                  Difficulty <span className="text-destructive">*</span>
                </Label>
                <MultiSelect
                  values={selectedDifficulty}
                  onValuesChange={handleDifficultyChange}
                >
                  <MultiSelectTrigger
                    id="difficulty"
                    className={cn(
                      "w-full",
                      errors.difficulty && "border-destructive"
                    )}
                    aria-required="true"
                    aria-invalid={!!errors.difficulty}
                  >
                    <MultiSelectValue placeholder="Select difficulty..." />
                  </MultiSelectTrigger>
                  <MultiSelectContent search={false}>
                    <MultiSelectGroup>
                      <MultiSelectItem value="easy">Easy</MultiSelectItem>
                      <MultiSelectItem value="intermediate">
                        Intermediate
                      </MultiSelectItem>
                      <MultiSelectItem value="hard">Hard</MultiSelectItem>
                    </MultiSelectGroup>
                  </MultiSelectContent>
                </MultiSelect>
                {errors.difficulty && (
                  <p className="text-sm text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {errors.difficulty}
                  </p>
                )}
              </div>

              {/* Max Participants */}
              <div className="space-y-2">
                <Label htmlFor="maxParticipants">
                  Max Participants <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="maxParticipants"
                  type="number"
                  min="1"
                  step="1"
                  value={formData.maxParticipants}
                  onChange={(e) =>
                    updateField("maxParticipants", e.target.value)
                  }
                  onBlur={() => {
                    const error = validateField(
                      "maxParticipants",
                      formData.maxParticipants
                    );
                    setErrors((prev) => ({ ...prev, maxParticipants: error }));
                  }}
                  className={cn(errors.maxParticipants && "border-destructive")}
                  aria-required="true"
                  aria-invalid={!!errors.maxParticipants}
                />
                {errors.maxParticipants && (
                  <p className="text-sm text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {errors.maxParticipants}
                  </p>
                )}
              </div>

              {/* Min Age */}
              <div className="space-y-2">
                <Label htmlFor="minAge">
                  Min Age <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="minAge"
                  type="number"
                  min="12"
                  step="1"
                  value={formData.minAge}
                  onChange={(e) => updateField("minAge", e.target.value)}
                  onBlur={() => {
                    const error = validateField("minAge", formData.minAge);
                    setErrors((prev) => ({ ...prev, minAge: error }));
                  }}
                  className={cn(errors.minAge && "border-destructive")}
                  aria-required="true"
                  aria-invalid={!!errors.minAge}
                />
                {errors.minAge && (
                  <p className="text-sm text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {errors.minAge}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Tags and Equipment Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground">
              Tags & Equipment
            </h3>

            <div className="grid gap-4 md:grid-cols-2">
              {/* Tags */}
              <div className="space-y-2">
                <Label htmlFor="tags">
                  Tags (comma separated){" "}
                  <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="tags"
                  type="text"
                  value={formData.tags}
                  onChange={(e) => updateField("tags", e.target.value)}
                  onBlur={() => {
                    const error = validateField("tags", formData.tags);
                    setErrors((prev) => ({ ...prev, tags: error }));
                  }}
                  placeholder="e.g., hiking, outdoor, adventure"
                  className={cn(errors.tags && "border-destructive")}
                  aria-required="true"
                  aria-invalid={!!errors.tags}
                />
                {errors.tags && (
                  <p className="text-sm text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {errors.tags}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Separate multiple tags with commas
                </p>
              </div>

              {/* Equipment */}
              <div className="space-y-2">
                <Label htmlFor="equipment">Equipment (comma separated)</Label>
                <Input
                  id="equipment"
                  type="text"
                  value={formData.equipment}
                  onChange={(e) => updateField("equipment", e.target.value)}
                  placeholder="e.g., helmet, rope, backpack"
                />
                <p className="text-xs text-muted-foreground">
                  Separate multiple items with commas
                </p>
              </div>
            </div>
          </div>

          {/* Images Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Images</h3>

            <div className="space-y-2">
              <input
                id="images-upload"
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageSelect}
                className="hidden"
              />
              <div className="flex flex-col gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    (
                      document.getElementById(
                        "images-upload"
                      ) as HTMLInputElement | null
                    )?.click()
                  }
                  className="w-full sm:w-auto"
                >
                  <Upload className="size-4 mr-2" /> Upload Images
                </Button>
                {formData.images.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {formData.images.map((src, idx) => (
                      <div key={idx} className="relative">
                        <Avatar className="size-16 sm:size-20">
                          <AvatarImage src={src} alt={`Upload ${idx + 1}`} />
                          <AvatarFallback>IMG</AvatarFallback>
                        </Avatar>
                        <button
                          type="button"
                          onClick={() => removeImage(idx)}
                          className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1 hover:bg-destructive/90 transition-colors"
                          aria-label={`Remove image ${idx + 1}`}
                        >
                          <X className="size-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
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
  );
}
