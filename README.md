# ActivitySearch

A modern platform for discovering, booking, and managing activities. Connect with organisers, chat with friends, and manage your reservations all in one place.

## Features

- 🔍 **Activity Discovery**: Search and filter activities by category, location, and more
- 📅 **Reservation Management**: Book activities and manage your reservations
- 💬 **Real-time Chat**: Private messaging and team chat with end-to-end encryption
- 👥 **Social Features**: Friend system, user profiles, and team collaboration
- 💳 **Payment Processing**: Integrated Stripe payments for activity bookings
- 🏢 **Organiser Dashboard**: Create and manage activities, connect Stripe accounts
- 📍 **Location-based Search**: Interactive map view with activity locations
- 🔐 **Secure Authentication**: Clerk-powered authentication with OAuth support

## Tech Stack

- **Frontend**: Next.js 16, React 19, TypeScript
- **Backend**: Convex (real-time database and serverless functions)
- **Authentication**: Clerk
- **Payments**: Stripe
- **Real-time**: Ably
- **Maps**: Leaflet
- **Styling**: Tailwind CSS, Radix UI

## Prerequisites

- Node.js 18+ 
- pnpm 10+ (or npm/yarn)
- Clerk account ([sign up here](https://clerk.com))
- Convex account ([sign up here](https://convex.dev))
- Stripe account ([sign up here](https://stripe.com))
- Ably account ([sign up here](https://ably.com))

## Getting Started

### 1. Clone the repository

```bash
git clone <repository-url>
cd activitysearch
```

### 2. Install dependencies

```bash
pnpm install
```

### 3. Set up environment variables

Create a `.env.local` file in the root directory and add the following variables:

```env
# Clerk Authentication Configuration
CLERK_SECRET_KEY=sk_test_...
CLERK_FRONTEND_API_URL=https://your-app.clerk.accounts.dev
CLERK_WEBHOOK_SECRET=whsec_...

# Convex Backend Configuration
NEXT_PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud

# Stripe Payment Configuration
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...

# Ably Real-time Communication
NEXT_PUBLIC_ABLY_API_KEY=your-ably-api-key

# Environment
NODE_ENV=development
```

See `.env.example` for a template with detailed descriptions.

### 4. Set up Convex

```bash
# Install Convex CLI if you haven't already
pnpm add -g convex

# Login to Convex
npx convex dev

# This will:
# - Create a new Convex project (if needed)
# - Deploy your schema and functions
# - Set up the NEXT_PUBLIC_CONVEX_URL automatically
```

### 5. Set up Clerk

1. Create a new application in [Clerk Dashboard](https://dashboard.clerk.com)
2. Configure OAuth providers (Google, Microsoft, Facebook) if needed
3. Copy your API keys to `.env.local`
4. Set up webhook endpoints:
   - Webhook URL: `https://your-domain.com/api/webhooks/clerk`
   - Events: `user.created`, `user.updated`, `user.deleted`

### 6. Set up Stripe

1. Create a Stripe account and get your API keys
2. Add keys to `.env.local`
3. Set up webhook endpoints:
   - Webhook URL: `https://your-convex-deployment.convex.site/stripe-webhook`
   - Events: `payment_intent.succeeded`, `account.updated`, etc.

### 7. Set up Ably

1. Create an Ably account
2. Create a new app and get your API key
3. Add to `.env.local` as `NEXT_PUBLIC_ABLY_API_KEY`

### 8. Run the development server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
activitysearch/
├── app/                    # Next.js app directory
│   ├── (auth)/            # Authentication routes
│   ├── activities/        # Activity pages
│   ├── chat/             # Chat pages
│   ├── dashboard/        # Dashboard
│   ├── profile/          # User profiles
│   └── reservations/     # Reservation management
├── components/           # React components
│   ├── activities/       # Activity-related components
│   ├── auth/            # Authentication components
│   ├── chat/            # Chat components
│   ├── payments/        # Payment components
│   └── ui/              # UI components
├── convex/              # Convex backend functions
│   ├── activity.ts      # Activity mutations/queries
│   ├── messages.ts      # Chat functionality
│   ├── reservations.ts   # Reservation logic
│   ├── stripe.ts        # Stripe integration
│   └── schema.ts        # Database schema
├── lib/                 # Utility libraries
│   ├── hooks/           # Custom React hooks
│   ├── types/           # TypeScript types
│   └── encryption.ts    # End-to-end encryption
└── public/              # Static assets
```

## Available Scripts

- `pnpm dev` - Start development server
- `pnpm build` - Build for production
- `pnpm start` - Start production server
- `pnpm lint` - Run ESLint

## Deployment

### Deploy to Vercel

1. Push your code to GitHub
2. Import your repository in [Vercel](https://vercel.com)
3. Add all environment variables in Vercel dashboard
4. Deploy!

Vercel will automatically detect Next.js and configure the build settings.

### Environment Variables for Production

Make sure to set all environment variables in your deployment platform:

- **Vercel**: Go to Project Settings → Environment Variables
- **Convex**: Set via `npx convex env set VARIABLE_NAME value`
- **Clerk**: Use production keys from Clerk Dashboard
- **Stripe**: Use live keys from Stripe Dashboard (not test keys)

## Security Notes

- Never commit `.env.local` or `.env` files
- Use production API keys only in production environment
- Ensure webhook secrets are properly configured
- End-to-end encryption is enabled for chat messages

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

See [LICENSE](LICENSE) file for details.

## Support

For issues and questions, please open an issue on GitHub.
