"use client";

import React, { Dispatch, useCallback } from "react";
import Image from "next/image";
import { Check, Loader2, MapPin } from "lucide-react";
import { Id } from "@/convex/_generated/dataModel";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  ActivityDetailsSection,
  BasicInformationSection,
  ImagesSection,
  LocationSection,
  TagsEquipmentSection,
  TimeSlotsSection,
} from "@/components/activities/ActivityFormSections";
import type { ActivityFormData, FormErrors } from "@/components/activities/ActivityFormTypes";
import { ADDRESS_DROPDOWN_ATTR } from "@/components/ui/address-autocomplete";
import { validateActivityField } from "@/lib/validation";
import { useActivityForm } from "@/lib/hooks/useActivityForm";
import { cn, formatDuration, formatPrice } from "@/lib/utils";

const STEPS: Array<{ label: string; hint: string; fields: Array<keyof FormErrors> }> = [
  { label: "Basics", hint: "Name, description, place", fields: ["activityName", "description", "address", "coordinates"] },
  { label: "Price & schedule", hint: "Price, group, start times", fields: ["price", "duration", "difficulty", "maxParticipants", "minAge"] },
  { label: "Photos & tags", hint: "Cover photo, tags, gear", fields: ["tags"] },
];

function stepErrors(formData: ActivityFormData) {
  return STEPS.map((s) =>
    s.fields.some((f) => !!validateActivityField(f, (f === "coordinates" ? formData.coordinates : formData[f as keyof ActivityFormData]) as string))
  );
}

