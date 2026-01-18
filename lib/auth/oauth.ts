/**
 * Handles OAuth redirect with return URL storage
 */
export function handleOAuthRedirect(
  strategy: "oauth_google" | "oauth_microsoft" | "oauth_facebook",
  currentPath: string,
  defaultReturnPath: string = "/"
): string {
  if (typeof window !== "undefined") {
    const returnUrl = currentPath;
    // Only store if we're not already on the auth page
    if (
      returnUrl !== "/sign-in" &&
      returnUrl !== "/sign-in/" &&
      returnUrl !== "/sign-up" &&
      returnUrl !== "/sign-up/" &&
      returnUrl !== "/sign-up/organisator-sign-up" &&
      returnUrl !== "/sign-up/organisator-sign-up/"
    ) {
      sessionStorage.setItem("oauth_return_url", returnUrl);
    } else {
      // If on auth page, return to default path
      sessionStorage.setItem("oauth_return_url", defaultReturnPath);
    }
    
    // Store OAuth origin (sign-up or sign-in) for callback handling
    const isSignUpFlow = currentPath.includes("/sign-up");
    sessionStorage.setItem("oauth_origin", isSignUpFlow ? "sign-up" : "sign-in");
  }
  return strategy;
}

