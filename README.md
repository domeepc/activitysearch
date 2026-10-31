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

The browser talks to Convex directly; Clerk and Stripe notify the backend through signed webhooks.

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

## Known limits and decisions

- **Platform as merchant of record**: VAT is collected and remitted by the platform. One tax code (general services, taxed at the platform's place of supply) is used for every activity; taxing by activity location needs Stripe's Tax Locations API (preview).
- **Invoices**: Stripe receipts are payment confirmations, not VAT invoices; Croatian fiscalization isn't implemented.
- **Cookie consent**: PostHog analytics loads without a consent banner. A banner is needed before launch in the EU.
- **Team keys aren't rotated** when a member leaves (they can no longer fetch messages, but could have kept the key).
- **Scans that are fine at current scale** are marked in code with `shortcut:` comments, each with the point where it needs an upgrade.

## Security

- Both webhooks verify signatures and reject unsigned requests.
- Please report security issues privately to domemdev@gmail.com.

## License

Proprietary. Copyright (c) 2026 Domagoj Milardovic. All rights reserved.
No part of this software may be used, copied, modified or distributed without written permission. See [LICENSE](LICENSE).
