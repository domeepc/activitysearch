"use client";
import { useState } from "react";
import { useSignUp } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
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
import { api } from "@/convex/_generated/api";
import { validateEmail, validateIBAN, validateContact } from "@/lib/validation";
import { handleOAuthRedirect } from "@/lib/auth/oauth";
import { extractErrorMessage } from "@/lib/errors";
import { Eye, EyeOff } from "lucide-react";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { AddressAutocomplete, AddressCoordinates } from "@/components/ui/address-autocomplete";

export default function CustomSignUpORG() {
  const { isLoaded, signUp, setActive } = useSignUp();
  const createOrganisation = useMutation(api.organisation.createOrganisation);
  const [userEmail, setUserEmail] = useState("");
  const [organizationEmail, setOrganizationEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [username, setUsername] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [address, setAddress] = useState("");
  const [addressCoords, setAddressCoords] = useState<AddressCoordinates | null>(null);
  const [IBAN, setIBAN] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [contact, setContact] = useState("");
  const [country, setCountry] = useState("");
  const [businessType, setBusinessType] = useState<"individual" | "company">("individual");
  const [taxId, setTaxId] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();


  const validateOrganizationData = (): string | null => {
    if (!userEmail || !validateEmail(userEmail)) {
      return "Please enter a valid user email address";
    }
    if (!organizationEmail || !validateEmail(organizationEmail)) {
      return "Please enter a valid organization email address";
    }
    if (userEmail === organizationEmail) {
      return "User email and organization email must be different";
    }
    if (!organizationName || organizationName.trim().length < 2) {
      return "Organization name must be at least 2 characters long";
    }
    if (organizationName.length > 100) {
      return "Organization name must be less than 100 characters";
    }
    if (!address || address.trim().length < 5) {
      return "Please enter a valid address (at least 5 characters)";
    }
    if (!IBAN || !validateIBAN(IBAN)) {
      return "Please enter a valid IBAN (e.g., DE89 3704 0044 0532 0130 00)";
    }
    if (!contact || !validateContact(contact)) {
      return "Please enter a valid contact number (7-15 digits)";
    }
    if (!country || country.trim().length === 0) {
      return "Please select a country";
    }
    if (businessType === "company" && (!taxId || taxId.trim().length < 2)) {
      return "Please enter a valid Tax ID/VAT number for company";
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoaded) return;

    // Validate passwords match
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    // Validate organization data
    const validationError = validateOrganizationData();
    if (validationError) {
      setError(validationError);
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
        // Retry logic to wait for user to be created in Convex
        const maxRetries = 10;
        const retryDelay = 500; // ms
        let retryCount = 0;
        let orgCreated = false;

        while (retryCount < maxRetries && !orgCreated) {
          try {
            const organisationId = await createOrganisation({
              name: organizationName,
              email: organizationEmail,
              address,
              IBAN,
              ownerExternalId: completeSignUp.createdUserId!, // Pass Clerk user ID
              country,
              businessType,
              taxId: businessType === "company" ? taxId : undefined,
            });
            
            // Create Stripe Connect account with business details
            if (organisationId) {
              try {
                const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL || "";
                const response = await fetch(
                  `${convexUrl}/stripe/create-connect-account-with-details`,
                  {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                      organisationId,
                      country,
                      businessType,
                      email: organizationEmail,
                      businessName: organizationName,
                      taxId: businessType === "company" ? taxId : undefined,
                      phone: contact, // Use existing contact field
                    }),
                    credentials: "include",
                  }
                );
                
                if (!response.ok) {
                  // Try to get error message from response
                  let errorData: unknown = { error: "Unknown error" };
                  const contentType = response.headers.get("content-type");
                  
                  if (contentType && contentType.includes("application/json")) {
                    try {
                      errorData = await response.json();
                    } catch (e) {
                      // If JSON parsing fails, try text
                      const text = await response.text();
                      errorData = { error: text || "Failed to parse error response" };
                    }
                  } else {
                    const text = await response.text();
                    errorData = { error: text || `HTTP ${response.status}: ${response.statusText}` };
                  }
                  
                  console.error("Failed to create Stripe account:", {
                    status: response.status,
                    statusText: response.statusText,
                    url: `${convexUrl}/stripe/create-connect-account-with-details`,
                    error: errorData,
                  });
                  // Continue anyway - user can set up Stripe later
                } else {
                  const data = await response.json();
                  console.log("Stripe account created successfully:", data);
                }
              } catch (stripeError) {
                console.error("Error creating Stripe account:", stripeError);
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
              // Wait and retry
              retryCount++;
              await new Promise((resolve) => setTimeout(resolve, retryDelay));
            } else {
              // Final error after retries or different error
              console.error("Failed to create organization:", error);
              setError(
                "Account created but organization setup failed. Please contact support or try creating an organization from your profile."
              );
              setLoading(false);
              // Still redirect to home after a delay
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

  return (
    <div className="flex min-h-screen items-center justify-center p-4 py-8">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">
            Create an account
          </CardTitle>
          <CardDescription>
            Choose your preferred sign up method
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
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

          <form onSubmit={handleSubmit} className="space-y-4">
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
              <Label htmlFor="address">Address</Label>
              <AddressAutocomplete
                id="address"
                value={address}
                onChange={setAddress}
                onSelect={(selectedAddress, coords) => {
                  setAddress(selectedAddress);
                  setAddressCoords(coords);
                }}
                placeholder="Enter address..."
                required
                error={address && address.trim().length < 5 ? "Please enter a valid address (at least 5 characters)" : undefined}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="country">Country <span className="text-destructive">*</span></Label>
              <NativeSelect
                id="country"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                required
                disabled={loading}
                className="w-full"
              >
                <NativeSelectOption value="">Select a country</NativeSelectOption>
                <NativeSelectOption value="US">United States</NativeSelectOption>
                <NativeSelectOption value="GB">United Kingdom</NativeSelectOption>
                <NativeSelectOption value="CA">Canada</NativeSelectOption>
                <NativeSelectOption value="AU">Australia</NativeSelectOption>
                <NativeSelectOption value="DE">Germany</NativeSelectOption>
                <NativeSelectOption value="FR">France</NativeSelectOption>
                <NativeSelectOption value="IT">Italy</NativeSelectOption>
                <NativeSelectOption value="ES">Spain</NativeSelectOption>
                <NativeSelectOption value="NL">Netherlands</NativeSelectOption>
                <NativeSelectOption value="BE">Belgium</NativeSelectOption>
                <NativeSelectOption value="AT">Austria</NativeSelectOption>
                <NativeSelectOption value="CH">Switzerland</NativeSelectOption>
                <NativeSelectOption value="SE">Sweden</NativeSelectOption>
                <NativeSelectOption value="NO">Norway</NativeSelectOption>
                <NativeSelectOption value="DK">Denmark</NativeSelectOption>
                <NativeSelectOption value="FI">Finland</NativeSelectOption>
                <NativeSelectOption value="PL">Poland</NativeSelectOption>
                <NativeSelectOption value="CZ">Czech Republic</NativeSelectOption>
                <NativeSelectOption value="IE">Ireland</NativeSelectOption>
                <NativeSelectOption value="PT">Portugal</NativeSelectOption>
                <NativeSelectOption value="GR">Greece</NativeSelectOption>
                <NativeSelectOption value="HR">Croatia</NativeSelectOption>
                <NativeSelectOption value="SI">Slovenia</NativeSelectOption>
                <NativeSelectOption value="SK">Slovakia</NativeSelectOption>
                <NativeSelectOption value="HU">Hungary</NativeSelectOption>
                <NativeSelectOption value="RO">Romania</NativeSelectOption>
                <NativeSelectOption value="BG">Bulgaria</NativeSelectOption>
              </NativeSelect>
            </div>
            <div className="space-y-2">
              <Label htmlFor="businessType">Business Type <span className="text-destructive">*</span></Label>
              <NativeSelect
                id="businessType"
                value={businessType}
                onChange={(e) => {
                  setBusinessType(e.target.value as "individual" | "company");
                  if (e.target.value === "individual") {
                    setTaxId(""); // Clear tax ID if switching to individual
                  }
                }}
                required
                disabled={loading}
                className="w-full"
              >
                <NativeSelectOption value="individual">Individual</NativeSelectOption>
                <NativeSelectOption value="company">Company</NativeSelectOption>
              </NativeSelect>
            </div>
            {businessType === "company" && (
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
            )}
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
                Enter phone number (7-15 digits, with or without country code)
              </p>
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
            </div>
            {error && <div className="text-sm text-destructive">{error}</div>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Creating account..." : "Create account"}
            </Button>
          </form>
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
