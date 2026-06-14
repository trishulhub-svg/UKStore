# Task 8+9+10+11 - Agent Work Log

## Agent: Main Agent
## Task: Implement Footer, Promo Codes, Banner Management, Customer Ban, Employee Tracker

### Feature 1: Full Footer Section
- Completely rewrote src/components/layout/footer.tsx as a 'use client' component
- **How It Works row**: 3 white boxes with step numbers, icons (ShoppingBag, ShoppingCart, Truck), and descriptions
- **Categories Sitemap row**: Fetches categories from /api/categories, splits into 5 columns, each linking to /catalog?category=[slug] for SEO
- **Corporate & App Links row** (4 columns):
  - Brand logo with social media icons (Instagram, X/Twitter, Facebook, LinkedIn)
  - Company links (Home, Delivery Areas, Careers, Support, Blog)
  - Legal links (Privacy Policy, Terms, Sell on Fresh Mart, Franchise)
  - Download App buttons (Google Play & App Store placeholders)
- **Bottom bar**: VAT compliance and "Made in London" text
- Dark theme (bg-[#1a1a2e]) for visual distinction
- Created /api/categories/route.ts for public category listing (used by footer)

### Feature 2: Promo Code/Coupon System
- **Schema updates**:
  - Added minimumOrderValue, usageLimit, usedCount to Promotion model
  - Added promotionId and discountAmount to Order model
  - Updated prisma.ts SQL schema to match
  - Updated /api/admin/promotions POST/PATCH to handle new fields
- **API: /api/promotions/validate/route.ts** (POST):
  - Validates promo code against database (case-insensitive)
  - Checks: isActive, date range, minimum order value, usage limits, category restrictions
  - Calculates discount (percentage or fixed_amount), capped at subtotal
  - Returns discount amount, promotion details, and message
  - Also checks if customer is banned (isActive = false)
- **Checkout UI** (checkout-client.tsx):
  - Added promo code section in order summary step
  - Input + Apply button, Enter key support
  - Green success toast "Promo code applied! You save £X.XX"
  - Red error toast for invalid codes
  - Applied promo shows as green badge with remove (X) button
  - Discount reflected in bill summary with green Tag icon
  - Promo code, promotion_id, discount_amount sent to checkout API
- **Checkout API** (checkout/route.ts):
  - Accepts promo_code, promotion_id, discount_amount fields
  - Validates promo in each payment method branch (cash, bank_transfer, stripe, demo)
  - Increments promotion usedCount on successful order
  - Stores promotionId and discountAmount on the order

### Feature 3: Admin Banner Management
- **API: /api/admin/banners/route.ts** (GET list, POST create)
- **API: /api/admin/banners/[id]/route.ts** (PATCH update, DELETE)
- **Page: /admin/banners/page.tsx** ('use client'):
  - Shows 4 banner slots matching carousel positions
  - Each slot: image upload (base64 data URLs), title input, link category dropdown, custom link URL, sort order, active toggle
  - Image preview with hover-to-replace overlay
  - File input with 5MB size validation
  - Save/Delete buttons with toast feedback
  - Fetches categories for the link dropdown
  - Responsive: desktop table-style cards, mobile stacked
- **Admin sidebar**: Added "Banners" link with Image icon

### Feature 4: Customer Ban + Employee Tracker + Order Counter

**A. Customer Ban Button:**
- Updated /api/admin/customers/[id]/route.ts: Added PATCH handler for isActive toggle
- Rewrote /admin/customers/page.tsx:
  - Added "Ban" / "Unban" button in each customer row (desktop + mobile)
  - Red "Banned" badge (Badge variant="destructive") next to banned customers
  - Green Unban button, Red-styled Ban button
  - Toast feedback on success
  - Also shows ban status in the customer detail sheet

**B. Employee Salary & Wage Tracker:**
- **API: /api/admin/employees/route.ts** (GET):
  - Lists all non-CUSTOMER users (DRIVER, PICKER, OWNER, MANAGER)
  - Includes employeeProfile, driverProfile relations
  - Calculates today's order count per employee
- **API: /api/admin/employees/[id]/route.ts** (PATCH):
  - Updates salary, wageRate, wageType, bankName, bankAccountNo, bankSortCode
  - Creates EmployeeProfile if not exists
- **Page: /admin/employees/page.tsx** ('use client'):
  - Desktop table + mobile cards
  - Shows: Name, Email, Phone, Role (color-coded badge), Salary/Wage, Today's Orders
  - Edit button opens dialog with salary/wage fields
  - Wage type selector (hourly/daily/monthly) with conditional fields
  - Bank details section (bank name, account number, sort code)

**C. Employee Order Counter:**
- For drivers: counts delivered orders today (deliveredAt >= todayStart)
- For pickers: counts packed orders today (packedAt >= todayStart)
- Displayed with icon (Truck for drivers, Package for pickers)

### Admin Sidebar Updates
- Added "Employees" link with UserCog icon
- Added "Banners" link with Image icon
- Reordered: Customers → Drivers → Employees → Banners

### Build Verification
- `bun run lint`: 0 errors in src/ (only pre-existing errors in non-project files)
- `npx next build`: successful, no TypeScript errors, 3 warnings (pre-existing Stripe)
