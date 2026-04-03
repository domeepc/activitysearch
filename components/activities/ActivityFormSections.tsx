import React from "react";
import Image from "next/image";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Upload,
  X,
  AlertCircle,
  Image as ImageIcon,
  Clock,
  Plus,
} from "lucide-react";
import {
  AddressAutocomplete,
  AddressCoordinates,
} from "@/components/ui/address-autocomplete";
import { cn } from "@/lib/utils";
import { MAX_IMAGE_UPLOAD_LABEL } from "@/lib/uploadLimits";
import {
  MultiSelect,
  MultiSelectContent,
  MultiSelectItem,
  MultiSelectTrigger,
  MultiSelectValue,
  MultiSelectGroup,
} from "@/components/ui/multi-select";
import { ActivityFormData, FormErrors } from "./ActivityFormTypes";

interface ActivityFormSectionsProps {
  formData: ActivityFormData;
  errors: FormErrors;
  selectedDifficulty: string[];
  onFieldChange: <K extends keyof ActivityFormData>(
    field: K,
    value: ActivityFormData[K]
  ) => void;
  onFieldBlur: (
    field: keyof FormErrors,
    value: string | AddressCoordinates | null
  ) => void;
  onAddressChange: (address: string) => void;
  onAddressSelect: (address: string, coords: AddressCoordinates) => void;
  onDifficultyChange: (values: string[]) => void;
  onImageSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveImage: (idx: number) => void;
  error?: string;
}

export function BasicInformationSection({
  formData,
  errors,
  onFieldChange,
  onFieldBlur,
}: Pick<
  ActivityFormSectionsProps,
  "formData" | "errors" | "onFieldChange" | "onFieldBlur"
>) {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-foreground">
        Basic Information
      </h3>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="activityName">
            Activity Name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="activityName"
            type="text"
            value={formData.activityName}
            onChange={(e) => onFieldChange("activityName", e.target.value)}
            onBlur={() => onFieldBlur("activityName", formData.activityName)}
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
            onChange={(e) => onFieldChange("description", e.target.value)}
            onBlur={() => onFieldBlur("description", formData.description)}
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
  );
}

export function LocationSection({
  formData,
  errors,
  onAddressChange,
  onAddressSelect,
}: Pick<
  ActivityFormSectionsProps,
  "formData" | "errors" | "onAddressChange" | "onAddressSelect"
>) {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-foreground">Location</h3>
      <div className="grid gap-4">
        <div className="space-y-2">
          <Label htmlFor="address">
            Address <span className="text-destructive">*</span>
          </Label>
          <AddressAutocomplete
            id="address"
            value={formData.address}
            onChange={onAddressChange}
            onSelect={onAddressSelect}
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
  );
}

export function ActivityDetailsSection({
  formData,
  errors,
  selectedDifficulty,
  onFieldChange,
  onFieldBlur,
  onDifficultyChange,
}: Pick<
  ActivityFormSectionsProps,
  | "formData"
  | "errors"
  | "selectedDifficulty"
  | "onFieldChange"
  | "onFieldBlur"
  | "onDifficultyChange"
>) {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-foreground">
        Activity Details
      </h3>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="price">
            Price (EUR) <span className="text-destructive">*</span>
          </Label>
          <Input
            id="price"
            type="number"
            step="0.01"
            min="0"
            value={formData.price}
            onChange={(e) => onFieldChange("price", e.target.value)}
            onBlur={() => onFieldBlur("price", formData.price)}
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
            onChange={(e) => onFieldChange("duration", e.target.value)}
            onBlur={() => onFieldBlur("duration", formData.duration)}
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
        <div className="space-y-2">
          <Label htmlFor="difficulty">
            Difficulty <span className="text-destructive">*</span>
          </Label>
          <MultiSelect
            values={selectedDifficulty}
            onValuesChange={onDifficultyChange}
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
            onChange={(e) => onFieldChange("maxParticipants", e.target.value)}
            onBlur={() =>
              onFieldBlur("maxParticipants", formData.maxParticipants)
            }
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
            onChange={(e) => onFieldChange("minAge", e.target.value)}
            onBlur={() => onFieldBlur("minAge", formData.minAge)}
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
  );
}

