# Task 4+5 - Admin Features Implementation

## Summary
Implemented 3 major admin features for the UKStore grocery delivery app:

### Feature 1: Live Kanban Order Board
- File: `/src/components/admin/kanban-order-board.tsx`
- 5 columns: New Orders → Packing → Ready → Out for Delivery → Delivered
- Cards with order ID, customer name, total, countdown timer (red after 15/30 min), payment status, Challenge 25 indicator
- Action buttons: Start Packing, Mark Ready, Assign Driver (with dropdown), Mark Delivered
- Auto-refresh every 30s, new order alert indicator
- Modified `/src/app/admin/orders/page.tsx` with Kanban/List toggle

### Feature 2: Finance & Business Ledger
- Files: `/src/app/admin/finance/page.tsx`, `/src/components/admin/finance-client.tsx`
- Revenue widgets (Today/Week/Month sales, AOV, completed orders)
- Manual expense tracker (add/delete with categories: electricity, rent, packaging, fuel, other)
- Net profit calculator (revenue - expenses - Stripe fees)
- HMRC UK VAT report (0%/5%/20% breakdown, CSV export)
- Bank transfer verification queue
- API routes: `/api/admin/finance/revenue`, `/api/admin/expenses`, `/api/admin/expenses/[id]`, `/api/admin/finance/vat-report`

### Feature 3: Store Open/Close Toggle + Delivery Fee Engine
- File: `/src/components/admin/store-status-manager.tsx`
- Giant ONLINE/OPEN vs OFFLINE/CLOSED toggle
- Opening hours scheduler (Mon-Sun with open/close times)
- Delivery fee engine (baseDeliveryFee, perKmCharge, freeDeliveryThreshold, deliveryRadiusKm)
- Test fee calculator
- Customer store closed overlay in `/src/components/customer/home-client.tsx`
- API routes: `/api/admin/store/status` (GET/PUT), `/api/store/status` (GET, public)

### Other Changes
- Added Finance link to admin sidebar (`admin-shell.tsx`)
- Updated Store type with `is_open` and `opening_hours` fields
- Updated Prisma mapper in `queries.ts`
- Enhanced admin orders API with paymentMethod and bankTransferVerified filters

### Verification
- TypeScript: 0 errors in all new/modified files
- Homepage: HTTP 200
- Public store status API: HTTP 200, returns correct JSON
- Admin pages: HTTP 307 (redirect to login, correct behavior)
- Admin API routes: HTTP 401 (auth required, correct behavior)
