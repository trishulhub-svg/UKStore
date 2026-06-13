# Work Log

---
Task ID: 1
Agent: Main Agent
Task: Fix "Failed to fetch" error on register/login by implementing local auth

Work Log:
- Diagnosed root cause: Supabase project deleted, environment variables missing
- Updated Prisma schema: added passwordHash and role fields to User model
- Ran prisma db push to sync schema with SQLite database
- Installed bcryptjs for password hashing
- Created local auth utilities (lib/auth/index.ts): password hashing, HMAC-signed session tokens
- Created Edge-compatible auth utilities (lib/auth/edge.ts) for middleware using Web Crypto API
- Created Prisma helper (lib/auth/prisma.ts) for auth database operations
- Created server-side auth helper (lib/auth/server.ts) for server components
- Created client-side auth helper (lib/auth-client.ts) with authRegister, authLogin, authLogout, authGetSession
- Created API routes: /api/auth/register, /api/auth/login, /api/auth/logout, /api/auth/session
- Updated all auth components to use local API routes instead of Supabase:
  - login-client.tsx
  - register-client.tsx
  - forgot-password-client.tsx
  - auth-modal.tsx
  - home-auth-form.tsx
  - customer-layout.tsx
  - home-client.tsx
  - account-client.tsx
  - admin-shell.tsx
- Updated middleware.ts to use Edge-compatible session verification instead of Supabase
- Updated server-side pages to use getServerUser() instead of Supabase auth:
  - account/page.tsx
  - admin/layout.tsx
  - admin/page.tsx
  - admin/settings/page.tsx
  - checkout/page.tsx
  - api/checkout/route.ts
  - api/admin/settings/route.ts
  - auth/callback/route.ts
  - order/[id]/page.tsx
- Updated Supabase client for graceful fallback when env vars are missing
- Build succeeds with no errors
- Tested all auth endpoints: Register (201), Login (200), Session (200), Logout (200)

Stage Summary:
- Local authentication system fully implemented using Prisma/SQLite
- Registration and login work without any external Supabase dependency
- Session tokens are HMAC-signed with 7-day expiry
- All auth components and server pages updated to use local auth
- Middleware updated to use Edge-compatible Web Crypto API for token verification

---
Task ID: 2
Agent: Main Agent
Task: Replace generic error messages with specific technical errors that are easy to copy

Work Log:
- Created reusable ErrorAlert component (src/components/ui/error-alert.tsx) with:
  - TechnicalError interface (message, code, status, details, timestamp, endpoint)
  - Copy button for error details
  - Expandable "Show technical details" section
  - Error code and HTTP status badges
  - Compact mode for smaller forms
- Updated auth-client.ts to return TechnicalError objects instead of plain strings:
  - Network errors identified with NETWORK_ERROR code and helpful explanation
  - API errors parsed via parseApiError helper that reads technicalError from response
- Updated API routes to return structured technical errors:
  - /api/auth/login: AUTH_INVALID_CREDENTIALS, MISSING_FIELDS, INVALID_BODY, INTERNAL_ERROR
  - /api/auth/register: PASSWORD_TOO_SHORT, AUTH_EMAIL_EXISTS, INVALID_EMAIL, MISSING_FIELDS, DATABASE_ERROR
  - /api/checkout: AUTH_REQUIRED, EMPTY_CART, MISSING_ADDRESS, PRODUCT_UNAVAILABLE, INSUFFICIENT_STOCK
  - /api/admin/settings: AUTH_REQUIRED, FORBIDDEN_ROLE, MISSING_SETTINGS, INVALID_SETTING_KEY
- Updated all frontend components to use ErrorAlert:
  - login-client.tsx
  - register-client.tsx
  - home-auth-form.tsx (compact mode)
  - auth-modal.tsx
  - forgot-password-client.tsx
  - checkout-client.tsx
  - admin-settings-client.tsx
- Build succeeds with no errors
- Tested API endpoints: all return structured technicalError in responses

Stage Summary:
- All generic "An unexpected error occurred" messages replaced with specific technical errors
- Every error now includes: machine-readable code, HTTP status, details, timestamp, endpoint
- ErrorAlert component with copy button makes errors easy to share/debug
- API responses include both user-friendly "error" field and "technicalError" object

---
Task ID: fix-database-schema-error
Agent: main
Task: Fix DATABASE_SCHEMA_ERROR on login and register in production

Work Log:
- Identified the root cause: production server runs from /var/task/ (serverless), but DATABASE_URL pointed to file:/home/z/my-project/db/custom.db which doesn't exist in that environment
- Rewrote src/lib/auth/prisma.ts with runtime DB path resolution and auto-creation of database + schema
- Changed .env DATABASE_URL from absolute path to relative (file:./db/custom.db)
- Updated login and register routes to use async getPrisma() instead of direct prisma import
- Added postinstall and build hooks for prisma generate
- Tested auto-creation: when DB file doesn't exist, it creates the file and runs CREATE TABLE statements
- Pushed fix to production

Stage Summary:
- Auto-creation of database + schema verified working locally
- All auth endpoints (register, login, session) tested and working
- Error handling improved for SQLite-specific errors
- Fix deployed to production via git push
