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

export default function DialogAddActivityMobile({
  showDialog,
  setShowDialog,
}: {
  showDialog: boolean;
  setShowDialog: Dispatch<React.SetStateAction<boolean>>;
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
  } = useActivityForm({
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
    <div className="md:hidden">
      <Dialog open={showDialog} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] overflow-y-auto p-4">
          <DialogHeader className="space-y-2 pb-4">
            <DialogTitle className="text-xl">Add New Activity</DialogTitle>
            <DialogDescription className="text-sm">
              Fill in all required fields. Fields marked with * are required.
            </DialogDescription>
          </DialogHeader>

          <div className="py-2">
            <Stepper steps={steps} currentStep={currentStep} className="mb-4" />

            <div className="grid gap-4">
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

          <DialogFooter className="flex-col gap-2 pt-4 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowDialog(false)}
              disabled={isSubmitting}
              className="w-full rounded-full sm:w-auto"
            >
              Cancel
            </Button>
            {currentStep > 1 && (
              <Button
                type="button"
                variant="outline"
                onClick={() => setCurrentStep(currentStep - 1)}
                disabled={isSubmitting}
                className="w-full rounded-full sm:w-auto border-2 border-border"
              >
                Previous
              </Button>
            )}
            {currentStep < 3 ? (
              <Button
                type="button"
                onClick={() => setCurrentStep(currentStep + 1)}
                disabled={isSubmitting}
                className="w-full rounded-full sm:w-auto"
              >
                Next
              </Button>
            ) : (
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={!isFormValid()}
                className="w-full rounded-full sm:w-auto"
              >
                {isSubmitting ? "Creating..." : "Create Activity"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
