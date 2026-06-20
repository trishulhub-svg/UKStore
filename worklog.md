---
Task ID: 1
Agent: Main
Task: Implement location-based delivery zone detection with GPS and postcode geocoding

Work Log:
- Explored codebase: Prisma Store model already had deliveryRadiusKm, latitude, longitude, address, phone, email fields
- Admin StoreStatusManager already had UI for editing deliveryRadiusKm
- Admin StoreProfileEditor already had UI for editing address, lat/lng, phone, email
- Footer already showed dynamic address/phone/email from StoreInfoProvider
- Created DeliveryLocationProvider context (src/lib/delivery-location.tsx) with:
  - User location tracking (GPS, postcode, manual address)
  - Distance calculation from store using Haversine formula
  - Delivery zone validation (within radius or not)
  - Persistence to localStorage
  - Geocoding helpers (geocodePostcode via postcodes.io, geocodeAddress, requestBrowserLocation)
- Created /api/geocode route (src/app/api/geocode/route.ts) for server-side UK postcode geocoding
- Rewrote PostcodeGate component with:
  - "Use My Current Location" GPS button using navigator.geolocation
  - Postcode geocoding via postcodes.io
  - Delivery zone check after geocoding
  - "In Zone" success animation with distance display
  - "Outside Zone" error state with retry option
- Updated CartSidebar to use useDeliveryLocation() for real distance-based fee calculation
- Updated CartClient with real distance, delivery zone warnings, and zone-aware checkout button
- Replaced hardcoded distanceKm=2 in CheckoutClient with:
  - Real distance from DeliveryLocationProvider context
  - Address geocoding on "Continue" button click
  - Delivery zone validation blocking checkout if outside radius
  - Visual delivery zone info (green/red) showing distance and fee breakdown
- Updated Navbar location picker with:
  - GPS detection button ("Use My Current Location")
  - Postcode geocoding with delivery zone check
  - Zone status display (green for in-zone, red for outside)
  - Distance info in the top bar
- Added DeliveryLocationProvider to root layout alongside StoreInfoProvider
- Build succeeded, all APIs tested, pushed to main

Stage Summary:
- Customers can now use GPS or enter postcode to check delivery zone
- Owner can set/change delivery radius in admin settings (already existed)
- Real distance-based delivery fee calculation replaces hardcoded values
- Checkout blocked if delivery address is outside the delivery radius
- Manual address entry at checkout geocoded and validated against zone
- All changes pushed to main branch (commit b8039bd)

---
Task ID: 2
Agent: Main
Task: Product expiry auto-wastage, remove attendance, PDF export drivers/customers, employee creation with temp password + force-reset, self-service profile + password change, owner-only email change, customer data protection, default banner images + delete option, visualized finance PDF, wastage PDF export, responsiveness audit

Work Log:
- Updated Prisma schema (prisma/schema.prisma): added `mustResetPassword` to User, `defaultBanner1Url`/`defaultBanner2Url` to Store
- Updated runtime SQL schema in src/lib/auth/prisma.ts:
  - Added columns to CREATE TABLE statements (users.mustResetPassword, stores.logoUrl/defaultBanner1Url/defaultBanner2Url, products.expiryDate/bestBeforeDate, shifts.manualHours)
  - Added idempotent COLUMN_MIGRATIONS runner that uses PRAGMA table_info to add missing columns to existing DBs without dropping data
  - Wired migration runner into all DB init paths (existing DB, bundled DB copy, fresh DB create)
- Regenerated Prisma client (npx prisma generate)
- Removed attendance section completely:
  - Deleted src/app/admin/attendance/, src/app/picker/attendance/
  - Deleted src/app/api/admin/attendance/, src/app/api/attendance/
  - Deleted src/components/admin/attendance-client.tsx, src/components/picker/picker-attendance-client.tsx
  - Deleted src/components/shared/clock-in-out-button.tsx
  - Removed attendance nav link from picker-layout, removed ClockInOutButton from picker-layout + driver-layout
  - Cleaned picker-dashboard-client to remove attendance state, timer, and clock-in/out card
