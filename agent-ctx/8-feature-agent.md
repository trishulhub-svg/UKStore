# Task 8: PWA, Rate Limiting, Google OAuth, Order Refund

## Summary
Implemented four lower-priority features for the Fresh Mart London grocery delivery app.

## Feature 1: PWA Support
- Created `/public/manifest.json` with app name, icons, theme color, and display settings
- Created `/public/sw.js` service worker with:
  - Cache-first strategy for static assets (JS, CSS, images, fonts)
  - Network-first strategy for API calls and HTML pages
  - App shell pre-caching for offline access
  - Old cache cleanup on activation
- Generated PWA icons using z-ai-generate:
  - `/public/icon-192.png` (192x192)
  - `/public/icon-512.png` (512x512)
- Created `/src/components/pwa-sw-register.tsx` client component for service worker registration
- Updated `/src/app/layout.tsx`:
  - Added `Viewport` export with themeColor
  - Added `manifest` to metadata
  - Added `apple` icon and `appleWebApp` config
  - Rendered `<ServiceWorkerRegistration />` in body

## Feature 2: API Rate Limiting
- Created `/src/lib/rate-limit.ts` with:
  - In-memory rate limiter using Map (keyed by IP)
  - `checkRateLimit()` function with configurable limit and window
  - `getClientIp()` to extract client IP from headers
  - `RATE_LIMIT_PRESETS` for general (100/min), auth (10/min), checkout (5/min)
  - `withRateLimit()` higher-order function to wrap API route handlers
  - Automatic cleanup of expired entries every 60 seconds
  - Returns 429 with Retry-After header when limit exceeded
  - Adds X-RateLimit-* headers to successful responses

## Feature 3: Google OAuth Integration
- Created `/src/app/api/auth/google/route.ts`:
  - GET handler redirects to Google OAuth consent screen
  - Reads client ID from store settings (with env var fallback)
  - Generates CSRF state token stored in cookie
  - Supports redirect parameter preservation
- Created `/src/app/api/auth/google/callback/route.ts`:
  - GET handler exchanges code for tokens
  - Fetches user profile from Google
  - Finds or creates user in database
  - Sets session cookie
  - Redirects based on user role (admin/driver/picker/customer)
  - Validates state for CSRF protection
- Added Google Sign In buttons to:
  - `/src/components/auth/login-client.tsx` (with SiGoogle icon from react-icons)
  - `/src/components/auth/auth-modal.tsx` (both login and register views)
- Installed `react-icons` package for Google icon

## Feature 4: Order Refund Flow
- Created `/src/app/api/admin/orders/[id]/refund/route.ts`:
  - POST handler requires admin auth
  - Validates order exists and can be refunded
  - Creates Stripe refund if paid via Stripe with payment intent
  - Updates order: status=cancelled, paymentStatus=refunded
  - Records refund amount and reason in order notes
  - Creates customer notification
- Updated `/src/components/admin/kanban-order-board.tsx`:
  - Added "Refund Order" button (destructive variant) for paid/pending orders
  - AlertDialog confirmation with reason textarea
  - Shows refund info specific to payment method (Stripe/cash/bank_transfer)
  - Added "Refunded" badge for already refunded orders
  - Added "Cancelled" column to kanban board
  - Added `handleRefund` function in main board component
- Updated `/src/components/customer/order-confirmation-client.tsx`:
  - Shows red "Order Refunded" alert banner for refunded orders
  - Shows amber "Order Cancelled" alert for cancelled non-refunded orders
  - Hides success banner when order is refunded/cancelled
  - Displays refund reason extracted from order notes
  - Properly formats cancelled status text

## Files Created
- `/public/manifest.json`
- `/public/sw.js`
- `/public/icon-192.png`
- `/public/icon-512.png`
- `/src/components/pwa-sw-register.tsx`
- `/src/lib/rate-limit.ts`
- `/src/app/api/auth/google/route.ts`
- `/src/app/api/auth/google/callback/route.ts`
- `/src/app/api/admin/orders/[id]/refund/route.ts`

## Files Modified
- `/src/app/layout.tsx` (PWA metadata, service worker registration)
- `/src/components/auth/login-client.tsx` (Google Sign In button)
- `/src/components/auth/auth-modal.tsx` (Google buttons in login & register views)
- `/src/components/admin/kanban-order-board.tsx` (refund button, cancelled column)
- `/src/components/customer/order-confirmation-client.tsx` (refund/cancel banners)

## Packages Installed
- `react-icons` (for SiGoogle icon)
