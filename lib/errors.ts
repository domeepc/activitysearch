/**
 * Extracts error message from various error types
 */
export function extractErrorMessage(error: unknown): string {
  if (
    error &&
    typeof error === "object" &&
    "errors" in error &&
    Array.isArray(error.errors) &&
    error.errors[0]?.message
  ) {
    return error.errors[0].message;
  }
  
  if (error instanceof Error) {
    return error.message;
  }
  
  return "An error occurred. Please try again.";
}