- Added PDF export to admin/drivers page (handleExportPdf with all driver fields, deliveries total in footer)
- Employee creation flow:
  - POST /api/admin/employees: creates user with bcrypt-hashed temp password, mustResetPassword=true, generates 12-char secure temp password (upper+lower+digits+symbols), creates empty EmployeeProfile (and DriverProfile if DRIVER role)
  - /api/auth/login: returns mustResetPassword flag in response
  - /api/auth/reset-password POST: handles both forced (first login, no current password needed) and self-initiated (requires current password)
  - Created /auth/reset-password page with strength hints, forced flag handling, role-based redirect after reset
  - Updated auth-client.ts to propagate mustResetPassword flag
  - Updated login-client to redirect to /auth/reset-password?forced=1 when mustResetPassword is true
  - Added "Add Employee" button + dialog on admin/employees page with role select (PICKER/DRIVER/MANAGER), shows generated temp password once with copy-to-clipboard
- Self-service profile + password change:
  - Created /api/user/profile (GET + PATCH) — self-only updates for name/phone/avatarUrl
  - Created /account/profile page (works for ALL roles: customer/driver/picker/manager/owner) with ProfileClient
  - Added "Profile" links in admin shell (desktop sidebar + mobile drawer), picker profile card, driver profile card, customer account page
  - Customer account page now has "My Profile & Settings" button
- Owner-only email change + customer data protection:
  - PATCH /api/admin/employees/[id] now accepts name/phone/email/role/isActive + salary fields
  - Email/role/isActive changes restricted to OWNER role (managers get 403)
  - Prevents self-demotion and self-deactivation
  - Admin customer PATCH (/api/admin/customers/[id]) only allows isActive toggle — personal data (name/email/phone) only changeable by customer themselves via /api/user/profile
- Default banner images + delete option:
  - Added defaultBanner1Url/defaultBanner2Url to Store schema + API
  - Updated /api/banners to return defaultBanners array
  - Updated BannerCarousel to use: 1) promotional banners, 2) default banners, 3) gradient placeholders (last resort)
  - Added "Default Banner Images" section at top of /admin/banners page with 2 upload slots, replace-only (no delete)
  - Promotional banners below have existing toggle + delete option
- Visualized finance PDF:
  - Rewrote finance-client.tsx to draw bar chart (daily revenue vs expenses with axis labels, gridlines, legend) and pie/donut chart (expense breakdown by category with color-coded slices, legend, center total)
  - 3-page PDF: cover+summary+charts, top orders+expenses tables, payment methods breakdown
- Wastage logs PDF export: already exists in wastage-client.tsx (jsPDF + autotable with red-themed header)
- Responsiveness audit: all major pages already had mobile card views + responsive grids. Verified admin shell, customers, drivers, employees, products, orders, banners, finance, shifts, picker pages, driver pages, customer navbar/catalog/checkout/account all responsive
- Build succeeded with no new errors (only pre-existing Stripe optional-dep warnings)

Stage Summary:
- Products: expiry/best-before fields + auto-expire-to-wastage flow already in place from prior session (verified)
- Attendance: completely removed from UI, APIs, components, nav (table kept in DB schema for safety)
- PDF export: added to drivers, customers, products, wastage, finance (now visualized with charts)
- Employee lifecycle: admin creates with temp password → emailed/shared manually → employee forced to reset on first login → can self-edit name/phone/password → owner can change email/role/status
- Customer data: only customer themselves can edit personal data; admin can only ban/unban
- Banners: 2 default images (admin-uploadable, not deletable) shown when no promotional banners; promotional banners have toggle + delete
- All changes build cleanly and pass TypeScript checks

---
Task ID: 3
Agent: Main
Task: Fix "failed to load employees" + all admin data loading failures (products, categories, drivers, customers, banners, shifts, wastage, finance)

Work Log:
- Investigated root cause: existing SQLite DB at db/custom.db was created with an OLDER schema and never had its missing tables/columns added.
- DB inspection revealed:
  * Missing tables: `banners`, `employee_profiles` (never created because SCHEMA_SQL had CREATE TABLE IF NOT EXISTS, but the DB was already considered "valid" by verifyDatabaseSchema() which only checks 6 core tables)
  * Missing columns on `users`: `mustResetPassword`
  * Missing columns on `products`: `originalPrice`, `images`, `brand`, `rating`, `reviewCount`, `expiryDate`, `bestBeforeDate`
  * Missing columns on `stores`: `logoUrl`, `defaultBanner1Url`, `defaultBanner2Url`
  * Missing columns on `shifts`: `manualHours`
  * Missing columns on `orders`: `promotionId`, `discountAmount`
