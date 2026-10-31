# ActivitySearch

ActivitySearch is a marketplace for group activities in Croatia. People find activities on a map, form teams with friends, book a time slot together, split the cost, and chat with end-to-end encryption. Organisers list their activities, manage bookings, and get paid through Stripe Connect.

Production: https://activitysearch.eu · Support: domemdev@gmail.com

---

## What the app does

### For people booking

- **Discover**: browse activities on a live map (MapLibre + OpenFreeMap) or as a filtered list, by category, price, difficulty and location. Each activity has photos, details, reviews and its available time slots.
- **Teams**: create a team from your friends; the team gets its own encrypted group chat.
- **Book**: the team creator books a date and time slot for one or more teams. If the slot is full, you can join a **waitlist**; when a booking is cancelled, the first team in line is offered the slot.
- **Split the cost**: each member pays their own share, or one person pays for several. You see the breakdown before saving a card: activity price + **5% service fee** + **VAT**. Cards are saved now and **charged on the activity day**. A pay-by date (7 days before) is shown; bookings still unpaid on the activity day are cancelled automatically.
- **Chat**: 1:1 and team chats, end-to-end encrypted. Reservation cards in team chats show payment progress live. Online status comes from a presence heartbeat.
- **Quests, XP and loyalty**: completing quests (system quests such as "create a team", plus quests organisers create for their activities) gives XP. Every level-up gives 10 loyalty points; points can be spent for a discount of up to 20% of a reservation (10 points = €1).
- **Reviews**: only people who attended a fulfilled (paid) reservation can review an activity, once.
- **Profiles**: avatar (photo, or a generated "boring avatar" from your name), friends, blocking, quests and level.

### For organisers

- Sign up as an organisation (separate sign-up flow), connect a **Stripe Connect** account, and see exactly what Stripe still needs, in plain language.
- Create and edit activities (photos, address with geocoding, time slots, capacity, minimum age, price).
- See reservations, payment status, earnings, Stripe balance history, and request payouts.
- Cancel any reservation (everyone is refunded), create quests, and mark quests complete for participants.

---

## How it works

### Architecture