export function TimeSlotsSection({
  formData,
  onFieldChange,
}: Pick<ActivityFormSectionsProps, "formData" | "onFieldChange">) {
  const [timeInput, setTimeInput] = React.useState("");
  const [timeError, setTimeError] = React.useState<string>("");

  const validateTime = (time: string): boolean => {
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    return timeRegex.test(time);
  };

  const parseTime = (time: string): number => {
    const [hours, minutes] = time.split(":").map(Number);
    return hours * 60 + minutes; // Convert to minutes since midnight
  };

  const formatTime = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, "0")}:${mins
      .toString()
      .padStart(2, "0")}`;
  };

  const handleAddTime = () => {
    const trimmedTime = timeInput.trim();
    setTimeError("");

    // Check if duration is set first
    if (!formData.duration || formData.duration.trim() === "") {
      setTimeError("Please enter activity duration first");
      return;
    }

    if (!trimmedTime) {
      setTimeError("Please enter a time");
      return;
    }

    if (!validateTime(trimmedTime)) {
      setTimeError("Invalid time format. Use HH:MM (e.g., 09:00)");
      return;
    }

    if (formData.availableTimeSlots.includes(trimmedTime)) {
      setTimeError("This time slot already exists");
      return;
    }

    // Get duration in minutes
    const durationMinutes = parseInt(formData.duration, 10);
    if (isNaN(durationMinutes) || durationMinutes <= 0) {
      setTimeError("Please enter a valid duration first");
      return;
    }
    const bufferMinutes = 10;
    const minInterval = durationMinutes + bufferMinutes;

    // Check interval with existing slots
    const newTimeMinutes = parseTime(trimmedTime);
    const sortedSlots = [...formData.availableTimeSlots].sort();

    // Check if new time conflicts with existing slots
    for (const existingTime of sortedSlots) {
      const existingTimeMinutes = parseTime(existingTime);
      const timeDiff = Math.abs(newTimeMinutes - existingTimeMinutes);

      // If times are too close (less than minInterval apart)
      if (timeDiff < minInterval && timeDiff > 0) {
        const nextAvailableTime = existingTimeMinutes + minInterval;
        if (nextAvailableTime >= 24 * 60) {
          setTimeError(
            `Time must be at least ${minInterval} minutes after ${existingTime} (would exceed 24:00)`
          );
        } else {
          setTimeError(
            `Time must be at least ${minInterval} minutes (${durationMinutes}min activity + ${bufferMinutes}min buffer) after ${existingTime}. Next available: ${formatTime(
              nextAvailableTime
            )}`
          );
        }
        return;
      }
    }

    // Check if new time is before an existing slot (need to check reverse)
    for (const existingTime of sortedSlots) {
      const existingTimeMinutes = parseTime(existingTime);
      if (newTimeMinutes < existingTimeMinutes) {
        const timeDiff = existingTimeMinutes - newTimeMinutes;
        if (timeDiff < minInterval) {
          setTimeError(
            `Time must be at least ${minInterval} minutes before ${existingTime}. Use a time before ${formatTime(
              newTimeMinutes - minInterval < 0
                ? 0
                : newTimeMinutes - minInterval
            )} or after ${formatTime(existingTimeMinutes + minInterval)}`
          );
          return;
        }
      }
    }

    const newSlots = [...formData.availableTimeSlots, trimmedTime].sort();
    onFieldChange("availableTimeSlots", newSlots);
    setTimeInput("");
    setTimeError("");
  };

  const handleRemoveTime = (time: string) => {
    const newSlots = formData.availableTimeSlots.filter((t) => t !== time);
    onFieldChange("availableTimeSlots", newSlots);
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddTime();
    }
  };

  const isDurationSet =
    formData.duration &&
    formData.duration.trim() !== "" &&
    !isNaN(parseInt(formData.duration, 10)) &&
    parseInt(formData.duration, 10) > 0;

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-foreground">
        Available Time Slots
      </h3>
      <div className="space-y-2">
        <Label htmlFor="timeSlot">Time Slots (HH:MM format)</Label>
        {!isDurationSet && (
          <p className="text-xs text-muted-foreground p-3 bg-muted rounded-md">
            Please enter activity duration first before adding time slots.
          </p>
        )}
        <div className="flex gap-2">
          <Input
            id="timeSlot"
            type="time"
            value={timeInput}
            onChange={(e) => setTimeInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="09:00"
            className="flex-1"
            disabled={!isDurationSet}
          />
          <Button
            type="button"
            variant="outline"
            onClick={handleAddTime}
            disabled={
              !isDurationSet ||
              !timeInput.trim() ||
              !validateTime(timeInput.trim())
            }
          >
            <Plus className="h-4 w-4 mr-2" />
            Add
          </Button>
        </div>
        {timeError && (
          <p className="text-xs text-destructive flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            {timeError}
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          Define the available time slots for reservations. Time slots must be
          at least (activity duration + 10 minutes) apart. Max reservations per
          day equals the number of time slots.
        </p>
        {formData.availableTimeSlots.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {formData.availableTimeSlots.map((time) => (
              <div
                key={time}
                className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded-md"
              >
                <Clock className="h-3 w-3 text-muted-foreground" />
                <span className="text-sm">{time}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveTime(time)}
                  className="text-muted-foreground hover:text-destructive transition-colors"
                  aria-label={`Remove ${time}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function TagsEquipmentSection({
  formData,
  errors,
  onFieldChange,
  onFieldBlur,
}: Pick<
  ActivityFormSectionsProps,
  "formData" | "errors" | "onFieldChange" | "onFieldBlur"
>) {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-foreground">
        Tags & Equipment
      </h3>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="tags">
            Tags (comma separated) <span className="text-destructive">*</span>
          </Label>
          <Input
            id="tags"
            type="text"
            value={formData.tags}
            onChange={(e) => onFieldChange("tags", e.target.value)}
            onBlur={() => onFieldBlur("tags", formData.tags)}
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
        <div className="space-y-2">
          <Label htmlFor="equipment">Equipment (comma separated)</Label>
          <Input
            id="equipment"
            type="text"
            value={formData.equipment}
            onChange={(e) => onFieldChange("equipment", e.target.value)}
            placeholder="e.g., helmet, rope, backpack"
          />
          <p className="text-xs text-muted-foreground">
            Separate multiple items with commas
          </p>
        </div>
      </div>
    </div>
  );
}