- Root cause in src/lib/auth/prisma.ts:
  * `initializeDatabaseAtPath()` for existing DBs only ran `runColumnMigrations()`, never `executeSchemaSql()` — so newly-added tables (banners, employee_profiles) never got created on existing DBs
  * `SCHEMA_SQL` block was missing `banners` and `employee_profiles` table definitions entirely
  * `COLUMN_MIGRATIONS` list was missing 5 columns: `products.originalPrice`, `products.images`, `products.brand`, `products.rating`, `products.reviewCount`
- Fixes applied to src/lib/auth/prisma.ts:
  1. Added `banners` table definition to SCHEMA_SQL block (with all columns including `linkUrl`, `linkCategory`, `sortOrder`, `isActive`)
  2. Added `employee_profiles` table definition to SCHEMA_SQL block (with `userId` unique index)
  3. Added 5 missing columns to COLUMN_MIGRATIONS: products.originalPrice, products.images, products.brand, products.rating, products.reviewCount
  4. Added 11 more missing columns to COLUMN_MIGRATIONS: orders.promotionId, orders.discountAmount, orders.bankTransferRef, orders.bankTransferVerified, orders.deliveryPhotoUrl, orders.batchGroup, orders.packedAt, orders.dispatchedAt, orders.deliveredAt, orders.hasChallenge25, orders.challenge25Verified, order_items.picked
  5. Created new helper `ensureAllTablesExist()` that wraps `executeSchemaSql()` — runs all CREATE TABLE IF NOT EXISTS statements (idempotent)
  6. Updated both existing-DB code paths (existing-DB-valid path + bundled-DB-valid path) to call `ensureAllTablesExist()` THEN `runColumnMigrations()` — so new tables get created AND new columns get added on every restart
- Direct DB patch script: scripts/patch-db-schema.py — runs the same ALTER TABLE / CREATE TABLE operations directly against the existing DB file via sqlite3 module (so the fix takes effect immediately without requiring a server restart)
- Verified fix by running patch-db-schema.py + curl-testing all admin API endpoints:
  * /api/admin/employees ✅ returned 2 employees (Store Owner + Demo Driver)
  * /api/admin/products ✅ returned empty array (no data seeded, no error)
  * /api/admin/categories ✅ returned empty array (no data seeded, no error)
  * /api/admin/drivers ✅ returned driver with full profile
  * /api/admin/customers ✅ returned Demo Customer
  * /api/admin/banners ✅ returned empty array (table now exists)
  * /api/admin/shifts ✅ returned shifts + staff list
  * /api/admin/wastage ✅ returned wastage logs + summary
  * /api/admin/finance/report ✅ returned full finance report with daily chart data
- TypeScript check confirmed no new errors introduced by the prisma.ts changes (only pre-existing Stripe/nodemailer optional-dep warnings remain)

Stage Summary:
- Root cause: stale DB schema (older than current Prisma schema) combined with incomplete runtime migration logic in prisma.ts
- Fix has two layers: (1) permanent fix in prisma.ts so future DBs are always migrated correctly, (2) one-time DB patch script that brings the current DB up to date immediately
- All admin pages should now load data correctly when the user refreshes the browser
- The patch-db-schema.py script is safe to re-run (idempotent) and can be deleted after this fix is verified

---
Task ID: 4
Agent: Main
Task: Fix "Failed to load products/employees/etc" across all admin pages — comprehensive data-loading audit + fix + push

