"use client";
import { useState, useEffect } from "react";
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
import { EmailVerificationDialog } from "@/components/auth/EmailVerificationDialog";
import { Stepper } from "@/components/ui/stepper";
import { api } from "@/convex/_generated/api";
import { validateEmail, validateIBAN, validateContact, validateURL } from "@/lib/validation";
import { extractErrorMessage } from "@/lib/errors";
import { cn } from "@/lib/utils";
import { getCountryName, STRIPE_SUPPORTED_COUNTRIES } from "@/lib/countries";
import { Eye, EyeOff, ChevronLeft, ChevronRight, Calendar as CalendarIcon, Check, Loader2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DateOfBirthCalendar } from "@/components/ui/date-of-birth-calendar";
import { format } from "date-fns";
import { Textarea } from "@/components/ui/textarea";
import { loadStripe, Stripe } from "@stripe/stripe-js";

const STEPS = [
  { label: "Personal Info", description: "Your account details" },
  { label: "Organisation", description: "Organisation details" },
  { label: "Business Info", description: "Business & payment" },
  { label: "Review", description: "Review & create" },
];

// Initialize Stripe
const stripePublishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "";

function formatIbanForDisplay(iban: string): string {
  const cleaned = iban.replace(/\s/g, "").toUpperCase();
  return cleaned.replace(/(.{4})/g, "$1 ").trim();
}

function formatIbanInput(value: string): string {
  const cleaned = value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  return cleaned.replace(/(.{4})/g, "$1 ").trim();
}

function normalizeIban(value: string): string {
  return value.replace(/\s/g, "").toUpperCase();
}

function formatPhoneInput(value: string): string {
  const startsWithPlus = value.trim().startsWith("+");
  const digits = value.replace(/\D/g, "").slice(0, 15);
  if (!digits) return startsWithPlus ? "+" : "";
  const chunks = digits.match(/.{1,3}/g) ?? [digits];
  return `${startsWithPlus ? "+" : ""}${chunks.join(" ")}`.trim();
}

function formatPhoneForDisplay(phone: string): string {
  return formatPhoneInput(phone);
}

