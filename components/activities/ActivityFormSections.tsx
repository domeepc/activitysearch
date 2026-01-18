import React from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Upload, X, AlertCircle } from "lucide-react";
import {
  AddressAutocomplete,
  AddressCoordinates,
} from "@/components/ui/address-autocomplete";
import { cn } from "@/lib/utils";
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
            Price (HRK) <span className="text-destructive">*</span>
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
}: Pick<
  ActivityFormSectionsProps,
  "formData" | "onImageSelect" | "onRemoveImage"
>) {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-foreground">Images</h3>
      <div className="space-y-2">
        <input
          id="images-upload"
          type="file"
          accept="image/*"
          multiple
          onChange={onImageSelect}
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
                    onClick={() => onRemoveImage(idx)}
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
  );
}