| Layer | Technology |
| --- | --- |
| Frontend | Next.js 16 (App Router), React 19, TypeScript, Tailwind v4, shadcn/ui |
| Backend | [Convex](https://convex.dev): database, queries/mutations/actions, scheduler, crons, HTTP endpoints, file storage |
| Auth | Clerk (email + password, Google / Microsoft / Facebook), synced to Convex by webhook |
| Payments | Stripe: SetupIntents, off-session PaymentIntents, Connect destination charges, Stripe Tax |
| Maps | MapLibre GL + OpenFreeMap tiles (no API key); OpenStreetMap Nominatim for address search |
| Monitoring | Sentry (errors), PostHog (product analytics, proxied through `/ingest`) |

There is no REST API of our own: the browser talks to Convex directly (`useQuery` / `useMutation`). External systems talk to Convex HTTP actions (`convex/http.ts`):

| Endpoint | Caller | Purpose |
| --- | --- | --- |
| `POST /clerk-users-webhook` | Clerk (Svix-signed) | create, update and delete users |
| `POST /stripe/webhook` | Stripe (signed) | mark payments captured |

### Payment lifecycle

1. **Booking**: each payer saves a card with a Stripe **SetupIntent**. The server records the share and computes the amount itself; the last payer covers rounding. Nothing is charged yet. Once all shares are covered, the reservation is `on_hold`.
2. **Activity day**: an hourly cron charges every saved card **off-session**, one PaymentIntent per payer:
   - the amount is price + 5% service fee + VAT (Stripe Tax, linked to the PaymentIntent so it appears in tax reports and on receipts);
   - **destination charge**: the organiser receives the full activity price; the platform keeps the service fee and the VAT it remits (the platform is the merchant of record);
   - Stripe emails the payer a receipt (live mode only).
3. **Fulfilled**: once Stripe confirms every charge (webhook), the reservation is `fulfilled` and attendees can review.
4. **Declined card**: the attempt is recorded, the team chat is told, and the card is retried once a day, up to 3 times. Only Stripe card errors count as declines, so a retry can never double-charge (one idempotency key per attempt).
5. **Cancelling**: the organiser can cancel any time; the team creator only until the activity starts. Saved cards are released, charged payments are refunded in full (the organiser's transfer and the platform fee are reversed), spent loyalty points are returned, and the slot goes to the waitlist.
6. **Unpaid**: reservations still not fully paid on the activity day are cancelled automatically (daily cron).

Stripe's card processing fee is paid from the platform's share.

### Chat encryption

- **1:1 chats**: ECDH (P-256) between the two users' keys → HKDF → AES-256-GCM. Both sides can read their messages.
- **Team chats**: a random AES-256 team key, encrypted ("wrapped") separately for each member's public key (`teamKeys` table). Members who hold it share it with new members automatically.
- **One key pair per user, many browsers**: the first browser creates the key pair. A new browser shows a 6-digit code and must be **approved from a browser that already has the key** (like WhatsApp linked devices); the key travels encrypted to a one-time key of the new browser. If no linked browser is left, "Start fresh" creates a new key, and old messages can no longer be read.
- **Security codes**: every 1:1 chat has a 60-digit code (Signal/WhatsApp style) to compare in person; a "security code changed" notice appears when a contact's key changes.
- **Sidebar previews** are decrypted in the browser; the server only ever stores ciphertext.
- **Not the Signal Protocol**: there's no per-message key ratchet, so a stolen private key can read that user's past messages. This trade-off keeps full history on every linked browser.

### Privacy model

- Signed-out visitors see only name, username, photo and description.
- Signed-in users also see contact details, friends, level and online status.
- Blocked lists, email and loyalty balance are visible to the owner only.
- Uploads are checked on the server: images only, up to 32MB.
- Legal pages: `/terms` and `/privacy`.

---

## Project structure

```
app/                  Next.js routes
  (auth)/             sign-in, sign-up, organiser sign-up, Google "continue" step, SSO callback
  home/               map + activity search
  activities/[slug]/  activity detail and booking
  chat/               1:1, team and reservation chats
  reservations/       my reservations
  my-organisation/    organiser dashboard (activities, Stripe, payouts)
  profile/[userId]/   profiles and settings
  terms/ privacy/     legal pages
components/           UI by domain (chat, payments, reservations, organisation, profile, auth, ui)
convex/               backend
  schema.ts           all tables and indexes
  http.ts             Clerk and Stripe webhooks
  crons.ts            scheduled jobs
  reservations.ts     booking, waitlist, cancellation, payment state
  stripe.ts           SetupIntents, charges, VAT, refunds, Connect, payouts
  messages.ts teams.ts users.ts quests.ts loyalty.ts reviews.ts organisation.ts activity.ts presence.ts
  legacyEncryption.ts one-off migrations
lib/                  shared logic: encryption, pricing, reservation time zone, hooks, gamification
```

---

## Setup

### Prerequisites

Node.js 20+, pnpm 10+, and accounts for Clerk, Convex and Stripe (Sentry and PostHog are optional).

### 1. Install and start Convex

```bash
pnpm install
npx convex dev        # creates or links the deployment, pushes schema and functions, writes NEXT_PUBLIC_CONVEX_URL
```

Keep `npx convex dev` running next to `pnpm dev`: it pushes backend changes on save. If it isn't running, the frontend and backend drift apart.

### 2. Environment variables

**Next.js (`.env.local`, and Vercel for production)**

| Variable | Notes |
| --- | --- |
| `NEXT_PUBLIC_CONVEX_URL` / `CONVEX_DEPLOYMENT` | written by `npx convex dev` |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` / `CLERK_SECRET_KEY` | Clerk API keys |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key |
| `NEXT_PUBLIC_POSTHOG_KEY` / `NEXT_PUBLIC_POSTHOG_HOST` | optional; with the proxy, the host is the app origin (`/ingest` is appended) |
| `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN` | optional; the auth token uploads source maps at build time |
| `NEXT_PUBLIC_MAP_STYLE_LIGHT` / `NEXT_PUBLIC_MAP_STYLE_DARK` | optional; override the OpenFreeMap styles |

**Convex (`npx convex env set NAME value`, add `--prod` for production)**

| Variable | Notes |
| --- | --- |
| `CLERK_FRONTEND_API_URL` | Clerk Frontend API URL, used to verify JWTs (`convex/auth.config.ts`) |
| `CLERK_WEBHOOK_SECRET` | signing secret of the Clerk webhook |
| `STRIPE_SECRET_KEY` | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | signing secret of the Stripe webhook |

### 3. Clerk

1. Create the application; enable the OAuth providers you want and **username** as a required field. Google sign-ups without a username finish on `/sign-up/continue`.
2. Webhook → `https://<deployment>.convex.site/clerk-users-webhook`, events `user.created`, `user.updated`, `user.deleted`; put the signing secret in Convex as `CLERK_WEBHOOK_SECRET`.
3. In the JWT templates, keep the `convex` template that Convex expects.

### 4. Stripe

1. Enable **Connect** (organisers onboard through the app).
2. Webhook → `https://<deployment>.convex.site/stripe/webhook`, events `payment_intent.succeeded`, `payment_intent.canceled`, `setup_intent.succeeded`, `account.updated`; put the signing secret in Convex as `STRIPE_WEBHOOK_SECRET`.
3. Turn on **Stripe Tax**: add the platform's business address and VAT registration. Without a registration, VAT is calculated as €0 and charges go through without VAT.
4. For receipts: **Settings → Customer emails → Successful payments** (live mode only).

### 5. Run

```bash
pnpm dev          # http://localhost:3000
```

---

## Scripts

| Command | What it does |
| --- | --- |
| `pnpm dev` | Next.js dev server |
| `pnpm build` / `pnpm start` | production build / server |
| `pnpm lint` | ESLint (must be clean) |
| `pnpm test` | Vitest + convex-test (`convex/**/*.test.ts`, `lib/**/*.test.ts`) |
| `npx convex dev` | push backend changes to the dev deployment on save |
| `npx convex deploy` | deploy backend to production |

The tests cover payments (amounts, rounding, fulfilment, cancellation, declines), permissions (cancelling, team deletion, message migration, profile privacy, team keys, key backups), VAT and fee split, encryption, Stripe requirement labels, search, and reservation time zones.

---

## Deployment

1. **Backend**: `npx convex deploy`. It pushes the schema and functions to production, and fails if existing data doesn't match the schema.
2. **Frontend**: Vercel builds the Next.js app from `main`; set the Next.js variables above in Vercel with **live** keys.
3. **Production Convex env**: set the four Convex variables with `--prod`, using the live Stripe keys and the production Clerk instance.
4. Point the Clerk and Stripe webhooks at the **production** `.convex.site` URL.
5. Run any pending one-off migrations (below) with `--prod`.

### Background jobs (`convex/crons.ts`)

| Schedule | Job |
| --- | --- |
| Daily 00:00 UTC | cancel reservations still unpaid on the activity day, refund and notify |
| Hourly | charge saved cards for today's reservations; retry declined cards daily for a few days |

All dates and times are Europe/Zagreb wall-clock times (`lib/reservationTime.ts`).

### One-off migrations

Run once per deployment after deploying the code that contains them:

```bash
npx convex run legacyEncryption:decryptLegacyMessages --prod   # old, insecure chat encryption → plain text (authors re-encrypt)
npx convex run legacyEncryption:dropLegacyKeyData --prod       # delete old passcode key backups and team public keys
```

Status: done on dev. After they've run on production, drop `keyBackups` and `teams.teamPublicKey` from `convex/schema.ts`.

---

## Operations and troubleshooting

- **Logs**: Convex dashboard → Logs (webhooks, crons, Stripe errors); Sentry for frontend errors.
- **Google sign-in works but no user appears**: the Clerk webhook isn't reaching Convex. Check the endpoint URL (production `.convex.site`) and `CLERK_WEBHOOK_SECRET` (a 401 in the logs means a wrong secret).
- **Google sign-in fails only in production**: add the domain in Clerk; add the origin and Clerk's exact OAuth callback URL in the Google Cloud OAuth client; `CLERK_FRONTEND_API_URL` in Convex must match the production Clerk instance.
- **Frontend error after a backend change** (for example `Cannot read properties of undefined`): the Convex deployment is running old code. Run `npx convex dev` (dev) or `npx convex deploy` (production).
- **VAT shows €0**: Stripe Tax isn't active or has no VAT registration.
- **A payment never got charged**: look for `Charging payment row … failed` in the Convex logs and for `chargeAttempts` on the `reservationPayments` row; after 3 declines the payer has to sort it out with the organiser.
- **Someone can't read chat messages in a new browser**: the browser must be approved from one that already has the key (chat shows "Link this browser").

---

## Known limits and decisions

- **Platform as merchant of record**: VAT is collected and remitted by the platform. One tax code (general services, taxed at the platform's place of supply) is used for every activity; taxing by activity location needs Stripe's Tax Locations API (preview).
- **Invoices**: Stripe receipts are payment confirmations, not VAT invoices; Croatian fiscalization isn't implemented.
- **Cookie consent**: PostHog analytics loads without a consent banner. A banner is needed before launch in the EU.
- **Team keys aren't rotated** when a member leaves (they can no longer fetch messages, but could have kept the key).
- **Scans that are fine at current scale** are marked in code with `shortcut:` comments, each with the point where it needs an upgrade.

## Security notes

- Never commit `.env.local`; use live keys only in production.
- Both webhooks verify signatures and reject unsigned requests.
- Report security issues privately to domemdev@gmail.com.

## License

See [LICENSE](LICENSE).
