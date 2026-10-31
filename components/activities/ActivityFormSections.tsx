import React from "react";
import Image from "next/image";
import { AlertCircle, ImagePlus, Plus, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { AddressAutocomplete, AddressCoordinates } from "@/components/ui/address-autocomplete";
import { cn, formatDuration } from "@/lib/utils";
import { MAX_IMAGE_UPLOAD_LABEL } from "@/lib/uploadLimits";
import { ActivityFormData, FormErrors } from "./ActivityFormTypes";

type FieldChange = <K extends keyof ActivityFormData>(field: K, value: ActivityFormData[K]) => void;
type FieldBlur = (field: keyof FormErrors, value: string | AddressCoordinates | null) => void;

/** Label + control + hint/error, the same everywhere in the form. */
function Field({
  id,
  label,
  optional,
  hint,
  error,
  className,
  children,
}: {
  id: string;
  label: string;
  optional?: boolean;
  hint?: React.ReactNode;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <label htmlFor={id} className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
        {label}
        {optional && <span className="font-normal text-zinc-500"> (optional)</span>}
      </label>
      {children}
      {error ? (
        <p role="alert" className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
          <AlertCircle className="size-3 shrink-0" />
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-zinc-600 dark:text-zinc-400">{hint}</p>
      ) : null}
    </div>
  );
}

/** Number input with a fixed unit on the left or right (€, min, people…). */
function UnitInput({
  id,
  unit,
  side = "right",
  error,
  ...props
}: React.ComponentProps<"input"> & { unit: string; side?: "left" | "right"; error?: boolean }) {
  return (
    <div className="relative">
      {side === "left" && (
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-500">{unit}</span>
      )}
      <Input
        id={id}
        type="number"
        inputMode="numeric"
        aria-invalid={error}
        className={cn("h-11 tabular-nums", side === "left" ? "pl-8" : "pr-16", error && "border-destructive")}
        {...props}
      />
      {side === "right" && (
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-zinc-500">{unit}</span>
      )}
    </div>
  );
}

function SectionTitle({ title, description }: { title: string; description?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">{title}</h3>
      {description && <p className="text-sm text-zinc-600 dark:text-zinc-400">{description}</p>}
    </div>
  );
}

function splitList(value: string) {
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function BasicInformationSection({
  formData,
  errors,
  onFieldChange,
  onFieldBlur,
}: {
  formData: ActivityFormData;
  errors: FormErrors;
  onFieldChange: FieldChange;
  onFieldBlur: FieldBlur;
}) {
  return (
    <section className="flex flex-col gap-4">
      <SectionTitle title="The basics" description="What people see first on the map and in search." />
      <Field id="activityName" label="Name" error={errors.activityName}>
        <Input
          id="activityName"
          value={formData.activityName}
          onChange={(e) => onFieldChange("activityName", e.target.value)}
          onBlur={() => onFieldBlur("activityName", formData.activityName)}
          placeholder="e.g. Sunset Sea Kayak Tour"
          className={cn("h-11", errors.activityName && "border-destructive")}
          aria-invalid={!!errors.activityName}
        />
      </Field>
      <Field
        id="description"
        label="Description"
        error={errors.description}
        hint={`${formData.description.length} characters · say what's included and who it's for`}
      >
        <Textarea
          id="description"
          rows={5}
          value={formData.description}
          onChange={(e) => onFieldChange("description", e.target.value)}
          onBlur={() => onFieldBlur("description", formData.description)}
          placeholder="Paddle along the coast at golden hour…"
          className={cn("min-h-32 resize-none", errors.description && "border-destructive")}
          aria-invalid={!!errors.description}
        />
      </Field>
    </section>
  );
}

export function LocationSection({
  formData,
  errors,
  onAddressChange,
  onAddressSelect,
}: {
  formData: ActivityFormData;
  errors: FormErrors;
  onAddressChange: (address: string) => void;
  onAddressSelect: (address: string, coords: AddressCoordinates) => void;
}) {
  return (
    <section className="flex flex-col gap-4">
      <SectionTitle title="Where it happens" />
      <Field
        id="address"
        label="Meeting point"
        hint={errors.address || errors.coordinates ? undefined : formData.coordinates ? "Pinned on the map" : "Pick a suggestion so we can pin it on the map"}
      >
        <AddressAutocomplete
          id="address"
          value={formData.address}
          onChange={onAddressChange}
          onSelect={onAddressSelect}
          placeholder="Start typing an address…"
          error={errors.address || errors.coordinates}
          required
        />
      </Field>
    </section>
  );
}

const LEVELS = [
  { value: "easy", label: "Easy", dot: "bg-green-600" },
  { value: "intermediate", label: "Intermediate", dot: "bg-amber-500" },
  { value: "hard", label: "Hard", dot: "bg-red-600" },
];

export function ActivityDetailsSection({
  formData,
  errors,
  selectedDifficulty,
  onFieldChange,
  onFieldBlur,
  onDifficultyChange,
}: {
  formData: ActivityFormData;
  errors: FormErrors;
  selectedDifficulty: string[];
  onFieldChange: FieldChange;
  onFieldBlur: FieldBlur;
  onDifficultyChange: (values: string[]) => void;
}) {
  const minutes = parseInt(formData.duration, 10);
  const people = parseInt(formData.maxParticipants, 10);
  const price = parseFloat(formData.price);
  return (
    <section className="flex flex-col gap-4">
      <SectionTitle title="Price & group" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          id="price"
          label="Price per booking"
          error={errors.price}
          hint={
            price > 0 && people > 0
              ? `Split by the team — about €${(price / people).toFixed(2)} each for ${people}`
              : "The team splits it between them"
          }
        >
          <UnitInput
            id="price"
            unit="€"
            side="left"
            step="0.01"
            min="0"
            inputMode="decimal"
            value={formData.price}
            onChange={(e) => onFieldChange("price", e.target.value)}
            onBlur={() => onFieldBlur("price", formData.price)}
            error={!!errors.price}
          />
        </Field>
        <Field id="duration" label="Duration" error={errors.duration} hint={minutes > 0 ? formatDuration(minutes) ?? undefined : "In minutes"}>
          <UnitInput
            id="duration"
            unit="min"
            min="0"
            step="5"
            value={formData.duration}
            onChange={(e) => onFieldChange("duration", e.target.value)}
            onBlur={() => onFieldBlur("duration", formData.duration)}
            error={!!errors.duration}
          />
        </Field>
        <Field id="maxParticipants" label="Max group size" error={errors.maxParticipants}>
          <UnitInput
            id="maxParticipants"
            unit="people"
            min="1"
            step="1"
            value={formData.maxParticipants}
            onChange={(e) => onFieldChange("maxParticipants", e.target.value)}
            onBlur={() => onFieldBlur("maxParticipants", formData.maxParticipants)}
            error={!!errors.maxParticipants}
          />
        </Field>
        <Field id="minAge" label="Minimum age" error={errors.minAge}>
          <UnitInput
            id="minAge"
            unit="years"
            min="12"
            step="1"
            value={formData.minAge}
            onChange={(e) => onFieldChange("minAge", e.target.value)}
            onBlur={() => onFieldBlur("minAge", formData.minAge)}
            error={!!errors.minAge}
          />
        </Field>
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium text-zinc-900 dark:text-zinc-50">Level</legend>
        <div id="difficulty" role="radiogroup" aria-label="Level" className="grid grid-cols-3 gap-2">
          {LEVELS.map((l) => {
            const on = selectedDifficulty[0] === l.value || formData.difficulty === l.value;
            return (
              <button
                key={l.value}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => onDifficultyChange([l.value])}
                className={cn(
                  "inline-flex h-11 items-center justify-center gap-2 rounded-xl border text-sm font-medium transition-colors",
                  on
                    ? "border-blue-600 bg-blue-50 text-zinc-900 ring-1 ring-blue-600 dark:bg-blue-950/40 dark:text-zinc-50"
                    : "border-zinc-200 bg-white hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
                )}
              >
                <span className={cn("size-2 rounded-full", l.dot)} aria-hidden="true" />
                {l.label}
              </button>
            );
          })}
        </div>
        {errors.difficulty && (
          <p role="alert" className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
            <AlertCircle className="size-3" />
            {errors.difficulty}
          </p>
        )}
      </fieldset>
    </section>
  );
}

export function TimeSlotsSection({
  formData,
  onFieldChange,
}: {
  formData: ActivityFormData;
  onFieldChange: FieldChange;
}) {
  const [timeInput, setTimeInput] = React.useState("");
  const [timeError, setTimeError] = React.useState("");

  const toMinutes = (time: string) => {
    const [h, m] = time.split(":").map(Number);
    return h * 60 + m;
  };
  const toTime = (mins: number) =>
    `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;

  const duration = parseInt(formData.duration, 10);
  const hasDuration = duration > 0;
  const gap = duration + 10; // activity length + 10 min turnover

  const addTime = () => {
    const time = timeInput.trim();
    setTimeError("");
    if (!/^([01]?\d|2[0-3]):[0-5]\d$/.test(time)) {
      setTimeError("Use a time like 09:00");
      return;
    }
    if (formData.availableTimeSlots.includes(time)) {
      setTimeError("That time is already added");
      return;
    }
    const t = toMinutes(time);
    const clash = formData.availableTimeSlots.find((s) => Math.abs(toMinutes(s) - t) < gap);
    if (clash) {
      const after = toMinutes(clash) + gap;
      setTimeError(
        `Too close to ${clash} — slots need ${gap} min between starts (${duration} min + 10 min turnover).` +
          (after < 24 * 60 ? ` Next free start: ${toTime(after)}.` : "")
      );
      return;
    }
    onFieldChange("availableTimeSlots", [...formData.availableTimeSlots, time].sort());
    setTimeInput("");
  };

  return (
    <section className="flex flex-col gap-4">
      <SectionTitle
        title="Start times"
        description="Each start time is one booking per day. Slots need the activity's length plus 10 minutes between them."
      />
      {!hasDuration ? (
        <p className="rounded-xl bg-zinc-50 p-3 text-sm text-zinc-600 dark:bg-zinc-800/60 dark:text-zinc-400">
          Set the duration above first.
        </p>
      ) : (
        <div className="flex gap-2">
          <Input
            id="timeSlot"
            type="time"
            aria-label="Start time"
            value={timeInput}
            onChange={(e) => {
              setTimeInput(e.target.value);
              setTimeError("");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addTime();
              }
            }}
            className="h-11 max-w-40 tabular-nums"
          />
          <Button type="button" variant="outline" className="h-11" onClick={addTime} disabled={!timeInput}>
            <Plus /> Add time
          </Button>
        </div>
      )}
      {timeError && (
        <p role="alert" className="flex items-start gap-1 text-xs text-red-600 dark:text-red-400">
          <AlertCircle className="mt-0.5 size-3 shrink-0" />
          {timeError}
        </p>
      )}
      {formData.availableTimeSlots.length > 0 ? (
        <ul className="flex flex-wrap gap-2" aria-label="Start times">
          {formData.availableTimeSlots.map((time) => (
            <li
              key={time}
              className="inline-flex h-9 items-center gap-2 rounded-xl border border-zinc-200 bg-white pl-3 pr-1 text-sm font-medium tabular-nums dark:border-zinc-800 dark:bg-zinc-900"
            >
              {time}
              {hasDuration && (
                <span className="text-xs font-normal text-zinc-500">–{toTime((toMinutes(time) + duration) % (24 * 60))}</span>
              )}
              <button
                type="button"
                onClick={() =>
                  onFieldChange(
                    "availableTimeSlots",
                    formData.availableTimeSlots.filter((t) => t !== time)
                  )
                }
                className="inline-flex size-7 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 hover:text-red-600 dark:hover:bg-zinc-800"
                aria-label={`Remove ${time}`}
              >
                <X className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      ) : hasDuration ? (
        <p className="text-xs text-zinc-600 dark:text-zinc-400">No start times yet — add at least one so teams can book.</p>
      ) : null}
    </section>
  );
}

function ChipPreview({ items }: { items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {items.map((t) => (
        <span key={t} className="rounded-full bg-zinc-100 px-2 py-1 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
          {t}
        </span>
      ))}
    </div>
  );
}

export function TagsEquipmentSection({
  formData,
  errors,
  onFieldChange,
  onFieldBlur,
}: {
  formData: ActivityFormData;
  errors: FormErrors;
  onFieldChange: FieldChange;
  onFieldBlur: FieldBlur;
}) {
  return (
    <section className="flex flex-col gap-4">
      <SectionTitle title="Tags & gear" />
      <Field id="tags" label="Tags" error={errors.tags} hint="Separate with commas — they power search and filters">
        <Input
          id="tags"
          value={formData.tags}
          onChange={(e) => onFieldChange("tags", e.target.value)}
          onBlur={() => onFieldBlur("tags", formData.tags)}
          placeholder="Water sports, Sunset, Beginner friendly"
          className={cn("h-11", errors.tags && "border-destructive")}
          aria-invalid={!!errors.tags}
        />
      </Field>
      <ChipPreview items={splitList(formData.tags)} />
      <Field id="equipment" label="What to bring" optional hint="Separate with commas">
        <Input
          id="equipment"
          value={formData.equipment}
          onChange={(e) => onFieldChange("equipment", e.target.value)}
          placeholder="Swimwear, Towel, Sunscreen"
          className="h-11"
        />
      </Field>
      <ChipPreview items={splitList(formData.equipment)} />
    </section>
  );
}

export function ImagesSection({
  formData,
  onImageSelect,
  onRemoveImage,
  error,
}: {
  formData: ActivityFormData;
  onImageSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveImage: (idx: number) => void;
  error?: string;
}) {
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const pick = () => fileInputRef.current?.click();

  return (
    <section className="flex flex-col gap-4">
      <SectionTitle title="Photos" description={`The first photo is the cover. Up to ${MAX_IMAGE_UPLOAD_LABEL} each.`} />
      <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={onImageSelect} className="sr-only" tabIndex={-1} />
      {error && (
        <p role="alert" className="flex items-center gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300">
          <AlertCircle className="size-4 shrink-0" />
          {error}
        </p>
      )}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {formData.images.map((src, idx) => (
          <div key={`${src}-${idx}`} className="group relative aspect-[4/3] overflow-hidden rounded-xl bg-zinc-100 dark:bg-zinc-800">
            <Image src={src} alt={`Photo ${idx + 1}`} fill sizes="(min-width: 640px) 220px, 50vw" className="object-cover" />
            {idx === 0 && (
              <span className="absolute left-2 top-2 rounded-full bg-white/95 px-2 py-1 text-xs font-semibold text-zinc-900 shadow-sm">
                Cover
              </span>
            )}
            <button
              type="button"
              onClick={() => onRemoveImage(idx)}
              className="absolute right-2 top-2 inline-flex size-8 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur transition-opacity hover:bg-black/75 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
              aria-label={`Remove photo ${idx + 1}`}
            >
              <X className="size-4" />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={pick}
          className={cn(
            "flex aspect-[4/3] flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-zinc-300 text-sm text-zinc-600 transition-colors hover:border-blue-500 hover:bg-blue-50/50 hover:text-blue-700 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-blue-950/30",
            formData.images.length === 0 && "col-span-2 aspect-auto py-12 sm:col-span-3"
          )}
        >
          <ImagePlus className="size-6" aria-hidden="true" />
          <span className="font-medium">{formData.images.length === 0 ? "Add photos" : "Add more"}</span>
        </button>
      </div>
    </section>
  );
}