export default function CustomSignUpORG() {
  const { isLoaded, signUp, setActive } = useSignUp();
  const createOrganisation = useMutation(api.organisation.createOrganisation);
  const createStripeAccount = useAction(api.stripe.createConnectAccountWithDetails);
  const [stripe, setStripe] = useState<Stripe | null>(null);

  // Form state
  const [currentPage, setCurrentPage] = useState(0);
  const [direction, setDirection] = useState<"forward" | "backward">("forward");
  const [isInitialRender, setIsInitialRender] = useState(true);
  const [userEmail, setUserEmail] = useState("");
  const [organisationEmail, setOrganisationEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
  const [IBANConfirm, setIBANConfirm] = useState("");
  const [organisationName, setOrganisationName] = useState("");
  const [organisationDescription, setOrganisationDescription] = useState("");
  const [contact, setContact] = useState("");
  const [country, setCountry] = useState("HR");
  const [bankCountry, setBankCountry] = useState("HR");
  const [taxId] = useState("");
  // Additional Stripe required fields
  const [dateOfBirth, setDateOfBirth] = useState<Date | undefined>(undefined);
  const [businessWebsite, setBusinessWebsite] = useState("");
  const [industry, setIndustry] = useState("Other entertainment and recreation");
  const [tosAccepted, setTosAccepted] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // Load Stripe on mount with error handling
  useEffect(() => {
    if (stripePublishableKey) {
      loadStripe(stripePublishableKey)
        .then((stripeInstance) => {
          setStripe(stripeInstance);
        })
        .catch((error) => {
          // Handle Stripe initialization errors gracefully
          // Stripe will be null, and we'll handle it in the form submission
          if (process.env.NODE_ENV === "development") {
            console.warn("Failed to initialize Stripe:", error);
          }
        });
    }
  }, []);

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
    if (!organisationName || organisationName.trim().length < 2) {
      return "Organisation name must be at least 2 characters long";
    }
    if (organisationName.length > 100) {
      return "Organisation name must be less than 100 characters";
    }
    if (!organisationEmail || !validateEmail(organisationEmail)) {
      return "Please enter a valid organisation email address";
    }
    if (userEmail === organisationEmail) {
      return "User email and organisation email must be different";
    }
    if (!organisationDescription || organisationDescription.trim().length < 10) {
      return "Please enter an organisation description (at least 10 characters)";
    }

    if (businessWebsite && !validateURL(businessWebsite)) {
      return "Please enter a valid website URL (starting with http:// or https://)";
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
    if (!contact || !validateContact(contact)) {
      return "Please enter a valid contact number in E.164 format (e.g., +1234567890)";
    }
    if (!IBAN || !validateIBAN(IBAN)) {
      return "Please enter a valid IBAN (e.g., DE89 3704 0044 0532 0130 00)";
    }
    if (!IBANConfirm || !validateIBAN(IBANConfirm)) {
      return "Please confirm your IBAN";
    }
    if (normalizeIban(IBAN) !== normalizeIban(IBANConfirm)) {
      return "IBAN and confirmation IBAN do not match";
    }
    if (!bankCountry || bankCountry.trim().length === 0) {
      return "Please select a bank account country";
    }
    if (!industry || industry.trim() === "") {
      return "Please select your industry";
    }
    if (!dateOfBirth) {
      return "Please enter your date of birth";
    }
    // Validate date of birth format and age (must be 18+)
    const today = new Date();
    const age = today.getFullYear() - dateOfBirth.getFullYear();
    const monthDiff = today.getMonth() - dateOfBirth.getMonth();
    const actualAge = monthDiff < 0 || (monthDiff === 0 && today.getDate() < dateOfBirth.getDate()) ? age - 1 : age;
    if (actualAge < 18) {
      return "You must be at least 18 years old";
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
        // Give Clerk/Convex auth state a brief moment to propagate.
        await new Promise((resolve) => setTimeout(resolve, 300));

        // Wait for Clerk webhook to sync user to Convex
        const maxRetries = 20;
        const retryDelay = 750;
        let retryCount = 0;
        let orgCreated = false;

        while (retryCount < maxRetries && !orgCreated) {
          try {
            // Combine address fields for storage
            const fullAddress = `${addressLine1}${addressLine2 ? `, ${addressLine2}` : ""}, ${city}, ${state} ${postalCode}, ${country}`;

            const organisationId = await createOrganisation({
              name: organisationName,
              email: organisationEmail,
              description: organisationDescription || "",
              address: fullAddress,
              IBAN,
              country,
              businessType: "company",
              taxId,
            });

            // Create Stripe Connect account with business details
            if (organisationId) {
              try {
                // Create bank account token from IBAN if IBAN is provided
                let bankAccountToken: string | undefined = undefined;

                if (IBAN && IBAN.trim() && stripe && stripePublishableKey) {
                  try {
                    // Clean IBAN (remove spaces and convert to uppercase)
                    const cleanedIBAN = normalizeIban(IBAN);

                    // Create bank account token using Stripe.js
                    const tokenResult = await stripe.createToken("bank_account", {
                      country: bankCountry,
                      currency: "eur",
                      account_number: cleanedIBAN,
                      account_holder_name: `${firstName} ${lastName}`.trim(),
                      account_holder_type: "individual",
                    });

                    if (tokenResult.error) {
                      console.error("Error creating bank account token:", tokenResult.error);
                      throw new Error(`Failed to create bank account token: ${tokenResult.error.message}`);
                    }

                    if (tokenResult.token) {
                      bankAccountToken = tokenResult.token.id;
                    }
                  } catch (tokenError) {
                    console.error("Error creating bank token:", tokenError);
                    // Continue without token - backend can still use IBAN directly
                    console.warn("Continuing with IBAN instead of token");
                  }
                }

                await createStripeAccount({
                  organisationId,
                  country,
                  businessType: "individual",
                  email: organisationEmail,
                  phone: contact,
                  addressLine1,
                  addressLine2,
                  city,
                  state,
                  postalCode,
                  dateOfBirth: dateOfBirth ? `${dateOfBirth.getFullYear()}-${String(dateOfBirth.getMonth() + 1).padStart(2, '0')}-${String(dateOfBirth.getDate()).padStart(2, '0')}` : "",
                  firstName,
                  lastName,
                  industry,
                  businessWebsite: businessWebsite || undefined,
                  businessDescription: organisationDescription,
                  IBAN: bankAccountToken ? undefined : IBAN, // Send IBAN only if no token
                  externalAccountToken: bankAccountToken, // Send token if created
                  currency: "EUR", // Always send EUR to Stripe
                  bankCountry,
                });
              } catch (stripeError) {
                console.error("Error creating Stripe account:", stripeError);
                const errorMessage = stripeError instanceof Error
                  ? stripeError.message
                  : "Failed to create Stripe account";
                setError(`Account created but Stripe setup failed: ${errorMessage}. You can set up Stripe later from your organisation page.`);
                // Continue anyway - user can set up Stripe later
              }
            }
            orgCreated = true;
          } catch (orgError: unknown) {
            const error = orgError as { message?: string };
            if (
              (error.message?.includes("User not found") ||
                error.message?.includes("You must be signed in") ||
                error.message?.includes("Unauthorized")) &&
              retryCount < maxRetries - 1
            ) {
              retryCount++;
              await new Promise((resolve) => setTimeout(resolve, retryDelay));
            } else {
              console.error("Failed to create organisation:", error);
              setError(
                "Account created but organisation setup failed. Please contact support or try creating an organisation from your profile."
              );
              setLoading(false);
              setTimeout(() => router.push("/"), 2000);
              return;
            }
          }
        }

        if (!orgCreated) {
          setError(
            "Account created but organisation setup is taking longer than expected. You can create it from your profile."
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
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
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
              <Label htmlFor="organisationName">Organisation Name</Label>
              <Input
                id="organisationName"
                type="text"
                placeholder="Your Organisation"
                value={organisationName}
                onChange={(e) => setOrganisationName(e.target.value)}
                required
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="organisationDescription">Organisation Description</Label>
              <Textarea
                id="organisationDescription"
                placeholder="Describe your organisation..."
                value={organisationDescription}
                onChange={(e) => setOrganisationDescription(e.target.value)}
                required
                disabled={loading}
                rows={4}

                className="flex min-h-[80px] resize-none w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
              <p className="text-xs text-muted-foreground">
                Provide a brief description of your organisation
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="businessWebsite">Business Website (Optional)</Label>
              <Input
                id="businessWebsite"
                type="url"
                placeholder="https://example.com"
                value={businessWebsite}
                onChange={(e) => setBusinessWebsite(e.target.value)}
                disabled={loading}
                className={
                  businessWebsite && !validateURL(businessWebsite)
                    ? "border-destructive"
                    : ""
                }
              />
              <p className="text-xs text-muted-foreground">
                If you don&apos;t have a website, we&apos;ll use your organisation description instead
              </p>
              {businessWebsite && !validateURL(businessWebsite) && (
                <p className="text-xs text-destructive">
                  Please enter a valid URL starting with http:// or https://
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="organisationEmail">Organisation Email</Label>
              <Input
                id="organisationEmail"
                type="email"
                placeholder="organisation@example.com"
                value={organisationEmail}
                onChange={(e) => setOrganisationEmail(e.target.value)}
                required
                disabled={loading}
                className={
                  organisationEmail &&
                    (!validateEmail(organisationEmail) ||
                      organisationEmail === userEmail)
                    ? "border-destructive"
                    : ""
                }
              />
              <p className="text-xs text-muted-foreground">
                This email will be used for organisation communications
              </p>
              {organisationEmail && !validateEmail(organisationEmail) && (
                <p className="text-xs text-destructive">
                  Please enter a valid email address
                </p>
              )}
              {organisationEmail &&
                validateEmail(organisationEmail) &&
                organisationEmail === userEmail && (
                  <p className="text-xs text-destructive">
                    Organisation email must be different from your email
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
            <div className="space-y-2 flex gap-4 w-full justify-between">
              <div className="space-y-2 w-full">
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
              <div className="space-y-2 w-full">
                <Label htmlFor="country">Country <span className="text-destructive">*</span></Label>
                <NativeSelect
                  id="country"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  required
                  disabled={loading}
                >
                  <NativeSelectOption value="">Select country</NativeSelectOption>
                  {STRIPE_SUPPORTED_COUNTRIES.map((countryOption) => (
                    <NativeSelectOption key={countryOption.code} value={countryOption.code}>
                      {countryOption.name} ({countryOption.code})
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
                <p className="text-xs text-muted-foreground">
                  Select the country where your organisation is registered
                </p>
              </div>
            </div>
            <div className="space-y-2">

            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="dateOfBirth">Date of Birth <span className="text-destructive">*</span></Label>
              <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal border-border cursor-pointer"
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
              <Label htmlFor="industry">Industry <span className="text-destructive">*</span></Label>
              <NativeSelect
                id="industry"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                required
                disabled={loading}
              >
                <NativeSelectOption value="">Select an industry</NativeSelectOption>
                <NativeSelectOption value="Tourism & Travel">Tourism & Travel</NativeSelectOption>
                <NativeSelectOption value="Events & Entertainment">Events & Entertainment</NativeSelectOption>
                <NativeSelectOption value="Sports & Recreation">Sports & Recreation</NativeSelectOption>
                <NativeSelectOption value="Adventure & Outdoor">Adventure & Outdoor</NativeSelectOption>
                <NativeSelectOption value="Education & Training">Education & Training</NativeSelectOption>
                <NativeSelectOption value="Food & Beverage">Food & Beverage</NativeSelectOption>
                <NativeSelectOption value="Arts & Culture">Arts & Culture</NativeSelectOption>
                <NativeSelectOption value="Health & Wellness">Health & Wellness</NativeSelectOption>
                <NativeSelectOption value="Technology & Digital">Technology & Digital</NativeSelectOption>
                <NativeSelectOption value="Retail & Shopping">Retail & Shopping</NativeSelectOption>
                <NativeSelectOption value="Hospitality & Accommodation">Hospitality & Accommodation</NativeSelectOption>
                <NativeSelectOption value="Other entertainment and recreation">Other entertainment and recreation</NativeSelectOption>
                <NativeSelectOption value="Other">Other</NativeSelectOption>
              </NativeSelect>
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact">Contact Number</Label>
              <Input
                id="contact"
                type="tel"
                placeholder="+1234567890"
                value={contact}
                onChange={(e) => setContact(formatPhoneInput(e.target.value))}
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
            <div className="border-t border-border pt-4">
              <p className="text-xs text-muted-foreground">
                Banking details
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="IBAN">IBAN <span className="text-destructive">*</span></Label>
              <Input
                id="IBAN"
                type="text"
                placeholder="DE89 3704 0044 0532 0130 00"
                value={IBAN}
                onChange={(e) => setIBAN(formatIbanInput(e.target.value))}
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
              <Label htmlFor="IBANConfirm">Confirm IBAN <span className="text-destructive">*</span></Label>
              <Input
                id="IBANConfirm"
                type="text"
                placeholder="DE89 3704 0044 0532 0130 00"
                value={IBANConfirm}
                onChange={(e) => setIBANConfirm(formatIbanInput(e.target.value))}
                required
                disabled={loading}
                className={
                  IBANConfirm && (!validateIBAN(IBANConfirm) || normalizeIban(IBAN) !== normalizeIban(IBANConfirm))
                    ? "border-destructive"
                    : ""
                }
              />
              <p className="text-xs text-muted-foreground">
                Re-enter your IBAN to confirm
              </p>
              {IBANConfirm && !validateIBAN(IBANConfirm) && (
                <p className="text-xs text-destructive">
                  Please enter a valid IBAN format
                </p>
              )}
              {IBANConfirm && validateIBAN(IBANConfirm) && normalizeIban(IBAN) !== normalizeIban(IBANConfirm) && (
                <p className="text-xs text-destructive">
                  IBAN and confirmation do not match
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="currency">Currency <span className="text-destructive">*</span></Label>
                <Input
                  id="currency"
                  type="text"
                  value="EUR - Euro"
                  readOnly
                  disabled
                  className="bg-muted cursor-not-allowed"
                />
                <p className="text-xs text-muted-foreground">
                  Currency is automatically set to EUR - Euro
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="bankCountry">Bank Account Country <span className="text-destructive">*</span></Label>
                <NativeSelect
                  id="bankCountry"
                  value={bankCountry}
                  onChange={(e) => setBankCountry(e.target.value)}
                  required
                  disabled={loading}
                >
                  <NativeSelectOption value="">Select bank account country</NativeSelectOption>
                  {STRIPE_SUPPORTED_COUNTRIES.map((countryOption) => (
                    <NativeSelectOption key={countryOption.code} value={countryOption.code}>
                      {countryOption.name} ({countryOption.code})
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
                <p className="text-xs text-muted-foreground">
                  Select the country where your bank account is located
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="tosAccepted"
                  checked={tosAccepted}
                  onCheckedChange={(checked) => setTosAccepted(checked === true)}
                  disabled={loading}
                  className="cursor-pointer"
                />
                <Label htmlFor="tosAccepted" className="text-sm font-normal flex flex-wrap">
                  I accept Stripe&apos;s{" "}
                  <a
                    href="https://stripe.com/legal/connect-account"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 font-bold hover:underline"
                  >
                    Terms of Service
                  </a>{" "}
                  and{" "}
                  <a
                    href="https://stripe.com/legal/connect-account"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 font-bold hover:underline"
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
                    <h4 className="font-medium text-lg text-muted-foreground uppercase">Organisation Details</h4>
                    <span className="text-xs text-muted-foreground">Click to edit</span>
                  </div>
                  <div className="space-y-1 text-sm">
                    <div>
                      <span className="text-muted-foreground">Organisation Name:</span> {organisationName}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Organisation Email:</span> {organisationEmail}
                    </div>
                    {organisationDescription && (
                      <div>
                        <span className="text-muted-foreground">Description:</span> {organisationDescription}
                      </div>
                    )}
                    {industry && (
                      <div>
                        <span className="text-muted-foreground">Industry:</span> {industry}
                      </div>
                    )}
                    {businessWebsite ? (
                      <div>
                        <span className="text-muted-foreground">Website:</span> {businessWebsite}
                      </div>
                    ) : (
                      <div>
                        <span className="text-muted-foreground">Website:</span> <span className="text-muted-foreground italic">Using description instead</span>
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
                      <span className="text-muted-foreground">Country:</span> {getCountryName(country)} ({country})
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
                      <span className="text-muted-foreground">Date of Birth:</span> {dateOfBirth ? format(dateOfBirth, "PPP") : "Not provided"}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Contact Number:</span> {formatPhoneForDisplay(contact)}
                    </div>
                    <div>
                      <span className="text-muted-foreground">IBAN:</span> {formatIbanForDisplay(IBAN)}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Currency:</span> EUR - Euro
                    </div>
                    <div>
                      <span className="text-muted-foreground">Bank Country:</span> {getCountryName(bankCountry)} ({bankCountry})
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
    <div className="flex min-h-screen items-center justify-center p-3 sm:p-4 py-4 sm:py-8">
      <Card className="w-full max-w-[95vw] sm:max-w-2xl border-border border-2 shadow-xl sm:translate-y-[-30px]">
        <CardHeader className="space-y-1 text-left border-b border-border p-4 sm:p-6">
          <CardTitle className="text-2xl font-bold">
            Create Organiser Account
          </CardTitle>
          <CardDescription className="text-sm text-foreground text-left">
            {currentPage === 0 && "Choose your preferred sign up method or fill in your personal information"}
            {currentPage === 1 && "Enter your organisation details"}
            {currentPage === 2 && "Provide business and payment information"}
            {currentPage === 3 && "Review your information before creating your account"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 sm:space-y-6 p-4 sm:p-6">
          {/* Step description */}
          <div className="text-center">
            <p className="text-xl text-foreground font-bold text-left">
              {STEPS[currentPage].description}
            </p>
          </div>

          {/* Form content */}
          <div className="min-h-[340px] sm:min-h-[400px] relative">
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
              className="flex items-center shrink-0 md:gap-2 gap-0 cursor-pointer border-2 border-border"
            >
              <ChevronLeft className="h-4 w-4" />
              <span className="hidden md:inline">Previous</span>
            </Button>
            <div className="flex-1 flex justify-center">
              <Stepper steps={STEPS} currentStep={currentPage + 1} />
            </div>
            {currentPage < STEPS.length - 1 ? (
              <Button
                type="button"
                onClick={handleNext}
                disabled={!canProceedToNext() || loading}
                className="flex items-center shrink-0 md:gap-2 gap-0 cursor-pointer"
              >
                <span className="hidden md:inline">Next</span>
                <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                type="button"
                onClick={handleCreateAccount}
                disabled={loading || !canProceedToNext()}
                className="flex items-center justify-center size-10 sm:size-11 shrink-0 cursor-pointer"
                aria-label={loading ? "Creating account" : "Create account"}
                title={loading ? "Creating account" : "Create account"}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
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
