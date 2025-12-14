# Custom Authentication Components

This project uses custom-built authentication UI components powered by Clerk and styled with shadcn/ui.

## Features

✅ **Email/Password Authentication**
- Sign up with email verification via OTP
- Sign in with email and password
- Username, first name, and last name fields
- Password confirmation validation
- Custom error handling

✅ **OAuth Authentication**
- Google OAuth
- Microsoft OAuth
- Facebook OAuth
- One-click social login

✅ **UI Components**
- Built with shadcn/ui components
- Fully customizable styling
- Responsive design
- Accessible (follows ARIA guidelines)

## Components

### CustomSignIn
Location: `/components/CustomSignIn.tsx`

A custom sign-in component that provides:
- Email/password authentication
- OAuth buttons for Google and GitHub
- Error handling and loading states
- Automatic redirect to dashboard after successful sign-in
- Link to sign-up page

### CustomSignUp
Location: `/components/CustomSignUp.tsx`

A custom sign-up component that provides:
- Email/password registration with validation
- Username, first name, and last name fields
- Password confirmation field
- Email verification using OTP (6-digit code)
- OAuth buttons for Google, Microsoft, and Facebook
- Two-step process: registration → verification
- Password strength requirement (minimum 8 characters)
- Password matching validation
- Error handling and loading states
- Link to sign-in page

### SSO Callback
Location: `/app/sso-callback/page.tsx`

Handles OAuth redirect callbacks from Google and GitHub.

## How It Works

### Email/Password Flow

#### Sign Up:
1. User enters email and password (min 8 chars)
2. Clerk creates user account
3. Verification email sent with 6-digit code
4. User enters OTP code
5. Account verified and user redirected to dashboard

#### Sign In:
1. User enters email and password
2. Clerk validates credentials
3. User redirected to dashboard

### OAuth Flow

1. User clicks Google or GitHub button
2. Clerk redirects to OAuth provider
3. User authorizes the application
4. OAuth provider redirects to `/sso-callback`
5. Clerk handles session creation
6. User redirected to dashboard

## Configuration

### Environment Variables
Ensure these are set in `.env.local`:
```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_publishable_key
CLERK_SECRET_KEY=your_secret_key
```

### Clerk Dashboard Settings
To enable OAuth providers:

1. Go to [Clerk Dashboard](https://dashboard.clerk.com/)
2. Select your application
3. Navigate to "Social Connections"
4. Enable Google, Microsoft, and Facebook
5. Configure OAuth credentials:
   - **Google**: Set up OAuth 2.0 in Google Cloud Console
   - **Microsoft**: Create app registration in Azure Portal
   - **Facebook**: Create app in Facebook Developers Console
6. Add redirect URLs:
   - Development: `http://localhost:3000/sso-callback`
   - Production: `https://yourdomain.com/sso-callback`
7. Enable username in "User & Authentication" → "Username" settings

## Styling

The components use shadcn/ui components which are built on:
- Radix UI primitives
- Tailwind CSS
- CVA (Class Variance Authority)

### Customization

You can customize the appearance by:

1. **Modifying component styles**: Edit the component files directly
2. **Updating theme**: Modify Tailwind config
3. **Changing colors**: Update CSS variables in `globals.css`

## shadcn/ui Components Used

- `Button` - OAuth buttons and submit buttons
- `Input` - Email and password fields
- `Label` - Form labels
- `Card` - Main container and layout
- `Separator` - Visual divider between OAuth and email/password
- `InputOTP` - 6-digit verification code input

## Testing

Run the development server:
```bash
pnpm dev
```

Then test:

1. **Sign Up with Email**:
   - Go to http://localhost:3000/sign-up
   - Enter email and password
   - Check email for verification code
   - Enter code to verify

2. **Sign In with Email**:
   - Go to http://localhost:3000/sign-in
   - Enter credentials
   - Should redirect to dashboard

3. **OAuth Sign In/Up**:
   - Click Google, Microsoft, or Facebook button
   - Authorize the app
   - Should redirect to dashboard

## Security Features

- ✅ Password validation (min 8 characters)
- ✅ Email verification required for new accounts
- ✅ Secure session management via Clerk
- ✅ CSRF protection built-in
- ✅ Rate limiting on Clerk's end
- ✅ Secure OAuth flow with proper redirect handling

## Troubleshooting

### OAuth not working
- Verify OAuth providers are enabled in Clerk dashboard
- Check redirect URLs match exactly
- Ensure OAuth credentials are properly configured

### Email verification not received
- Check spam folder
- Verify Clerk email settings
- Use resend button if needed

### Styling issues
- Clear browser cache
- Check if Tailwind CSS is configured correctly
- Verify all shadcn/ui components are installed

## Dependencies

```json
{
  "@clerk/nextjs": "^6.36.2",
  "@radix-ui/react-separator": "^1.1.8",
  "@radix-ui/react-label": "^2.1.8",
  "@radix-ui/react-dialog": "^1.1.15",
  // ... other shadcn/ui radix dependencies
}
```

## File Structure

```
app/
  sign-in/[[...sign-in]]/
    page.tsx              # Sign-in route using CustomSignIn
  sign-up/[[...sign-up]]/
    page.tsx              # Sign-up route using CustomSignUp
  sso-callback/
    page.tsx              # OAuth callback handler
components/
  CustomSignIn.tsx        # Custom sign-in component
  CustomSignUp.tsx        # Custom sign-up component
  ui/
    separator.tsx         # Separator component
    button.tsx            # Button component
    input.tsx             # Input component
    label.tsx             # Label component
    card.tsx              # Card component
    input-otp.tsx         # OTP input component
```

## Next Steps

- Add "Forgot Password" functionality
- Add "Remember Me" option
- Add more OAuth providers (Discord, Twitter, etc.)
- Add profile completion after OAuth sign-up
- Add loading skeletons
- Add success animations
