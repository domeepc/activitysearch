"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import React, { Dispatch, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Id } from "@/convex/_generated/dataModel";
import {
  BasicInformationSection,
  LocationSection,
  ActivityDetailsSection,
  TagsEquipmentSection,
  ImagesSection,
  TimeSlotsSection,
} from "@/components/activities/ActivityFormSections";
import { validateActivityField } from "@/lib/validation";
import { Stepper } from "@/components/ui/stepper";
import { useActivityForm } from "@/lib/hooks/useActivityForm";

const steps = [
  { label: "Basic Info" },
  { label: "Details" },
  { label: "Finalize" },
];

export default function DialogAddActivity({
  showDialog,
  setShowDialog,
  activityId,
}: {
  showDialog: boolean;
  setShowDialog: Dispatch<React.SetStateAction<boolean>>;
  activityId?: Id<"activities">;
}) {
  const {
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
    isFormValid,
    handleSubmit,
    resetForm,
    isEdit,
  } = useActivityForm({
    activityId,
    onSuccess: () => setShowDialog(false),
  });

  const handleOpenChange = useCallback(
    (open: boolean) => {
      setShowDialog(open);
      if (!open) resetForm();
    },
    [resetForm, setShowDialog]
  );

  return (
    <div className={isEdit ? "" : "hidden md:block"}>
      <Dialog open={showDialog} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {isEdit ? "Edit Activity" : "Add New Activity"}
            </DialogTitle>
            <DialogDescription>
              {isEdit
                ? "Update the activity details. Fields marked with * are required."
                : "Fill in all required fields to create a new activity. Fields marked with * are required."}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <Stepper steps={steps} currentStep={currentStep} className="mb-6" />

            <div className="grid gap-6">
              {currentStep === 1 && (
                <>
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
                </>
              )}

              {currentStep === 2 && (
                <>
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
                </>
              )}

              {currentStep === 3 && (
                <>
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
                </>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="border-border"
              onClick={() => setShowDialog(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            {currentStep > 1 && (
              <Button
                type="button"
                variant="outline"
                onClick={() => setCurrentStep(currentStep - 1)}
                disabled={isSubmitting}
                className="border-2 border-border"
              >
                Previous
              </Button>
            )}
            {currentStep < 3 ? (
              <Button
                type="button"
                onClick={() => setCurrentStep(currentStep + 1)}
                disabled={isSubmitting}
              >
                Next
              </Button>
            ) : (
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={!isFormValid()}
              >
                {isSubmitting
                  ? isEdit
                    ? "Saving..."
                    : "Creating..."
                  : isEdit
                    ? "Save"
                    : "Create Activity"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
