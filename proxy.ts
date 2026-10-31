import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { SIGNED_IN_HOME_HREF } from '@/lib/routes';

const isPublicRoute = createRouteMatcher([
  '/',
  '/terms(.*)',
  '/privacy(.*)',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/sso-callback(.*)',
]);

export default clerkMiddleware(async (auth, req) => {
  // Signed-in users skip the marketing page; doing it here keeps `/` static.
  if (req.nextUrl.pathname === '/') {
    const { userId } = await auth();
    if (userId) {
      return NextResponse.redirect(new URL(SIGNED_IN_HOME_HREF, req.url));
    }
    return;
  }

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

  // If no valid session, protect the route (redirects to signInUrl below)
  // This only happens when user is definitely not authenticated
  await auth.protect();
}, {
  // Send signed-out visitors to our custom auth pages, not Clerk's hosted ones.
  // (ClerkProvider's signInUrl only applies client-side, not to this middleware.)
  signInUrl: '/sign-in',
  signUpUrl: '/sign-up',
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    // monitoring (Sentry tunnel) and ingest (PostHog proxy) must never redirect to sign-in.
    '/((?!_next|monitoring|ingest|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest|txt|xml)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