/** Create or edit an activity. One responsive dialog for desktop and phones. */
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
    handleSubmit,
    resetForm,
    isEdit,
  } = useActivityForm({ activityId, onSuccess: () => setShowDialog(false) });

  const handleOpenChange = useCallback(
    (open: boolean) => {
      setShowDialog(open);
      if (!open) resetForm();
    },
    [resetForm, setShowDialog]
  );

  const onBlur = (field: keyof FormErrors, value: Parameters<typeof validateActivityField>[1]) =>
    setErrors((prev) => ({ ...prev, [field]: validateActivityField(field, value) }));

  // Only flag a step once the organiser has touched (or tried to save) its fields.
  const flagged = STEPS.map((s) => s.fields.some((f) => !!errors[f]));
  const save = () => {
    const bad = stepErrors(formData).findIndex(Boolean);
    if (bad !== -1) setCurrentStep(bad + 1);
    void handleSubmit();
  };

  const price = parseFloat(formData.price);
  const minutes = parseInt(formData.duration, 10);
  const cover = formData.images[0];
  const isLast = currentStep === STEPS.length;

  return (
    <Dialog open={showDialog} onOpenChange={handleOpenChange}>
      <DialogContent
        className="flex max-h-[92dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-[960px]"
        onPointerDownOutside={(e) => {
          const target = e.detail.originalEvent.target as Element;
          if (target?.closest(`[${ADDRESS_DROPDOWN_ATTR}]`)) e.preventDefault();
        }}
      >
        <div className="flex min-h-0 flex-1">
          {/* Steps + live preview (desktop) */}
          <aside className="hidden w-72 shrink-0 flex-col gap-6 border-r border-zinc-100 bg-zinc-50 p-6 md:flex dark:border-zinc-800 dark:bg-zinc-950/40">
            <div aria-hidden="true">
              <p className="text-xl font-bold tracking-tight">{isEdit ? "Edit activity" : "New activity"}</p>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                {isEdit ? "Changes go live as soon as you save." : "Three short steps and it's on the map."}
              </p>
            </div>
            <ol className="flex flex-col gap-1">
              {STEPS.map((s, i) => {
                const n = i + 1;
                const active = n === currentStep;
                const done = n < currentStep && !flagged[i];
                return (
                  <li key={s.label}>
                    <button
                      type="button"
                      onClick={() => setCurrentStep(n)}
                      aria-current={active ? "step" : undefined}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-xl p-2 text-left transition-colors",
                        active ? "bg-white shadow-sm dark:bg-zinc-900" : "hover:bg-white/60 dark:hover:bg-zinc-900/60"
                      )}
                    >
                      <span
                        className={cn(
                          "inline-flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                          flagged[i]
                            ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
                            : done
                              ? "bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900"
                              : active
                                ? "bg-blue-600 text-white"
                                : "border border-zinc-300 text-zinc-500 dark:border-zinc-700"
                        )}
                      >
                        {flagged[i] ? "!" : done ? <Check className="size-4" strokeWidth={3} /> : n}
                      </span>
                      <span className="min-w-0">
                        <b className="block text-sm font-semibold">{s.label}</b>
                        <span className="block truncate text-xs text-zinc-500">
                          {flagged[i] ? "Needs attention" : s.hint}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>

            <div className="mt-auto flex flex-col gap-2">
              <span className="text-xs font-medium text-zinc-500">Preview</span>
              <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
                <div className="relative h-28 bg-gradient-to-br from-blue-100 to-cyan-50 dark:from-zinc-800 dark:to-zinc-900">
                  {cover && <Image src={cover} alt="" fill sizes="288px" className="object-cover" />}
                </div>
                <div className="flex flex-col gap-1 p-3">
                  <b className="line-clamp-2 text-sm leading-snug">{formData.activityName || "Your activity name"}</b>
                  <span className="flex items-center gap-1 truncate text-xs text-zinc-500">
                    <MapPin className="size-3 shrink-0" />
                    <span className="truncate">{formData.address || "Meeting point"}</span>
                  </span>
                  <span className="text-xs text-zinc-600 dark:text-zinc-400">
                    {price > 0 ? `${formatPrice(price)} per booking` : "Price"}
                    {minutes > 0 ? ` · ${formatDuration(minutes)}` : ""}
                  </span>
                </div>
              </div>
            </div>
          </aside>

          {/* Form */}
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="border-b border-zinc-100 px-5 pb-4 pt-5 pr-12 md:sr-only dark:border-zinc-800">
              <DialogTitle className="text-lg">{isEdit ? "Edit activity" : "New activity"}</DialogTitle>
              <DialogDescription className="mt-1">
                Step {currentStep} of {STEPS.length} · {STEPS[currentStep - 1].label}
              </DialogDescription>
              <div className="mt-3 grid grid-cols-3 gap-1" aria-hidden="true">
                {STEPS.map((s, i) => (
                  <span
                    key={s.label}
                    className={cn(
                      "h-1 rounded-full",
                      flagged[i] ? "bg-red-500" : i < currentStep ? "bg-blue-600" : "bg-zinc-200 dark:bg-zinc-800"
                    )}
                  />
                ))}
              </div>
            </div>

            <div key={currentStep} className="flex min-h-0 flex-1 flex-col gap-8 overflow-y-auto p-5 animate-in fade-in-0 slide-in-from-right-2 duration-200 sm:p-6 md:pt-8">
              {currentStep === 1 && (
                <>
                  <BasicInformationSection formData={formData} errors={errors} onFieldChange={updateField} onFieldBlur={onBlur} />
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
                    onFieldBlur={onBlur}
                    onDifficultyChange={handleDifficultyChange}
                  />
                  <TimeSlotsSection formData={formData} onFieldChange={updateField} />
                </>
              )}
              {currentStep === 3 && (
                <>
                  <ImagesSection formData={formData} onImageSelect={handleImageSelect} onRemoveImage={removeImage} error={imageError} />
                  <TagsEquipmentSection formData={formData} errors={errors} onFieldChange={updateField} onFieldBlur={onBlur} />
                </>
              )}
            </div>

            <div className="flex items-center gap-2 border-t border-zinc-100 bg-white px-5 py-4 sm:px-6 dark:border-zinc-800 dark:bg-zinc-900">
              {currentStep > 1 ? (
                <Button type="button" variant="ghost" className="h-10" onClick={() => setCurrentStep(currentStep - 1)} disabled={isSubmitting}>
                  Back
                </Button>
              ) : (
                <Button type="button" variant="ghost" className="h-10" onClick={() => handleOpenChange(false)} disabled={isSubmitting}>
                  Cancel
                </Button>
              )}
              <div className="ml-auto flex gap-2">
                {isEdit && !isLast && (
                  <Button type="button" variant="outline" className="h-10" onClick={save} disabled={isSubmitting}>
                    Save
                  </Button>
                )}
                {isLast ? (
                  <Button type="button" className="h-10 bg-blue-600 px-5 font-semibold text-white hover:bg-blue-700" onClick={save} disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="animate-spin" />}
                    {isSubmitting ? (isEdit ? "Saving…" : "Publishing…") : isEdit ? "Save changes" : "Publish activity"}
                  </Button>
                ) : (
                  <Button type="button" className="h-10 px-5 font-semibold" onClick={() => setCurrentStep(currentStep + 1)} disabled={isSubmitting}>
                    Next
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
