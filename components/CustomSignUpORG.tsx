"use client";
import { useState } from "react";
import { useSignUp } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useMutation, useAction } from "convex/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { OAuthButtons } from "@/components/auth/OAuthButtons";
import { EmailVerificationDialog } from "@/components/auth/EmailVerificationDialog";
import { Stepper } from "@/components/ui/stepper";
import { api } from "@/convex/_generated/api";
import { validateEmail, validateIBAN, validateContact } from "@/lib/validation";
import { handleOAuthRedirect } from "@/lib/auth/oauth";
import { extractErrorMessage } from "@/lib/errors";
import { cn } from "@/lib/utils";
import { Eye, EyeOff, ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DateOfBirthCalendar } from "@/components/ui/date-of-birth-calendar";
import { format } from "date-fns";

const STEPS = [
  { label: "Personal Info", description: "Your account details" },
  { label: "Organization", description: "Organization details" },
  { label: "Business Info", description: "Business & payment" },
  { label: "Review", description: "Review & create" },
];

export default function CustomSignUpORG() {
  const { isLoaded, signUp, setActive } = useSignUp();
  const createOrganisation = useMutation(api.organisation.createOrganisation);
  const createStripeAccount = useAction(api.stripe.createConnectAccountWithDetails);

  // Form state
  const [currentPage, setCurrentPage] = useState(0);
  const [direction, setDirection] = useState<"forward" | "backward">("forward");
  const [isInitialRender, setIsInitialRender] = useState(true);
  const [userEmail, setUserEmail] = useState("");
  const [organizationEmail, setOrganizationEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [username, setUsername] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  // Stripe address fields
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [IBAN, setIBAN] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [organizationDescription, setOrganizationDescription] = useState("");
  const [contact, setContact] = useState("");
  const [country] = useState("HR"); // Always Croatia
  const [taxId, setTaxId] = useState("");
  // Additional Stripe required fields
  const [dateOfBirth, setDateOfBirth] = useState<Date | undefined>(undefined);
  const [businessWebsite, setBusinessWebsite] = useState("");
  const [industry, setIndustry] = useState("");
  const [tosAccepted, setTosAccepted] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // Page validation functions
  const validatePage1 = (): string | null => {
    if (!username || username.trim().length < 2) {
      return "Username must be at least 2 characters";
    }
    if (!firstName || firstName.trim().length < 1) {
      return "First name is required";
    }
    if (!lastName || lastName.trim().length < 1) {
      return "Last name is required";
    }
    if (!userEmail || !validateEmail(userEmail)) {
      return "Please enter a valid user email address";
    }
    if (!password || password.length < 8) {
      return "Password must be at least 8 characters long";
    }
    if (password !== confirmPassword) {
      return "Passwords do not match";
    }
    return null;
  };

  const validatePage2 = (): string | null => {
    if (!organizationName || organizationName.trim().length < 2) {
      return "Organization name must be at least 2 characters long";
    }
    if (organizationName.length > 100) {
      return "Organization name must be less than 100 characters";
    }
    if (!organizationEmail || !validateEmail(organizationEmail)) {
      return "Please enter a valid organization email address";
    }
    if (userEmail === organizationEmail) {
      return "User email and organization email must be different";
    }
    if (!organizationDescription || organizationDescription.trim().length < 10) {
      return "Please enter an organization description (at least 10 characters)";
    }
    if (!addressLine1 || addressLine1.trim().length < 3) {
      return "Please enter a street address";
    }
    if (!city || city.trim().length < 2) {
      return "Please enter a city";
    }
    if (!state || state.trim().length < 2) {
      return "Please enter a state/region";
    }
    if (!postalCode || postalCode.trim().length < 3) {
      return "Please enter a postal code";
    }
    if (!country || country.trim().length === 0) {
      return "Please select a country";
    }
    return null;
  };

  const validatePage3 = (): string | null => {
    if (!taxId || taxId.trim().length < 2) {
      return "Please enter a valid Tax ID/VAT number";
    }
    // Website is optional, but if provided, validate it's a proper URL
    if (businessWebsite && businessWebsite.trim()) {
      try {
        new URL(businessWebsite);
      } catch {
        return "Please enter a valid website URL (e.g., https://www.example.com)";
      }
    }
    if (!industry || industry.trim().length === 0) {
      return "Please select an industry";
    }
    if (!contact || !validateContact(contact)) {
      return "Please enter a valid contact number in E.164 format (e.g., +1234567890)";
    }
    if (!IBAN || !validateIBAN(IBAN)) {
      return "Please enter a valid IBAN (e.g., DE89 3704 0044 0532 0130 00)";
    }
    if (!dateOfBirth) {
      return "Please enter date of birth for business representative";
    }
    // Validate date of birth format and age (must be 18+)
    const today = new Date();
    const age = today.getFullYear() - dateOfBirth.getFullYear();
    const monthDiff = today.getMonth() - dateOfBirth.getMonth();
    const actualAge = monthDiff < 0 || (monthDiff === 0 && today.getDate() < dateOfBirth.getDate()) ? age - 1 : age;
    if (actualAge < 18) {
      return "Business representative must be at least 18 years old";
    }
    return null;
  };

  const canProceedToNext = (): boolean => {
    if (currentPage === 0) return validatePage1() === null;
    if (currentPage === 1) return validatePage2() === null;
    if (currentPage === 2) return validatePage3() === null && tosAccepted;
    if (currentPage === 3) {
      // On review page, validate all pages
      return validatePage1() === null && validatePage2() === null && validatePage3() === null && tosAccepted;
    }
    return false;
  };

  const handleNext = () => {
    const validationError =
      currentPage === 0 ? validatePage1() :
        currentPage === 1 ? validatePage2() :
          currentPage === 2 ? validatePage3() :
            null;

    if (validationError) {
      setError(validationError);
      return;
    }

    setError("");
    if (currentPage < STEPS.length - 1) {
      setIsInitialRender(false);
      setDirection("forward");
      setCurrentPage(currentPage + 1);
    }
  };

  const handlePrevious = () => {
    setError("");
    if (currentPage > 0) {
      setIsInitialRender(false);
      setDirection("backward");
      setCurrentPage(currentPage - 1);
    }
  };

  const handleCreateAccount = async () => {
    if (!isLoaded) return;

    // Final validation
    const page1Error = validatePage1();
    const page2Error = validatePage2();
    const page3Error = validatePage3();

    if (page1Error || page2Error || page3Error) {
      setError(page1Error || page2Error || page3Error || "Please complete all fields");
      return;
    }

    setError("");
    setLoading(true);

    try {
      await signUp.create({
        emailAddress: userEmail,
        password,
        username,
        firstName,
        lastName,
      });

      // Send the email verification code
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });

      // Set verifying to true to show the verification form
      setVerifying(true);
    } catch (err: unknown) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoaded) return;

    setError("");
    setLoading(true);

    try {
      const completeSignUp = await signUp.attemptEmailAddressVerification({
        code,
      });

      if (completeSignUp.status === "complete") {
        await setActive({ session: completeSignUp.createdSessionId });

        // Wait for Clerk webhook to sync user to Convex
        const maxRetries = 10;
        const retryDelay = 500;
        let retryCount = 0;
        let orgCreated = false;

        while (retryCount < maxRetries && !orgCreated) {
          try {
            // Combine address fields for storage
            const fullAddress = `${addressLine1}${addressLine2 ? `, ${addressLine2}` : ""}, ${city}, ${state} ${postalCode}, ${country}`;

            const organisationId = await createOrganisation({
              name: organizationName,
              email: organizationEmail,
              address: fullAddress,
              IBAN,
              ownerExternalId: completeSignUp.createdUserId!,
              country,
              businessType: "company",
              taxId,
            });

            // Create Stripe Connect account with business details
            if (organisationId) {
              try {
                await createStripeAccount({
                  organisationId,
                  country,
                  businessType: "company",
                  email: organizationEmail,
                  businessName: organizationName,
                  businessDescription: organizationDescription,
                  taxId,
                  phone: contact,
                  addressLine1,
                  addressLine2,
                  city,
                  state,
                  postalCode,
                  dateOfBirth: dateOfBirth?.toISOString() || "",
                  businessWebsite,
                  industry,
                  firstName,
                  lastName,
                });
                console.log("Stripe account created successfully");
              } catch (stripeError) {
                console.error("Error creating Stripe account:", stripeError);
                const errorMessage = stripeError instanceof Error
                  ? stripeError.message
                  : "Failed to create Stripe account";
                setError(`Account created but Stripe setup failed: ${errorMessage}. You can set up Stripe later from your organization page.`);
                // Continue anyway - user can set up Stripe later
              }
            }
            orgCreated = true;
          } catch (orgError: unknown) {
            const error = orgError as { message?: string };
            if (
              error.message?.includes("User not found") &&
              retryCount < maxRetries - 1
            ) {
              retryCount++;
              await new Promise((resolve) => setTimeout(resolve, retryDelay));
            } else {
              console.error("Failed to create organization:", error);
              setError(
                "Account created but organization setup failed. Please contact support or try creating an organization from your profile."
              );
              setLoading(false);
              setTimeout(() => router.push("/"), 2000);
              return;
            }
          }
        }

        if (!orgCreated) {
          setError(
            "Account created but organization setup is taking longer than expected. You can create it from your profile."
          );
          setTimeout(() => router.push("/"), 2000);
          return;
        }

        router.push("/");
      } else {
        setError("Verification incomplete. Please try again.");
      }
    } catch (err: unknown) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const signUpWith = async (
    strategy: "oauth_google" | "oauth_microsoft" | "oauth_facebook"
  ) => {
    if (!isLoaded) return;

    try {
      const currentPath =
        typeof window !== "undefined"
          ? window.location.pathname + window.location.search
          : "/";
      handleOAuthRedirect(strategy, currentPath, "/");

      await signUp.authenticateWithRedirect({
        strategy,
        redirectUrl: "/sso-callback",
        redirectUrlComplete: "/",
      });
    } catch (err: unknown) {
      console.error("OAuth error:", err);
      setError(extractErrorMessage(err));
    }
  };

  if (verifying) {
    return (
      <EmailVerificationDialog
        email={userEmail}
        code={code}
        onCodeChange={setCode}
        onVerify={handleVerify}
        onResend={() =>
          signUp?.prepareEmailAddressVerification({
            strategy: "email_code",
          })
        }
        error={error}
        loading={loading}
      />
    );
  }

  // Render page content
  const renderPageContent = () => {
    switch (currentPage) {
      case 0:
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                type="text"
                placeholder="johndoe"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                disabled={loading}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  type="text"
                  placeholder="John"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  type="text"
                  placeholder="Doe"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="userEmail">Your Email</Label>
              <Input
                id="userEmail"
                type="email"
                placeholder="your.email@example.com"
                value={userEmail}
                onChange={(e) => setUserEmail(e.target.value)}
                required
                disabled={loading}
                className={
                  userEmail && !validateEmail(userEmail)
                    ? "border-destructive"
                    : ""
                }
              />
              <p className="text-xs text-muted-foreground">
                This email will be used for your account authentication
              </p>
              {userEmail && !validateEmail(userEmail) && (
                <p className="text-xs text-destructive">
                  Please enter a valid email address
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  minLength={8}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  disabled={loading}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={loading}
                  minLength={8}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  disabled={loading}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                Must be at least 8 characters long
              </p>
              {password && confirmPassword && password !== confirmPassword && (
                <p className="text-xs text-destructive">
                  Passwords do not match
                </p>
              )}
            </div>
          </div>
        );

      case 1:
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="organizationName">Organization Name</Label>
              <Input
                id="organizationName"
                type="text"
                placeholder="Your Organization"
                value={organizationName}
                onChange={(e) => setOrganizationName(e.target.value)}
                required
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="organizationDescription">Organization Description</Label>
              <textarea
                id="organizationDescription"
                placeholder="Describe your organization..."
                value={organizationDescription}
                onChange={(e) => setOrganizationDescription(e.target.value)}
                required
                disabled={loading}
                rows={4}
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
              <p className="text-xs text-muted-foreground">
                Provide a brief description of your organization
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="organizationEmail">Organization Email</Label>
              <Input
                id="organizationEmail"
                type="email"
                placeholder="organization@example.com"
                value={organizationEmail}
                onChange={(e) => setOrganizationEmail(e.target.value)}
                required
                disabled={loading}
                className={
                  organizationEmail &&
                    (!validateEmail(organizationEmail) ||
                      organizationEmail === userEmail)
                    ? "border-destructive"
                    : ""
                }
              />
              <p className="text-xs text-muted-foreground">
                This email will be used for organization communications
              </p>
              {organizationEmail && !validateEmail(organizationEmail) && (
                <p className="text-xs text-destructive">
                  Please enter a valid email address
                </p>
              )}
              {organizationEmail &&
                validateEmail(organizationEmail) &&
                organizationEmail === userEmail && (
                  <p className="text-xs text-destructive">
                    Organization email must be different from your email
                  </p>
                )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="addressLine1">Street Address <span className="text-destructive">*</span></Label>
              <Input
                id="addressLine1"
                type="text"
                placeholder="123 Main Street"
                value={addressLine1}
                onChange={(e) => setAddressLine1(e.target.value)}
                required
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="addressLine2">Address Line 2 (Optional)</Label>
              <Input
                id="addressLine2"
                type="text"
                placeholder="Apartment, suite, unit, etc."
                value={addressLine2}
                onChange={(e) => setAddressLine2(e.target.value)}
                disabled={loading}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="city">City <span className="text-destructive">*</span></Label>
                <Input
                  id="city"
                  type="text"
                  placeholder="City"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="state">State/Region <span className="text-destructive">*</span></Label>
                <Input
                  id="state"
                  type="text"
                  placeholder="State or Region"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="postalCode">Postal Code <span className="text-destructive">*</span></Label>
              <Input
                id="postalCode"
                type="text"
                placeholder="12345"
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
                required
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="country">Country</Label>
              <Input
                id="country"
                type="text"
                value="Croatia (HR)"
                disabled
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground">
                Country is set to Croatia
              </p>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="taxId">Tax ID / VAT Number <span className="text-destructive">*</span></Label>
              <Input
                id="taxId"
                type="text"
                placeholder="VAT123456789"
                value={taxId}
                onChange={(e) => setTaxId(e.target.value)}
                required
                disabled={loading}
              />
              <p className="text-xs text-muted-foreground">
                Enter your business Tax ID or VAT number
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="businessWebsite">Business Website (Optional)</Label>
              <Input
                id="businessWebsite"
                type="url"
                placeholder="https://www.example.com"
                value={businessWebsite}
                onChange={(e) => setBusinessWebsite(e.target.value)}
                disabled={loading}
              />
              <p className="text-xs text-muted-foreground">
                Enter your business website URL (optional)
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="industry">Industry <span className="text-destructive">*</span></Label>
              <NativeSelect
                id="industry"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                required
                disabled={loading}
                className="w-full"
              >
                <NativeSelectOption value="">Select an industry</NativeSelectOption>
                <NativeSelectOption value="5734">Computer Software Stores</NativeSelectOption>
                <NativeSelectOption value="5970">Arts and Crafts Supplies</NativeSelectOption>
                <NativeSelectOption value="5942">Book Stores</NativeSelectOption>
                <NativeSelectOption value="5971">Art Dealers and Galleries</NativeSelectOption>
                <NativeSelectOption value="5972">Stamp and Coin Stores</NativeSelectOption>
                <NativeSelectOption value="5947">Cosmetic Stores</NativeSelectOption>
                <NativeSelectOption value="5948">Luggage and Leather Goods Stores</NativeSelectOption>
                <NativeSelectOption value="5949">Sewing, Needlework, Fabric and Piece Goods Stores</NativeSelectOption>
                <NativeSelectOption value="5950">Glassware, Chinaware Stores</NativeSelectOption>
                <NativeSelectOption value="5975">Hearing Aids - Sales, Service, and Supply Stores</NativeSelectOption>
                <NativeSelectOption value="5976">Orthopedic Goods - Prosthetic Devices</NativeSelectOption>
                <NativeSelectOption value="5977">Cosmetic Stores</NativeSelectOption>
                <NativeSelectOption value="5978">Typewriter Stores</NativeSelectOption>
                <NativeSelectOption value="5992">Florists</NativeSelectOption>
                <NativeSelectOption value="5993">Cigar Stores and Stands</NativeSelectOption>
                <NativeSelectOption value="5994">News Dealers and Newsstands</NativeSelectOption>
                <NativeSelectOption value="5995">Pet Shops, Pet Food, and Supplies Stores</NativeSelectOption>
                <NativeSelectOption value="5996">Swimming Pools - Sales, Service, and Supplies</NativeSelectOption>
                <NativeSelectOption value="5997">Electric Razor Stores</NativeSelectOption>
                <NativeSelectOption value="5998">Tent and Awning Shops</NativeSelectOption>
                <NativeSelectOption value="5999">Miscellaneous and Specialty Retail Stores</NativeSelectOption>
                <NativeSelectOption value="5811">Caterers</NativeSelectOption>
                <NativeSelectOption value="5812">Eating Places, Restaurants</NativeSelectOption>
                <NativeSelectOption value="5813">Drinking Places (Alcoholic Beverages)</NativeSelectOption>
                <NativeSelectOption value="5814">Fast Food Restaurants</NativeSelectOption>
                <NativeSelectOption value="7011">Hotels, Motels, and Resorts</NativeSelectOption>
                <NativeSelectOption value="7012">Timeshares</NativeSelectOption>
                <NativeSelectOption value="7032">Sporting and Recreational Camps</NativeSelectOption>
                <NativeSelectOption value="7033">Trailer Parks, Campgrounds</NativeSelectOption>
                <NativeSelectOption value="7911">Dance Halls, Studios, and Schools</NativeSelectOption>
                <NativeSelectOption value="7922">Theatrical Producers (Except Motion Pictures) and Ticket Agencies</NativeSelectOption>
                <NativeSelectOption value="7929">Bands, Orchestras, and Miscellaneous Entertainers</NativeSelectOption>
                <NativeSelectOption value="7932">Billiard and Pool Establishments</NativeSelectOption>
                <NativeSelectOption value="7933">Bowling Alleys</NativeSelectOption>
                <NativeSelectOption value="7941">Commercial Sports, Athletic Fields, Recreation, and Parks</NativeSelectOption>
                <NativeSelectOption value="7991">Tourist Attractions and Exhibits</NativeSelectOption>
                <NativeSelectOption value="7992">Public Golf Courses</NativeSelectOption>
                <NativeSelectOption value="7993">Video Amusement Game Supplies</NativeSelectOption>
                <NativeSelectOption value="7994">Video Game Arcades</NativeSelectOption>
                <NativeSelectOption value="7995">Betting (including Lottery Tickets, Casino Gaming Chips, Off-track Betting, and Wagers)</NativeSelectOption>
                <NativeSelectOption value="7996">Amusement Parks, Circuses, Carnivals, and Fortune Tellers</NativeSelectOption>
                <NativeSelectOption value="7997">Membership Clubs (Sports, Recreation, Athletic), Country Clubs, and Private Golf Courses</NativeSelectOption>
                <NativeSelectOption value="7998">Aquariums, Seaquariums, Dolphinariums</NativeSelectOption>
                <NativeSelectOption value="7999">Recreation Services (Not Elsewhere Classified)</NativeSelectOption>
                <NativeSelectOption value="8220">Colleges, Universities, Professional Schools, and Junior Colleges</NativeSelectOption>
                <NativeSelectOption value="8241">Correspondence Schools</NativeSelectOption>
                <NativeSelectOption value="8244">Business and Secretarial Schools</NativeSelectOption>
                <NativeSelectOption value="8249">Vocational and Trade Schools</NativeSelectOption>
                <NativeSelectOption value="8299">Schools and Educational Services (Not Elsewhere Classified)</NativeSelectOption>
                <NativeSelectOption value="8351">Child Care Services</NativeSelectOption>
                <NativeSelectOption value="8398">Charitable and Social Service Organizations</NativeSelectOption>
                <NativeSelectOption value="8641">Civic, Social, and Fraternal Associations</NativeSelectOption>
                <NativeSelectOption value="8651">Political Organizations</NativeSelectOption>
                <NativeSelectOption value="8661">Religious Organizations</NativeSelectOption>
                <NativeSelectOption value="8911">Architectural, Engineering, and Surveying Services</NativeSelectOption>
                <NativeSelectOption value="8912">Accounting, Auditing, and Bookkeeping Services</NativeSelectOption>
                <NativeSelectOption value="8931">Accounting, Auditing, and Bookkeeping Services</NativeSelectOption>
                <NativeSelectOption value="8999">Professional Services (Not Elsewhere Classified)</NativeSelectOption>
              </NativeSelect>
              <p className="text-xs text-muted-foreground">
                Select the industry that best describes your business
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="dateOfBirth">Date of Birth (Business Representative) <span className="text-destructive">*</span></Label>
              <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                    disabled={loading}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateOfBirth ? (
                      format(dateOfBirth, "PPP")
                    ) : (
                      <span>Select date of birth</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <DateOfBirthCalendar
                    mode="single"
                    selected={dateOfBirth}
                    onSelect={(date) => {
                      setDateOfBirth(date);
                      setCalendarOpen(false);
                    }}
                    captionLayout="dropdown"
                    disabled={(date) => {
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      // Disable future dates
                      if (date > today) return true;
                      // Disable dates that would make user under 18
                      const maxDate = new Date();
                      maxDate.setFullYear(maxDate.getFullYear() - 18);
                      maxDate.setHours(0, 0, 0, 0);
                      return date > maxDate;
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <p className="text-xs text-muted-foreground">
                Must be at least 18 years old
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact">Contact Number</Label>
              <Input
                id="contact"
                type="tel"
                placeholder="+1234567890"
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                required
                disabled={loading}
              />
              <p className="text-xs text-muted-foreground">
                Enter phone number in E.164 format (e.g., +1234567890). Must start with + and include country code.
              </p>
              {contact && !validateContact(contact) && (
                <p className="text-xs text-destructive">
                  Please enter a valid contact number in E.164 format (e.g., +1234567890)
                </p>
              )}
              {contact && !contact.startsWith("+") && validateContact(contact) && (
                <p className="text-xs text-destructive">
                  Phone number must start with + and include country code (e.g., +1234567890)
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="IBAN">IBAN</Label>
              <Input
                id="IBAN"
                type="text"
                placeholder="DE89 3704 0044 0532 0130 00"
                value={IBAN}
                onChange={(e) => setIBAN(e.target.value)}
                required
                disabled={loading}
                className={
                  IBAN && !validateIBAN(IBAN) ? "border-destructive" : ""
                }
              />
              <p className="text-xs text-muted-foreground">
                Enter IBAN in format: Country Code (2 letters) + Check Digits
                (2) + Account Number
              </p>
              {IBAN && !validateIBAN(IBAN) && (
                <p className="text-xs text-destructive">
                  Please enter a valid IBAN format
                </p>
              )}
            </div>
            <div className="space-y-2">
              <div className="flex items-start space-x-2">
                <Checkbox
                  id="tosAccepted"
                  checked={tosAccepted}
                  onCheckedChange={(checked) => setTosAccepted(checked === true)}
                  disabled={loading}
                  className="mt-1"
                />
                <Label htmlFor="tosAccepted" className="text-sm font-normal cursor-pointer">
                  I accept Stripe&apos;s{" "}
                  <a
                    href="https://stripe.com/legal/connect-account"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    Terms of Service
                  </a>{" "}
                  and{" "}
                  <a
                    href="https://stripe.com/legal/connect-account"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    Connected Account Agreement
                  </a>
                  <span className="text-destructive">*</span>
                </Label>
              </div>
              {!tosAccepted && (
                <p className="text-xs text-destructive">
                  You must accept Stripe&apos;s Terms of Service to continue
                </p>
              )}
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-4">Review Your Information</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Click on any section to edit the information
              </p>

              <div className="space-y-4">
                <div
                  className="border rounded-lg p-4 space-y-2 cursor-pointer hover:bg-accent hover:border-primary transition-colors"
                  onClick={() => {
                    setIsInitialRender(false);
                    setDirection(0 < currentPage ? "backward" : "forward");
                    setCurrentPage(0);
                  }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setIsInitialRender(false);
                      setDirection(0 < currentPage ? "backward" : "forward");
                      setCurrentPage(0);
                    }
                  }}
                >
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-sm text-muted-foreground uppercase">Personal Information</h4>
                    <span className="text-xs text-muted-foreground">Click to edit</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Username:</span> {username}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Name:</span> {firstName} {lastName}
                    </div>
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Email:</span> {userEmail}
                    </div>
                  </div>
                </div>

                <div
                  className="border rounded-lg p-4 space-y-2 cursor-pointer hover:bg-accent hover:border-primary transition-colors"
                  onClick={() => {
                    setIsInitialRender(false);
                    setDirection(1 < currentPage ? "backward" : "forward");
                    setCurrentPage(1);
                  }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setIsInitialRender(false);
                      setDirection(1 < currentPage ? "backward" : "forward");
                      setCurrentPage(1);
                    }
                  }}
                >
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-sm text-muted-foreground uppercase">Organization Details</h4>
                    <span className="text-xs text-muted-foreground">Click to edit</span>
                  </div>
                  <div className="space-y-1 text-sm">
                    <div>
                      <span className="text-muted-foreground">Organization Name:</span> {organizationName}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Organization Email:</span> {organizationEmail}
                    </div>
                    {organizationDescription && (
                      <div>
                        <span className="text-muted-foreground">Description:</span> {organizationDescription}
                      </div>
                    )}
                    <div>
                      <span className="text-muted-foreground">Address:</span> {addressLine1}
                      {addressLine2 && `, ${addressLine2}`}
                    </div>
                    <div>
                      <span className="text-muted-foreground">City:</span> {city}
                    </div>
                    <div>
                      <span className="text-muted-foreground">State/Region:</span> {state}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Postal Code:</span> {postalCode}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Country:</span> {country}
                    </div>
                  </div>
                </div>

                <div
                  className="border rounded-lg p-4 space-y-2 cursor-pointer hover:bg-accent hover:border-primary transition-colors"
                  onClick={() => {
                    setIsInitialRender(false);
                    setDirection(2 < currentPage ? "backward" : "forward");
                    setCurrentPage(2);
                  }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setIsInitialRender(false);
                      setDirection(2 < currentPage ? "backward" : "forward");
                      setCurrentPage(2);
                    }
                  }}
                >
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-sm text-muted-foreground uppercase">Business & Payment Info</h4>
                    <span className="text-xs text-muted-foreground">Click to edit</span>
                  </div>
                  <div className="space-y-1 text-sm">
                    <div>
                      <span className="text-muted-foreground">Tax ID:</span> {taxId}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Business Website:</span> {businessWebsite || "Not provided"}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Industry:</span> {industry ? (() => {
                        const industryMap: Record<string, string> = {
                          "5734": "Computer Software Stores",
                          "5970": "Arts and Crafts Supplies",
                          "5942": "Book Stores",
                          "5971": "Art Dealers and Galleries",
                          "5972": "Stamp and Coin Stores",
                          "5947": "Cosmetic Stores",
                          "5948": "Luggage and Leather Goods Stores",
                          "5949": "Sewing, Needlework, Fabric and Piece Goods Stores",
                          "5950": "Glassware, Chinaware Stores",
                          "5975": "Hearing Aids - Sales, Service, and Supply Stores",
                          "5976": "Orthopedic Goods - Prosthetic Devices",
                          "5977": "Cosmetic Stores",
                          "5978": "Typewriter Stores",
                          "5992": "Florists",
                          "5993": "Cigar Stores and Stands",
                          "5994": "News Dealers and Newsstands",
                          "5995": "Pet Shops, Pet Food, and Supplies Stores",
                          "5996": "Swimming Pools - Sales, Service, and Supplies",
                          "5997": "Electric Razor Stores",
                          "5998": "Tent and Awning Shops",
                          "5999": "Miscellaneous and Specialty Retail Stores",
                          "5811": "Caterers",
                          "5812": "Eating Places, Restaurants",
                          "5813": "Drinking Places (Alcoholic Beverages)",
                          "5814": "Fast Food Restaurants",
                          "7011": "Hotels, Motels, and Resorts",
                          "7012": "Timeshares",
                          "7032": "Sporting and Recreational Camps",
                          "7033": "Trailer Parks, Campgrounds",
                          "7911": "Dance Halls, Studios, and Schools",
                          "7922": "Theatrical Producers (Except Motion Pictures) and Ticket Agencies",
                          "7929": "Bands, Orchestras, and Miscellaneous Entertainers",
                          "7932": "Billiard and Pool Establishments",
                          "7933": "Bowling Alleys",
                          "7941": "Commercial Sports, Athletic Fields, Recreation, and Parks",
                          "7991": "Tourist Attractions and Exhibits",
                          "7992": "Public Golf Courses",
                          "7993": "Video Amusement Game Supplies",
                          "7994": "Video Game Arcades",
                          "7995": "Betting (including Lottery Tickets, Casino Gaming Chips, Off-track Betting, and Wagers)",
                          "7996": "Amusement Parks, Circuses, Carnivals, and Fortune Tellers",
                          "7997": "Membership Clubs (Sports, Recreation, Athletic), Country Clubs, and Private Golf Courses",
                          "7998": "Aquariums, Seaquariums, Dolphinariums",
                          "7999": "Recreation Services (Not Elsewhere Classified)",
                          "8220": "Colleges, Universities, Professional Schools, and Junior Colleges",
                          "8241": "Correspondence Schools",
                          "8244": "Business and Secretarial Schools",
                          "8249": "Vocational and Trade Schools",
                          "8299": "Schools and Educational Services (Not Elsewhere Classified)",
                          "8351": "Child Care Services",
                          "8398": "Charitable and Social Service Organizations",
                          "8641": "Civic, Social, and Fraternal Associations",
                          "8651": "Political Organizations",
                          "8661": "Religious Organizations",
                          "8911": "Architectural, Engineering, and Surveying Services",
                          "8912": "Accounting, Auditing, and Bookkeeping Services",
                          "8931": "Accounting, Auditing, and Bookkeeping Services",
                          "8999": "Professional Services (Not Elsewhere Classified)",
                        };
                        return industryMap[industry] || industry;
                      })() : "Not selected"}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Date of Birth:</span> {dateOfBirth ? format(dateOfBirth, "PPP") : "Not set"}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Contact:</span> {contact}
                    </div>
                    <div>
                      <span className="text-muted-foreground">IBAN:</span> {IBAN}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4 py-8">
      <Card className="w-full max-w-2xl">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">
            Create Organizer Account
          </CardTitle>
          <CardDescription>
            {currentPage === 0 && "Choose your preferred sign up method or fill in your personal information"}
            {currentPage === 1 && "Enter your organization details"}
            {currentPage === 2 && "Provide business and payment information"}
            {currentPage === 3 && "Review your information before creating your account"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* OAuth buttons - only show on first page */}
          {currentPage === 0 && (
            <>
              <OAuthButtons
                onGoogleClick={() => signUpWith("oauth_google")}
                onMicrosoftClick={() => signUpWith("oauth_microsoft")}
                onFacebookClick={() => signUpWith("oauth_facebook")}
                disabled={loading}
              />

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <Separator />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">
                    Or continue with
                  </span>
                </div>
              </div>
            </>
          )}

          {/* Step description */}
          <div className="text-center">
            <p className="text-sm text-muted-foreground">
              {STEPS[currentPage].description}
            </p>
          </div>

          {/* Form content */}
          <div className="min-h-[400px] relative overflow-hidden">
            <div
              key={currentPage}
              className={cn(
                !isInitialRender && "animate-in fade-in-0 duration-300 ease-in-out",
                !isInitialRender && direction === "forward" && "slide-in-from-right-4",
                !isInitialRender && direction === "backward" && "slide-in-from-left-4"
              )}
            >
              {renderPageContent()}
            </div>
          </div>

          {/* Error message */}
          {error && (
            <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md p-3">
              {error}
            </div>
          )}

          {/* Clerk CAPTCHA */}
          <div id="clerk-captcha"></div>

          {/* Navigation buttons with stepper */}
          <div className="flex items-center justify-between gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={handlePrevious}
              disabled={currentPage === 0 || loading}
              className="flex items-center gap-2 shrink-0"
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <div className="flex-1 flex justify-center">
              <Stepper steps={STEPS} currentStep={currentPage + 1} />
            </div>
            {currentPage < STEPS.length - 1 ? (
              <Button
                type="button"
                onClick={handleNext}
                disabled={!canProceedToNext() || loading}
                className="flex items-center gap-2 shrink-0"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                type="button"
                onClick={handleCreateAccount}
                disabled={loading || !canProceedToNext()}
                className="flex items-center gap-2 shrink-0"
              >
                {loading ? "Creating account..." : "Create Account"}
              </Button>
            )}
          </div>
        </CardContent>
        <CardFooter className="flex flex-col space-y-2">
          <div className="text-sm text-muted-foreground text-center">
            Already have an account?{" "}
            <Link href="/sign-in" className="text-primary hover:underline">
              Sign in
            </Link>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
