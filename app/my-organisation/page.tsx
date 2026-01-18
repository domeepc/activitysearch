"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { validateOrganizationField, validateEmail } from "@/lib/validation";
import { extractErrorMessage } from "@/lib/errors";
import ActivityListSection from "@/components/organisation/activityListSection";
import { StripeConnectButton } from "@/components/organisation/StripeConnectButton";
import { useAction } from "convex/react";

export default function MyOrganisationPage() {
  const router = useRouter();
  const { isSignedIn, isLoaded: clerkLoaded } = useUser();
  const [isEditing, setIsEditing] = useState(false);
  const [errors, setErrors] = useState({
    name: "",
    email: "",
    address: "",
    IBAN: "",
  });
  const currentUser = useQuery(api.users.current);
  const organisation = useQuery(
    api.organisation.getOrganisationByOwnerId,
    currentUser?._id ? { ownerId: currentUser._id as Id<"users"> } : "skip"
  );
  const updateOrganisation = useMutation(api.organisation.updateOrganisation);
  const updateStripeAccount = useAction(api.stripe.updateStripeAccountFromOrganization);

  const isOrganizer = currentUser?.role === "organiser";

  // Compute form data from organisation when not editing
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

  const [editedFormData, setEditedFormData] = useState(
    () => organisationFormData
  );

  // Use edited data when editing, otherwise use organisation data
  const formData = isEditing ? editedFormData : organisationFormData;

  // Redirect if not authenticated in Clerk (only redirect if Clerk has loaded and user is definitely not signed in)
  useEffect(() => {
    if (clerkLoaded && !isSignedIn) {
      router.push("/sign-in");
    }
  }, [clerkLoaded, isSignedIn, router]);

  const validateField = (name: string, value: string) => {
    const error = validateOrganizationField(name, value);
    setErrors((prev) => ({ ...prev, [name]: error }));
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setEditedFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    if (
      name === "name" ||
      name === "email" ||
      name === "address" ||
      name === "IBAN"
    ) {
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

    // Validate all required fields and collect errors
    const newErrors = {
      name: "",
      email: "",
      address: "",
      IBAN: "",
    };

    if (!formData.name.trim()) {
      newErrors.name = "Organization name is required";
    }

    if (!formData.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!validateEmail(formData.email)) {
      newErrors.email = "Please enter a valid email";
    }

    if (!formData.address.trim()) {
      newErrors.address = "Address is required";
    }

    if (!formData.IBAN.trim()) {
      newErrors.IBAN = "IBAN is required";
    }

    setErrors(newErrors);

    // Check if there are any errors
    if (
      newErrors.name ||
      newErrors.email ||
      newErrors.address ||
      newErrors.IBAN
    ) {
      return;
    }

    try {
      await updateOrganisation({
        organisationId: organisation._id,
        name: formData.name,
        email: formData.email,
        description: formData.description,
        address: formData.address,
        IBAN: formData.IBAN,
      });

      // Sync updates to Stripe if account exists
      if (organisation.stripeAccountId) {
        try {
          await updateStripeAccount({
            organisationId: organisation._id,
          });
          console.log("Stripe account synced successfully");
        } catch (stripeError) {
          console.error("Failed to sync to Stripe:", stripeError);
          // Don't fail the entire update if Stripe sync fails
          // User can manually update Stripe later if needed
        }
      }

      setIsEditing(false);
      setErrors({ name: "", email: "", address: "", IBAN: "" });
    } catch (error: unknown) {
      console.error("Failed to update organization:", error);
      const errorMessage = extractErrorMessage(error);
      // Could set a general error state here if needed
      console.error("Error message:", errorMessage);
    }
  };

  // Loading state
  if (currentUser === undefined || organisation === undefined) {
    return (
      <div className="container mx-auto p-4 md:p-6 max-w-4xl">
        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
              <div>
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-4 w-32 mt-2" />
              </div>
              <div className="flex gap-2">
                <Skeleton className="h-10 w-24" />
                <Skeleton className="h-10 w-24" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-6">
              <div className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-10 w-full" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-10 w-full" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-24 w-full" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-10 w-full" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-10 w-full" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Wait for Clerk to load before making decisions
  if (!clerkLoaded) {
    return (
      <div className="container mx-auto p-4 md:p-6 max-w-4xl">
        <Card>
          <CardContent className="flex items-center justify-center py-8">
            <div className="text-muted-foreground">Loading...</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Not authenticated in Clerk - redirect will happen in useEffect
  if (!isSignedIn) {
    return null;
  }

  // Wait for Convex user to load
  if (currentUser === undefined) {
    return (
      <div className="container mx-auto p-4 md:p-6 max-w-4xl">
        <Card>
          <CardContent className="flex items-center justify-center py-8">
            <div className="text-muted-foreground">Loading...</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Not an organiser (but authenticated)
  if (currentUser !== null && !isOrganizer) {
    return (
      <div className="container mx-auto p-4 md:p-6 max-w-4xl">
        <Card>
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>
              You must be an organiser to access this page.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push("/")}>Go to Home</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // User authenticated but not found in Convex (shouldn't happen normally, but handle gracefully)
  if (currentUser === null && isSignedIn) {
    return (
      <div className="container mx-auto p-4 md:p-6 max-w-4xl">
        <Card>
          <CardHeader>
            <CardTitle>Setting Up</CardTitle>
            <CardDescription>
              Your account is being set up. Please wait a moment and refresh the page.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push("/")}>Go to Home</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // No organization found
  if (organisation === null) {
    return (
      <div className="container mx-auto p-4 md:p-6 max-w-4xl">
        <Card>
          <CardHeader>
            <CardTitle>No Organization Found</CardTitle>
            <CardDescription>
              You don&apos;t have an organization associated with your account.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push("/")}>Go to Home</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-4xl space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
            <div>
              <CardTitle>My Organisation</CardTitle>
              <CardDescription>
                Manage your organization information
              </CardDescription>
            </div>
            <div className="flex gap-2">
              {isEditing ? (
                <>
                  <Button variant="outline" onClick={handleCancel}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSave}
                    disabled={
                      errors.name ||
                        errors.email ||
                        errors.address ||
                        errors.IBAN
                        ? true
                        : false
                    }
                  >
                    Save Changes
                  </Button>
                </>
              ) : (
                <Button
                  onClick={() => {
                    setEditedFormData(organisationFormData);
                    setIsEditing(true);
                  }}
                >
                  Edit Organisation
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-6">
            {/* Organization Name */}
            <div className="space-y-2">
              <Label htmlFor="name">Organization Name</Label>
              {isEditing ? (
                <>
                  <Input
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    aria-invalid={!!errors.name}
                  />
                  {errors.name && (
                    <p className="text-sm font-medium text-destructive">
                      {errors.name}
                    </p>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {formData.name || "No organization name"}
                </p>
              )}
            </div>

            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              {isEditing ? (
                <>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleChange}
                    aria-invalid={!!errors.email}
                  />
                  {errors.email && (
                    <p className="text-sm font-medium text-destructive">
                      {errors.email}
                    </p>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {formData.email || "No email"}
                </p>
              )}
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              {isEditing ? (
                <Textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  rows={4}
                  className="resize-none"
                />
              ) : (
                <p className="text-sm text-muted-foreground">
                  {formData.description || "No description provided"}
                </p>
              )}
            </div>

            {/* Address */}
            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              {isEditing ? (
                <>
                  <Input
                    id="address"
                    name="address"
                    value={formData.address}
                    onChange={handleChange}
                    aria-invalid={!!errors.address}
                  />
                  {errors.address && (
                    <p className="text-sm font-medium text-destructive">
                      {errors.address}
                    </p>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {formData.address || "No address"}
                </p>
              )}
            </div>

            {/* IBAN */}
            <div className="space-y-2">
              <Label htmlFor="IBAN">IBAN</Label>
              {isEditing ? (
                <>
                  <Input
                    id="IBAN"
                    name="IBAN"
                    value={formData.IBAN}
                    onChange={handleChange}
                    aria-invalid={!!errors.IBAN}
                  />
                  {errors.IBAN && (
                    <p className="text-sm font-medium text-destructive">
                      {errors.IBAN}
                    </p>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {formData.IBAN || "No IBAN"}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stripe Connect Section */}
      <StripeConnectButton organisationId={organisation._id} />

      <ActivityListSection activityIDs={organisation.activityIDs || []} />
    </div>
  );
}
