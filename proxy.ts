import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

const isPublicRoute = createRouteMatcher([
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/sso-callback(.*)',
]);

export default clerkMiddleware(async (auth, req) => {
  // Allow public routes to pass through without any auth checks
  if (isPublicRoute(req)) {
    return;
  }

  // For protected routes, check auth state first
  // This prevents false redirects during page refresh when session is loading
  const { userId, sessionId } = await auth();

  // If user has a valid session, allow through
  if (userId && sessionId) {
    return;
  }

  // If no valid session, protect the route (will redirect to sign-in)
  // This only happens when user is definitely not authenticated
  // ClerkProvider signInUrl configuration will handle the redirect
  await auth.protect();
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