Work Log:
- Server-side investigation: All 20 admin API endpoints + 9 customer-facing endpoints return 200 OK when tested with a valid session cookie (via curl). Server logs show successful 200 responses for every endpoint.
- Root cause: EXPIRED SESSION COOKIE. When the user's session cookie expires or is missing, the middleware returns 401 { error: 'Authentication required' } for any /api/admin/* request. Each admin page's `if (!res.ok) throw new Error()` triggered the catch block → `toast.error('Failed to load X')`. The user sees the toast but stays on the broken page with no auto-redirect to login.
- Ran a comprehensive audit via Explore subagent across 30+ admin/customer/driver/picker pages and 16 API routes. Confirmed:
  * Zero client↔API response-shape mismatches (all `data.products`, `data.employees`, etc. match)
  * The "Failed to load" symptom is purely a 401 handling issue
  * 5 specific silent-failure bugs that crash pages on 401 (analytics, driver-earnings, driver-profile, picker-profile, bank-holiday-mode-change)
  * 1 wrong-URL bug in notifications-client.tsx (duplicate `notifications` segment)
- Created src/lib/api-fetch.ts — global fetch wrapper:
  * apiFetch(url, init) — on 401, redirects to /auth/login?redirect=<currentPath> and throws 'Session expired — redirecting to login'
  * apiFetchJson<T>(url, init) — convenience wrapper that also throws on non-OK
  * redirectOn401: false option for endpoints where 401 is acceptable (navbar, footer)
