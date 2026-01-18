import { AddressCoordinates } from "@/components/ui/address-autocomplete";

/**
 * Validates an email address format
 */
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validates an IBAN format
 */
export function validateIBAN(iban: string): boolean {
  // Remove spaces and convert to uppercase
  const cleaned = iban.replace(/\s/g, "").toUpperCase();
  // Basic IBAN validation: should be 15-34 characters, start with 2 letters, then 2 digits, then alphanumeric
  const ibanRegex = /^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/;
  return ibanRegex.test(cleaned);
}

/**
 * Validates a currency code (ISO 4217 format - 3 letters)
 */
export function validateCurrency(currency: string): boolean {
  if (!currency) return false;
  const cleaned = currency.trim().toUpperCase();
  // ISO 4217 currency codes are exactly 3 uppercase letters
  return /^[A-Z]{3}$/.test(cleaned);
}

/**
 * Validates a country code (ISO 3166-1 alpha-2 format - 2 letters)
 */
export function validateCountryCode(countryCode: string): boolean {
  if (!countryCode) return false;
  const cleaned = countryCode.trim().toUpperCase();
  // ISO 3166-1 alpha-2 country codes are exactly 2 uppercase letters
  return /^[A-Z]{2}$/.test(cleaned);
}

/**
 * Validates a URL format
 */
export function validateURL(url: string): boolean {
  if (!url) return false;
  try {
    const urlObj = new URL(url);
    return urlObj.protocol === "http:" || urlObj.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Validates a contact/phone number
 * Accepts E.164 format (starting with +) or digits only
 */
export function validateContact(contact: string): boolean {
  if (!contact) return false;
  
  // Remove spaces and dashes for validation
  const cleaned = contact.replace(/[\s\-]/g, "");
  
  // Check if it's in E.164 format (starts with + followed by 10-15 digits)
  if (cleaned.startsWith("+")) {
    const digitsAfterPlus = cleaned.slice(1);
    return /^\d{10,15}$/.test(digitsAfterPlus);
  }
  
  // Legacy validation: digits only, 7-15 digits (for backward compatibility)
  return /^\d{7,15}$/.test(cleaned);
}

/**
 * Activity form field validation
 */
export function validateActivityField(
  field: string,
  value: string | AddressCoordinates | null
): string | undefined {
  switch (field) {
    case "activityName":
      if (!value || (typeof value === "string" && !value.trim())) {
        return "Activity name is required";
      }
      break;
    case "description":
      if (!value || (typeof value === "string" && !value.trim())) {
        return "Description is required";
      }
      break;
    case "address":
      if (!value || (typeof value === "string" && !value.trim())) {
        return "Address is required";
      }
      break;
    case "coordinates":
      if (!value || (typeof value === "object" && value === null)) {
        return "Please select an address from the suggestions";
      }
      break;
    case "price":
      if (!value || (typeof value === "string" && !value.trim())) {
        return "Price is required";
      }
      const priceNum = parseFloat(value as string);
      if (isNaN(priceNum) || priceNum < 0) {
        return "Price must be a valid number >= 0";
      }
      break;
    case "duration":
      if (!value || (typeof value === "string" && !value.trim())) {
        return "Duration is required";
      }
      const durationInt = parseInt(value as string, 10);
      if (isNaN(durationInt) || durationInt < 0) {
        return "Duration must be a valid integer >= 0";
      }
      break;
    case "difficulty":
      if (!value || (typeof value === "string" && !value.trim())) {
        return "Difficulty is required";
      }
      if (typeof value === "string") {
        const lowerValue = value.toLowerCase().trim();
        if (!["easy", "intermediate", "hard"].includes(lowerValue)) {
          return "Difficulty must be Easy, Intermediate, or Hard";
        }
      }
      break;
    case "maxParticipants":
      if (!value || (typeof value === "string" && !value.trim())) {
        return "Max participants is required";
      }
      const maxPartInt = parseInt(value as string, 10);
      if (isNaN(maxPartInt) || maxPartInt < 1) {
        return "Max participants must be a valid integer >= 1";
      }
      break;
    case "minAge":
      if (!value || (typeof value === "string" && !value.trim())) {
        return "Min age is required";
      }
      const minAgeInt = parseInt(value as string, 10);
      if (isNaN(minAgeInt) || minAgeInt < 12) {
        return "Min age must be a valid integer >= 12";
      }
      break;
    case "tags":
      if (!value || (typeof value === "string" && !value.trim())) {
        return "At least one tag is required";
      }
      const tagsArray = (value as string)
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      if (tagsArray.length === 0) {
        return "At least one tag is required";
      }
      break;
  }
  return undefined;
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
  if (!confirmPassword) {
    return "Please confirm your password";
  }
  
  if (password !== confirmPassword) {
    return "Passwords do not match";
  }
  
  return undefined;
}

/**
 * Profile form field validation
 */
export function validateProfileField(
  name: string,
  value: string
): string | undefined {
  if (name === "name" && !value.trim()) {
    return "Name is required";
  }

  if (name === "lastname" && !value.trim()) {
    return "Last name is required";
  }

  if (name === "email") {
    if (!value.trim()) {
      return "Email is required";
    } else if (!validateEmail(value)) {
      return "Please enter a valid email";
    }
  }

  return undefined;
}

/**
 * Organization form field validation
 */
export function validateOrganizationField(
  name: string,
  value: string
): string | undefined {
  if (name === "name" && !value.trim()) {
    return "Organization name is required";
  }

  if (name === "email") {
    if (!value.trim()) {
      return "Email is required";
    } else if (!validateEmail(value)) {
      return "Please enter a valid email";
    }
  }

  if (name === "address" && !value.trim()) {
    return "Address is required";
  }

  if (name === "IBAN" && !value.trim()) {
    return "IBAN is required";
  }

  return undefined;
}