export function ImagesSection({
  formData,
  onImageSelect,
  onRemoveImage,
  error,
}: Pick<
  ActivityFormSectionsProps,
  "formData" | "onImageSelect" | "onRemoveImage" | "error"
>) {
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const openFilePicker = () => fileInputRef.current?.click();

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-foreground">Images</h3>
      <div className="space-y-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={onImageSelect}
          className="sr-only"
          tabIndex={-1}
        />
        <div className="flex flex-col gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={openFilePicker}
            className="w-full sm:w-auto"
          >
            <Upload className="size-4 mr-2" /> Upload Images
          </Button>
          <p className="text-xs text-muted-foreground">
            Maximum file size: {MAX_IMAGE_UPLOAD_LABEL} per image
          </p>
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 border border-destructive/20">
              <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}
          {formData.images.length === 0 ? (
            <button
              type="button"
              onClick={openFilePicker}
              className={cn(
                "flex min-h-[220px] w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-muted-foreground/25 bg-muted/30 px-4 py-8 text-center text-muted-foreground transition-colors hover:border-muted-foreground/40 hover:bg-muted/50"
              )}
            >
              <ImageIcon className="size-10 opacity-50" aria-hidden />
              <span className="text-sm font-medium text-foreground">
                Image previews appear here
              </span>
              <span className="text-xs">
                Tap above or click this area to upload
              </span>
            </button>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {formData.images.map((src, idx) => (
                <Card
                  key={`${src}-${idx}`}
                  className="group relative w-full overflow-hidden border pt-0 pb-0"
                >
                  <CardContent className="p-0">
                    <div className="relative aspect-[4/3] w-full min-h-[200px]">
                      <Image
                        src={src}
                        alt={`Activity image ${idx + 1}`}
                        fill
                        sizes="(max-width: 640px) 100vw, 50vw"
                        className="object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                        }}
                      />
                      <div className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/20" />
                      <button
                        type="button"
                        onClick={() => onRemoveImage(idx)}
                        className="absolute top-2 right-2 rounded-full bg-destructive p-1.5 text-destructive-foreground opacity-0 shadow-lg transition-opacity hover:bg-destructive/90 group-hover:opacity-100"
                        aria-label={`Remove image ${idx + 1}`}
                      >
                        <X className="size-4" />
                      </button>
                      <div className="absolute right-0 bottom-0 left-0 bg-linear-to-t from-black/60 to-transparent p-3">
                        <div className="flex items-center gap-1.5 text-xs text-white">
                          <ImageIcon className="size-3.5" />
                          <span>Image {idx + 1}</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
