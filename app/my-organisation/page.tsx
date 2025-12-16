"use client";

import React, { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useRouter } from "next/navigation";
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

export default function MyOrganisationPage() {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [errors, setErrors] = useState({
    name: "",
    email: "",
    address: "",
    IBAN: "",
  });
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    description: "",
    address: "",
    IBAN: "",
  });

  const currentUser = useQuery(api.users.current);
  const organisation = useQuery(
    api.organisation.getOrganisationByOwnerId,
    currentUser?._id
      ? { ownerId: currentUser._id as Id<"users"> }
      : "skip"
  );
  const updateOrganisation = useMutation(api.organisation.updateOrganisation);

  const isOrganizer = currentUser?.role === "organizer";

  // Redirect if not authenticated
  useEffect(() => {
    if (currentUser === null) {
      router.push("/sign-in");
    }
  }, [currentUser, router]);

  // Load organization data into form
  useEffect(() => {
    if (organisation) {
      setFormData({
        name: organisation.organizationName || "",
        email: organisation.organizationEmail || "",
        description: organisation.description || "",
        address: organisation.address || "",
        IBAN: organisation.IBAN || "",
      });
    }
  }, [organisation]);

  const validateField = (name: string, value: string) => {
    const newErrors = { ...errors };

    if (name === "name" && !value.trim()) {
      newErrors.name = "Organization name is required";
    } else if (name === "name") {
      newErrors.name = "";
    }

    if (name === "email") {
      if (!value.trim()) {
        newErrors.email = "Email is required";
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        newErrors.email = "Please enter a valid email";
      } else {
        newErrors.email = "";
      }
    }

    if (name === "address" && !value.trim()) {
      newErrors.address = "Address is required";
    } else if (name === "address") {
      newErrors.address = "";
    }

    if (name === "IBAN" && !value.trim()) {
      newErrors.IBAN = "IBAN is required";
    } else if (name === "IBAN") {
      newErrors.IBAN = "";
    }

    setErrors(newErrors);
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    if (name === "name" || name === "email" || name === "address" || name === "IBAN") {
      validateField(name, value);
    }
  };

  const handleCancel = () => {
    if (organisation) {
      setFormData({
        name: organisation.organizationName || "",
        email: organisation.organizationEmail || "",
        description: organisation.description || "",
        address: organisation.address || "",
        IBAN: organisation.IBAN || "",
      });
    }
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
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
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
    if (newErrors.name || newErrors.email || newErrors.address || newErrors.IBAN) {
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
      setIsEditing(false);
      setErrors({ name: "", email: "", address: "", IBAN: "" });
    } catch (error: unknown) {
      console.error("Failed to update organization:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Failed to update organization";
      // You could set a general error state here if needed
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

  // Not authenticated or not an organizer
  if (currentUser === null || !isOrganizer) {
    return (
      <div className="container mx-auto p-4 md:p-6 max-w-4xl">
        <Card>
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>
              {currentUser === null
                ? "Please sign in to access this page."
                : "You must be an organizer to access this page."}
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
              You don't have an organization associated with your account.
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
    <div className="container mx-auto p-4 md:p-6 max-w-4xl">
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
                      errors.name || errors.email || errors.address || errors.IBAN
                        ? true
                        : false
                    }
                  >
                    Save Changes
                  </Button>
                </>
              ) : (
                <Button onClick={() => setIsEditing(true)}>
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
    </div>
  );
}

