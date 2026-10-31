"use client";

import React, { useState, useEffect, useMemo, Suspense } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { usePostHog } from "@posthog/react";
import { Id } from "@/convex/_generated/dataModel";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { validateOrganisationField, validateEmail } from "@/lib/validation";
import { extractErrorMessage } from "@/lib/errors";
import { SIGNED_IN_HOME_HREF } from "@/lib/routes";
import ActivityListSection from "@/components/organisation/activityListSection";
import { StripeConnectButton } from "@/components/organisation/StripeConnectButton";
import DialogAddActivity from "@/components/activities/DialogAddActivity";
import { useAction } from "convex/react";
import { Building2, Pencil, Plus } from "lucide-react";
import { OrganiserNav } from "@/components/organisation/OrganiserNav";
import { OrganiserStats } from "@/components/organisation/OrganiserStats";

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 py-3">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="text-sm text-zinc-700 dark:text-zinc-300">{value}</span>
    </div>
  );
}

function EditRow({
  label,
  children,
  error,
}: {
  label: string;
  children: React.ReactNode;
  error?: string;
}) {
  return (
    <div className="py-3 space-y-2">
      <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </label>
      {children}
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}

export default function MyOrganisationPage() {
  const router = useRouter();
  const posthog = usePostHog();
  const { isSignedIn, isLoaded: clerkLoaded } = useUser();
  const [isEditing, setIsEditing] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingActivityId, setEditingActivityId] = useState<Id<"activities"> | null>(null);
  const [errors, setErrors] = useState({ name: "", email: "", address: "", IBAN: "" });

  const currentUser = useQuery(api.users.current);
  const organisation = useQuery(
    api.organisation.getOrganisationByOwnerId,
    currentUser?._id ? { ownerId: currentUser._id as Id<"users"> } : "skip"
  );
  const updateOrganisation = useMutation(api.organisation.updateOrganisation);
  const updateStripeAccount = useAction(api.stripe.updateStripeAccountFromOrganisation);

  const isOrganiser = currentUser?.role === "organiser";

  const organisationFormData = useMemo(
    () => ({
      name: organisation?.organisationName || "",
      email: organisation?.organisationEmail || "",
      description: organisation?.description || "",
      address: organisation?.address || "",
      IBAN: organisation?.IBAN || "",
    }),
    [organisation]
  );

  const [editedFormData, setEditedFormData] = useState(() => organisationFormData);
  const formData = isEditing ? editedFormData : organisationFormData;

  useEffect(() => {
    if (clerkLoaded && !isSignedIn) router.push("/sign-in");
  }, [clerkLoaded, isSignedIn, router]);

  const validateField = (name: string, value: string) => {
    const error = validateOrganisationField(name, value);
    setErrors((prev) => ({ ...prev, [name]: error }));
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setEditedFormData((prev) => ({ ...prev, [name]: value }));
    if (name === "name" || name === "email" || name === "address" || name === "IBAN") {
      validateField(name, value);
    }
  };

  const handleCancel = () => {
    setEditedFormData(organisationFormData);
    setErrors({ name: "", email: "", address: "", IBAN: "" });
    setIsEditing(false);
  };

  const handleSave = async () => {
    if (!organisation) return;
    const newErrors = { name: "", email: "", address: "", IBAN: "" };
    if (!formData.name.trim()) newErrors.name = "Organisation name is required";
    if (!formData.email.trim()) newErrors.email = "Email is required";
    else if (!validateEmail(formData.email)) newErrors.email = "Please enter a valid email";
    if (!formData.address.trim()) newErrors.address = "Address is required";
    if (!formData.IBAN.trim()) newErrors.IBAN = "IBAN is required";
    setErrors(newErrors);
    if (newErrors.name || newErrors.email || newErrors.address || newErrors.IBAN) return;

    try {
      await updateOrganisation({
        organisationId: organisation._id,
        name: formData.name,
        email: formData.email,
        description: formData.description,
        address: formData.address,
        IBAN: formData.IBAN,
      });
      if (organisation.stripeAccountId) {
        try {
          await updateStripeAccount({ organisationId: organisation._id });
        } catch (stripeError) {
          console.error("Failed to sync to Stripe:", stripeError);
        }
      }
      posthog?.capture("organisation_updated", {
        organisation_id: String(organisation._id),
        organisation_name: formData.name,
      });
      setIsEditing(false);
      setErrors({ name: "", email: "", address: "", IBAN: "" });
    } catch (error: unknown) {
      console.error("Failed to update organisation:", extractErrorMessage(error));
    }
  };

  const hasErrors = !!(errors.name || errors.email || errors.address || errors.IBAN);

  // Loading
  if (currentUser === undefined || organisation === undefined) {
    return (
      <div className="mx-auto w-full max-w-7xl p-4 md:p-6">
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-sm">
          <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 px-5 py-4 md:px-6">
            <div className="space-y-2">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-32" />
            </div>
            <Skeleton className="h-8 w-28 rounded-xl" />
          </div>
          <div className="space-y-0 divide-y divide-zinc-100 dark:divide-zinc-800 px-5 py-2 md:px-6">
            {["w-40", "w-36", "w-48", "w-32", "w-28"].map((w, i) => (
              <div key={i} className="flex gap-4 py-3">
                <Skeleton className="h-3 w-28 shrink-0" />
                <Skeleton className={`h-4 ${w}`} />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!clerkLoaded) return null;
  if (!isSignedIn) return null;

  if (currentUser !== null && !isOrganiser) {
    return (
      <div className="mx-auto w-full max-w-7xl p-4 md:p-6">
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-sm p-6 text-center space-y-3">
          <p className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Access Denied</p>
          <p className="text-sm text-muted-foreground">You must be an organiser to access this page.</p>
          <Button size="sm" onClick={() => router.push(SIGNED_IN_HOME_HREF)}>
            Go to Home
          </Button>
        </div>
      </div>
    );
  }

  if (currentUser === null && isSignedIn) {
    return (
      <div className="mx-auto w-full max-w-7xl p-4 md:p-6">
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-sm p-6 text-center space-y-3">
          <p className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Setting Up</p>
          <p className="text-sm text-muted-foreground">Your account is being set up. Please wait a moment and refresh.</p>
          <Button size="sm" onClick={() => router.push(SIGNED_IN_HOME_HREF)}>
            Go to Home
          </Button>
        </div>
      </div>
    );
  }

  if (organisation === null) {
    return (
      <div className="mx-auto w-full max-w-7xl p-4 md:p-6">
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-sm p-6 text-center space-y-3">
          <p className="text-base font-semibold text-zinc-900 dark:text-zinc-50">No Organisation Found</p>
          <p className="text-sm text-muted-foreground">You don&apos;t have an organisation associated with your account.</p>
          <Button size="sm" onClick={() => router.push(SIGNED_IN_HOME_HREF)}>
            Go to Home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-6 md:px-6 md:py-8">
      <Suspense fallback={null}>
        <OrganiserNav />
      </Suspense>

      <header className="flex flex-wrap items-end gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-sm text-muted-foreground">Organiser dashboard</p>
          <h1 className="truncate text-2xl font-bold tracking-tight md:text-3xl">
            {organisation.organisationName}
          </h1>
        </div>
        <Button
          className="h-10 bg-blue-600 font-semibold text-white hover:bg-blue-700"
          onClick={() => {
            setEditingActivityId(null);
            setEditDialogOpen(true);
          }}
        >
          <Plus className="size-4" aria-hidden="true" />
          New activity
        </Button>
      </header>

      <OrganiserStats activityIDs={organisation.activityIDs || []} />

      <div className="flex flex-wrap items-start gap-5">
        <div className="min-w-0 flex-[999_1_560px]">
          <ActivityListSection
            activityIDs={organisation.activityIDs || []}
            onEdit={(id) => {
              setEditingActivityId(id as Id<"activities">);
              setEditDialogOpen(true);
            }}
          />
        </div>
        <aside className="flex min-w-0 flex-[1_1_360px] flex-col gap-5">
          <StripeConnectButton organisationId={organisation._id} />
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-sm">
            {/* Header */}
            <div className="flex flex-col gap-3 border-b border-zinc-100 dark:border-zinc-800 px-5 py-4 sm:flex-row sm:items-center sm:justify-between md:px-6">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <div>
                  <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Organisation details</h2>
                  <p className="text-xs text-muted-foreground">Manage your organisation information</p>
                </div>
              </div>
              <div className="flex gap-2">
                {isEditing ? (
                  <>
                    <Button size="sm" variant="outline" onClick={handleCancel}>
                      Cancel
                    </Button>
                    <Button size="sm" onClick={handleSave} disabled={hasErrors}>
                      Save Changes
                    </Button>
                  </>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    
                    onClick={() => { setEditedFormData(organisationFormData); setIsEditing(true); }}
                  >
                    <Pencil className="mr-2 h-3.5 w-3.5" />
                    Edit
                  </Button>
                )}
              </div>
            </div>

            {/* Fields */}
            <div className={`px-5 md:px-6 ${isEditing ? "py-4 space-y-0 divide-y divide-zinc-100 dark:divide-zinc-800" : "py-2 divide-y divide-zinc-100 dark:divide-zinc-800"}`}>
              {isEditing ? (
                <>
                  <EditRow label="Organisation Name" error={errors.name}>
                    <Input id="name" name="name" value={formData.name} onChange={handleChange} aria-invalid={!!errors.name} />
                  </EditRow>
                  <EditRow label="Email" error={errors.email}>
                    <Input id="email" name="email" type="email" value={formData.email} onChange={handleChange} aria-invalid={!!errors.email} />
                  </EditRow>
                  <EditRow label="Description">
                    <Textarea id="description" name="description" value={formData.description} onChange={handleChange} rows={4} className="resize-none" />
                  </EditRow>
                  <EditRow label="Address" error={errors.address}>
                    <Input id="address" name="address" value={formData.address} onChange={handleChange} aria-invalid={!!errors.address} />
                  </EditRow>
                  <EditRow label="IBAN" error={errors.IBAN}>
                    <Input id="IBAN" name="IBAN" value={formData.IBAN} onChange={handleChange} aria-invalid={!!errors.IBAN} />
                  </EditRow>
                </>
              ) : (
                <>
                  <InfoRow label="Name" value={formData.name || "No organisation name"} />
                  <InfoRow label="Email" value={formData.email || "No email"} />
                  <InfoRow label="Description" value={formData.description || "No description provided"} />
                  <InfoRow label="Address" value={formData.address || "No address"} />
                  <InfoRow label="IBAN" value={formData.IBAN || "No IBAN"} />
                </>
              )}
            </div>
          </div>
        </aside>
      </div>

      <DialogAddActivity
        showDialog={editDialogOpen}
        setShowDialog={(v) => { setEditDialogOpen(v); if (!v) setEditingActivityId(null); }}
        activityId={editingActivityId ?? undefined}
      />
    </div>
  );
}
