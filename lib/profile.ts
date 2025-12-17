import type { EmailVerificationStatus } from "@/lib/types/profile";

/**
 * Gets the email verification status from Clerk user
 * @param clerkUser - Clerk user object
 * @param email - Email address to check
 * @returns Verification status: true if verified and primary, false if not verified, null if not found
 */
export function getEmailVerificationStatus(
  clerkUser: {
    emailAddresses: Array<{
      id: string;
      emailAddress: string;
      verification?: { status: string } | null;
    }>;
    primaryEmailAddressId: string | null;
  } | null | undefined,
  email: string
): EmailVerificationStatus {
  if (!clerkUser) return null;
  
  // Find the email that matches the current email
  const currentEmail = clerkUser.emailAddresses.find(
    (emailAddr) => emailAddr.emailAddress === email
  );
  
  // Also check if this is the primary email
  const isPrimary = currentEmail?.id === clerkUser.primaryEmailAddressId;
  
  // Check if email exists and has a verification object with verified status
  if (!currentEmail?.verification) return false;
  
  return currentEmail.verification.status === "verified" && isPrimary;
}

/**
 * Validates password strength
 * @param password - Password to validate
 * @returns Error message if invalid, undefined if valid
 */
export function validatePassword(password: string): string | undefined {
  if (!password) {
    return "Password is required";
  }
  
  if (password.length < 8) {
    return "Password must be at least 8 characters long";
  }
  
  return undefined;
}

/**
 * Validates password confirmation matches password
 * @param password - Original password
 * @param confirmPassword - Confirmation password
 * @returns Error message if invalid, undefined if valid
 */
export function validatePasswordConfirmation(
  password: string,
  confirmPassword: string
): string | undefined {
  if (password !== confirmPassword) {
    return "Passwords do not match";
  }
  
  return undefined;
}

/**
 * Transforms user data from database format to form format
 */
export function transformUserToFormData(user: {
  avatar?: string;
  name?: string;
  lastname?: string;
  username?: string;
  email?: string;
  description?: string;
  contact?: string;
  totalExp?: bigint;
  friends?: string[];
}) {
  return {
    avatar: user.avatar || "https://via.placeholder.com/128",
    name: user.name || "",
    lastname: user.lastname || "",
    username: user.username || "",
    email: user.email || "",
    description: user.description || "",
    contact: user.contact || "",
    exp: Number(user.totalExp || 0),
    friends: user.friends || [],
  };
}

