# Task: Migrate Auth to Supabase + Expand Schema

## Summary
Migrated the Prisma schema from a simple User/Post model to a comprehensive grocery store data model with 13 models. Updated the auth system to support Supabase Auth as primary with local auth fallback. Updated seed script with complete store data and 3 user accounts.

## Changes Made

### 1. Prisma Schema (`prisma/schema.prisma`)
- Replaced User/Post models with comprehensive schema containing 13 models:
  - User, Store, Category, Product, Address, Order, OrderItem
  - StoreSetting, Favourite, Notification, DriverProfile
  - DeliveryZone, Promotion
- Added enums: Role (CUSTOMER, DRIVER, OWNER, MANAGER), OrderStatus, PaymentStatus, VerificationStatus, SettingCategory, DiscountType
- Used `@@map` for table name mapping (users, stores, categories, etc.)
- SQLite compatible (will switch to PostgreSQL later)

### 2. Auth System Updates
- `src/lib/auth/prisma.ts` - Simplified to work with expanded schema, removed raw SQL auto-creation
- `src/lib/auth/index.ts` - Added Supabase Auth detection, `getAuthStrategy()`, `SUPABASE_AUTH_COOKIE_NAME`, `authProvider` field in session payload
- `src/lib/auth/server.ts` - Tries Supabase session first (JWT parsing), falls back to HMAC token
- `src/lib/auth/edge.ts` - Added `getUserFromCookies()` for middleware, tries Supabase JWT first, falls back to HMAC
- `src/lib/auth-client.ts` - Added `isSupabaseAuthAvailable()`, `getSupabaseAuthClient()` methods
- `src/middleware.ts` - Updated to use `getUserFromCookies()` for unified auth detection

### 3. Seed Script (`prisma/seed.ts`)
- Seeds 1 store (Fresh Mart London)
- 8 categories (Fruits & Vegetables, Dairy & Eggs, Meat & Fish, Bakery, Pantry, Drinks, Frozen, Snacks & Sweets)
- 20 products across all categories
- 7 store settings
- 3 user accounts:
  - Owner: admin@freshmart.co.uk / Admin@2026 (role: OWNER)
  - Driver: driver@freshmart.co.uk / Driver@2026 (role: DRIVER)
  - Customer: customer@freshmart.co.uk / Customer@2026 (role: CUSTOMER)
- 1 driver profile for the driver account

### 4. Types (`src/types/index.ts`)
- Kept snake_case field names for frontend compatibility
- Added new types: Address, Order, OrderItem, StoreSetting, Favourite, Notification, DriverProfile, DeliveryZone, Promotion
- Added enums: Role, LegacyRole, OrderStatus, PaymentStatus, VerificationStatus, SettingCategory, DiscountType
- Re-added missing types: VatRate, SubstitutePreference, DeliveryPricing
- Updated CartItem to include `product_id` field
- Updated Profile to have nullable `store_id`
- Updated role to support both uppercase (Prisma) and lowercase (legacy)

### 5. Frontend Compatibility Updates
- `src/stores/auth-store.ts` - Updated with `normalizeRole()` for case-insensitive role comparison, replaced 'picker'/'rider' with 'DRIVER'
- `src/components/customer/account-client.tsx` - Case-insensitive role check
- `src/app/admin/layout.tsx` - Case-insensitive role check, accepts both OWNER and MANAGER
- `src/components/admin/admin-shell.tsx` - Fixed User icon naming conflict
- `src/app/api/auth/register/route.ts` - Changed `role: 'customer'` to `role: 'CUSTOMER'` (Prisma enum)
- `src/store/cart.ts` - Added `product_id` to cart item creation
- `src/lib/vat/index.ts` - Added VatRate cast for product.vat_rate

## Key Design Decisions
- Prisma uses camelCase field names, but frontend types use snake_case for backward compatibility with existing components and Supabase queries
- Role enum values are uppercase in Prisma (OWNER, CUSTOMER, DRIVER), frontend uses case-insensitive comparison
- Auth system gracefully falls back: Supabase Auth (when configured) → Local HMAC auth
- Merged 'picker' and 'rider' roles into 'DRIVER' as specified
- DeliveryZone.postcodes and Promotion.appliesToCategoryIds stored as JSON strings (SQLite doesn't support arrays)

## Database State
- Database: SQLite at `db/custom.db`
- Schema pushed and client generated
- Data seeded successfully