- Bulk-converted ALL raw fetch() calls across 42 client components to apiFetch():
  * 14 admin pages (products, categories, customers, drivers, employees, orders, banners, shifts, wastage, finance, promotions, delivery-zones, analytics, settings)
  * 12 admin components (kanban, low-stock, bank-holidays, notification-editor, store-status, store-profile, csv-import-export, delivery-map, shifts-client, admin-settings, admin-dashboard, finance-client)
  * 11 customer pages (home, orders, favourites, addresses, notifications, banner-carousel, checkout, cross-sell-slider, order-tracking, predictive-search, product-detail)
  * 4 driver pages (dashboard, order-flow, earnings, profile)
  * 3 picker pages (dashboard, packing, profile)
  * Profile page (works for all roles — customer/driver/picker/manager/owner)
  * Navbar + Footer (with redirectOn401: false since they're on every page including login)
- Updated toast error catch blocks to skip the toast when err.message === 'Session expired — redirecting to login' — so users don't see a confusing error message right before being redirected to login.
- Fixed 5 specific bugs:
  1. admin/analytics/page.tsx — added res.ok check + shape validation. On 401, was setting data = {error: '...'} which then crashed on summary.totalRevenue access (TypeError).
  2. driver/driver-earnings-client.tsx — same fix. Was crashing on data.today.earnings.toFixed(2) when data was the error object.
  3. driver/driver-profile-client.tsx — added res.ok check + null data guard.
  4. picker/picker-profile-client.tsx — same fix.
  5. customer/notifications-client.tsx — fixed handleMarkAllRead URL bug. Was calling /api/user/notifications/notifications (duplicate segment, 404). Now loops through unread notifications and marks each one read via the existing /api/user/notifications/[id] PATCH endpoint.
  6. admin/bank-holiday-manager.tsx — handleModeChange was DELETE-then-POST without checking res.ok on either. If POST failed, holiday was deleted but never recreated (silent data loss). Now checks res.ok on both.
- Auth fetches intentionally NOT converted: src/lib/auth-client.ts and src/components/auth/reset-password-client.tsx — these call /api/auth/login, /api/auth/register, /api/auth/reset-password, /api/auth/session where 401 means "wrong credentials" not "session expired". Converting them would cause an infinite redirect loop on the login page.
- External API fetches (postcodes.io, Google OAuth) NOT converted — they're server-side and don't go through our session system.
- TypeScript check: All pre-existing errors remain (Stripe/nodemailer optional deps, Prisma type mismatches in API routes). No NEW errors introduced by the apiFetch conversion.
- Production build: PASSED (✓ Compiled successfully in 14.4s, ✓ 67/67 static pages generated).
- Runtime verification: All admin endpoints return 200 OK with valid session, 401 without session (correct behavior).
- Committed as 4efa831 and pushed to origin/main.

Stage Summary:
- ROOT CAUSE: Expired session cookie → 401 from middleware → each page's catch block shows "Failed to load X" toast with no redirect to login
- FIX: Created global apiFetch() wrapper that auto-redirects to /auth/login on 401, and converted every client-side fetch() call across 42 components
- ALSO FIXED: 5 silent-failure bugs that crashed pages on auth errors, 1 wrong-URL bug in notifications, 1 partial-failure data-loss bug in bank-holiday mode change
- Build passes, all endpoints verified, pushed to GitHub
- User should now: (1) HARD REFRESH the browser (Ctrl+Shift+R) to load the new JS bundles, (2) if on a deployed Vercel build, wait for the auto-deploy to complete, (3) if session expired, they'll be auto-redirected to login instead of seeing "Failed to load" toasts

---
Task ID: 11
Agent: Main
Task: Implement device-login limits per role (Admin=1, Employee=2 mobile+desktop, Customer=unlimited) + admin-controlled per-employee feature permission toggles

Work Log:
- Added two new Prisma models:
  * `Session` (id, userId, tokenHash, deviceType, deviceName, userAgent, ipAddress, createdAt, lastSeenAt, expiresAt) — for device-tracking and revocation
  * `EmployeeFeaturePermission` (id, userId unique, features JSON array, createdAt, updatedAt) — for feature toggles
- Updated `src/lib/auth/prisma.ts` SCHEMA_SQL block to include CREATE TABLE statements for both new tables (idempotent — runs on every DB init via ensureAllTablesExist)
- Updated `src/lib/auth/index.ts`:
  * Added `sid?: string` (session row ID) to SessionPayload — embeds the session row ID in the JWT for revocation checks
  * Added `hashSessionToken(token)` helper for storing token hashes in the Session table
- Updated `src/lib/auth/edge.ts` — added `sid?` field to Edge SessionPayload (mirror of Node version)
- Updated `src/lib/auth/server.ts`:
  * `getServerUser()` now validates the session row exists in DB (when `sid` is present in the token)
  * If session row is missing or expired → returns null (effectively logs the user out on next API call)
  * Added 10-second in-memory cache (keyed by token) to avoid hitting DB on every request
  * Updates `lastSeenAt` on each session hit
  * Added `invalidateSessionCache(token)` for use after revocation
- Created `src/lib/session-manager.ts`:
  * `parseUserAgent(ua)` — detects deviceType (mobile/tablet/desktop) + human-readable name (e.g. "Chrome on iPhone")
  * `getClientIp(request)` — respects X-Forwarded-For
  * `enforceDeviceLimit(userId, role, newDeviceType)` — the core device-limit logic:
    - CUSTOMER: no limit
    - OWNER: max 1 device — revoke ALL prior sessions on new login
    - DRIVER/PICKER: max 2 devices (1 mobile + 1 desktop). Tablet/unknown normalize to mobile.
      - If a same-type session exists → revoke it (replace)
      - If 2 opposite-type sessions exist → reject with DEVICE_LIMIT_REACHED
      - Otherwise → allow (creates new session)
  * `createSession`, `revokeSession`, `revokeAllUserSessions`, `revokeSessionByToken`, `listUserSessions`
- Updated `src/app/api/auth/login/route.ts`:
  * Parses User-Agent + IP for device info
  * Calls `enforceDeviceLimit()` BEFORE creating the new session
  * If rejected → returns 403 with code `DEVICE_LIMIT_REACHED` + helpful message
  * If allowed → creates session row, embeds `sid` in token, sets cookie
  * Also checks `user.isActive === false` → returns 403 `ACCOUNT_DEACTIVATED`
- Updated `src/app/api/auth/register/route.ts` — same pattern (creates session for new customers, no limit)
- Updated `src/app/api/auth/logout/route.ts` — deletes session row by sid (or token hash for legacy tokens)
- Updated `src/app/api/auth/reset-password/route.ts` — on forced reset (first login), revokes all OTHER sessions (security best practice for shared temp passwords)
- Created `src/lib/feature-permissions.ts`:
  * `FEATURE_CATALOG` — 22 features grouped by Admin/Driver/Picker (kanban, orders, products, categories, customers, drivers, employees, banners, shifts, finance, wastage, promotions, delivery_zones, analytics, settings, admin_dashboard, driver_dashboard, driver_earnings, driver_profile, picker_dashboard, picker_packing, picker_profile)
  * `getEnabledFeatures(userId, role)` — returns null (full access) or Set<featureKey>
  * `hasFeatureAccess(userId, role, featureKey)` — OWNER always true, no row = true (default open), row exists = check list
  * `setEnabledFeatures(userId, features | null)` — set or clear restriction
  * `getFeatureKeyForAdminRoute(pathname)`, `getFeatureKeyForDriverRoute`, `getFeatureKeyForPickerRoute`, `getFeatureKeyForAdminApiRoute`, `getFeatureKeyForEmployeeApiRoute` — route-prefix → feature-key mappers
  * `requireDriver({ feature })` — inline guard for /api/driver/* routes (replaces manual `getServerUser() + role check` pattern)
  * `requirePicker({ feature })` — same for /api/picker/*
- Updated `src/lib/admin-auth.ts`:
  * `requireAdmin({ feature })` — added optional feature parameter. OWNER bypasses; MANAGER is checked against the permission list.
  * Added `requireEmployee({ feature })` for non-admin employee endpoints
- Updated 37 admin API route files via `scripts/add-feature-checks.py`:
  * Replaced `await requireAdmin()` with `await requireAdmin({ feature: '<key>' })` based on path prefix
  * E.g. /api/admin/products/* → feature: 'products'; /api/admin/finance/* → 'finance'; /api/admin/expenses/* → 'finance'; /api/admin/bank-holidays/* → 'settings'; /api/admin/store/* → 'settings'
  * Skipped /api/admin/sessions/* (admin-only by default, no feature check needed) and /api/admin/employees/[id]/permissions (OWNER-only check inside route)
- Updated 5 driver API route files + 3 picker API route files via `scripts/add-employee-feature-checks.py`:
  * Replaced `const user = await getServerUser(); if (!user) ...; if (user.role.toLowerCase() !== 'driver') ...` with `const { error, user } = await requireDriver({ feature: '...' }); if (error) return error`
  * Driver routes: /api/driver/orders/* → driver_dashboard; /api/driver/earnings → driver_earnings; /api/driver/profile → driver_profile
  * Picker routes: /api/picker/orders/* → picker_packing; /api/picker/profile → picker_profile
- Created new API endpoints:
  * `GET /api/admin/employees/[id]/permissions` — returns features list + applicable catalog (filtered by user's role)
  * `PUT /api/admin/employees/[id]/permissions` — OWNER-only; sets feature list (null = full access, array = restricted)
  * `GET /api/admin/employees/[id]/sessions` — lists all active sessions for one employee
  * `GET /api/admin/sessions?userId=X` — lists all sessions across all employees (for admin monitoring)
  * `DELETE /api/admin/sessions` — bulk revoke: `{ userId }` revokes all for one user; `{ allEmployees: true }` revokes all employee sessions
  * `DELETE /api/admin/sessions/[id]` — revokes one session by ID
  * `GET /api/user/permissions` — self-service lookup (for driver/picker layouts to filter nav items)
- Updated `src/app/admin/layout.tsx`:
  * Now fetches `enabledFeatures` for the current user via `getEnabledFeaturesList(user.id, user.role)`
  * Passes `userRole` and `enabledFeatures` to AdminShell
- Updated `src/components/admin/admin-shell.tsx`:
  * Nav items now have a `feature` key (e.g. 'products', 'orders')
  * Filters `visibleNavItems` based on `enabledFeatures` (null = show all, array = show only listed)
  * User info panel shows role badge + "Restricted" indicator when permissions are limited
  * Both desktop sidebar and mobile drawer use the filtered nav list
- Updated `src/components/driver/driver-layout.tsx` and `src/components/picker/picker-layout.tsx`:
  * Fetch current user's permissions from /api/user/permissions on mount
  * Filter nav items based on enabledFeatures
- Updated `src/app/admin/employees/page.tsx`:
  * Added "Permissions" button per employee row (hidden for OWNER — OWNER can't be restricted)
  * Added "Sessions" button per employee row
  * Both buttons appear in desktop table Actions column AND in mobile card layout
- Created `src/components/admin/employee-permissions-dialog.tsx`:
  * Modal with "Full Access" vs "Restricted Access" toggle
  * When restricted: shows checkboxes for each feature, grouped by Admin/Driver/Picker
  * "Select All" / "Clear All" buttons
  * Shows the feature label, description, and On/Off badge per row
  * Warns when 0 features selected (user can still log in but sees nothing)
- Created `src/components/admin/employee-sessions-dialog.tsx`:
  * Lists all active sessions with device icon (mobile/tablet/desktop), device name, IP, created/last-seen/expires timestamps
  * "Revoke" button per session (immediately logs out that device on its next API call)
  * "Revoke All" button with confirmation
  * Shows the device-limit policy for the user's role (e.g. "2 devices max (1 mobile + 1 desktop)")
- Generated Prisma client with `npx prisma generate`
- Verified DB schema: both `sessions` and `employee_feature_permissions` tables exist with correct columns
- End-to-end tested:
  * Admin login on desktop → session created with deviceName="Chrome on Linux", deviceType="desktop"
  * Admin login on mobile → previous desktop session revoked, mobile session created (admin max 1 device ✓)
  * Old admin session cookie → 401 on next API call (revocation works ✓)
  * Driver device-limit logic tested via scripts/test-device-limit.ts — all 5 scenarios pass:
    1. First desktop login → allowed
    2. Mobile login → allowed (1+1)
    3. Tablet login → allowed (replaces existing mobile — tablet normalizes to mobile)
    4. Desktop replacement → revokes old desktop
    5. Owner replacement → revokes ALL prior owner sessions
  * Feature permissions API:
    - GET returns `features: null` (full access) for users with no restriction row
    - PUT accepts `features: [...]` array or `null` (clears restriction)
    - PUT on OWNER → 400 "Cannot restrict the store owner account"
    - GET on OWNER → returns full catalog (22 features), canRestrict=false
    - GET on DRIVER → returns applicable catalog (5 features: kanban, orders, driver_dashboard, driver_earnings, driver_profile), canRestrict=true
  * /api/user/permissions self-service endpoint works (returns user's own features + catalog)
  * /api/admin/sessions lists all sessions across users with user info
  * All admin pages render 200 (admin, admin/employees, admin/products)
  * Driver page renders 200
- TypeScript check: NO NEW ERRORS introduced (all remaining errors are pre-existing Stripe/Supabase/nodemailer/prisma optional-dep issues)
- Production build: ✓ Compiled successfully in 11.5s, all routes generated

Stage Summary:
- DEVICE-LOGIN LIMITS (per user request):
  * Admin (OWNER): 1 device max — new login kicks out the old device
  * Employees (DRIVER/PICKER): 2 devices max (1 mobile + 1 desktop) — same-type login replaces the old session; if both type slots are full and a new device of a different type tries to log in, the login is rejected with a clear error message
  * Customers: unlimited (sessions are tracked for audit but not capped)
  * Revocation takes effect immediately on the next API call (the user is redirected to /auth/login by the apiFetch wrapper)
  * Admin can view and revoke any employee's sessions from /admin/employees → Sessions button

- FEATURE PERMISSION TOGGLES (per user request):
  * Admin (OWNER) opens /admin/employees → clicks "Permissions" on any employee → chooses "Full Access" or "Restricted Access"
  * When restricted, admin sees a categorized checkbox list of features applicable to that employee's role (e.g. a DRIVER sees driver_dashboard, driver_earnings, driver_profile, kanban, orders; a MANAGER sees all admin features)
  * OWNER cannot be restricted (full access always)
  * Default = full access (no row exists) — existing employees keep working unchanged
  * Enforcement is two-layered:
    1. SERVER-SIDE: every /api/admin/* route calls `requireAdmin({ feature: 'X' })` which returns 403 FEATURE_NOT_ENABLED if the user lacks the feature
    2. CLIENT-SIDE: AdminShell filters nav items so the user doesn't see links to features they don't have
  * Same pattern for /api/driver/* and /api/picker/* via requireDriver/requirePicker guards
  * Driver and Picker layouts fetch /api/user/permissions on mount and filter their bottom nav accordingly
  * Example: Admin can give Employee A access to "Orders" + "Kanban" but not "Products" or "Finance" — Employee A will only see those nav links and only those API endpoints will return 200

- All changes build cleanly, run cleanly, and pass TypeScript checks (no new errors)
- Dev server running at http://localhost:3000 — ready for manual testing
