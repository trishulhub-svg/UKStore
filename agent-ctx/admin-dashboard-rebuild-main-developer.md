# Task: Rebuild Admin Dashboard Home Page

## Agent: Main Developer
## Task ID: admin-dashboard-rebuild

## Summary
Rebuilt the Admin Dashboard from a basic "settings status" view into a full business intelligence dashboard with real-time metrics, visual charts, and actionable insights.

## Changes Made

### 1. `/home/z/my-project/src/app/admin/page.tsx` (Server Component)
- **Removed**: Old settings-focused data fetching (product count, order count, customer count, API key configuration count, store_settings queries)
- **Added**: Comprehensive dashboard data fetching:
  - Today's revenue (sum of `orders.total` where `status != 'cancelled'` and `created_at >= today`)
  - Today's orders count with status breakdown
  - Active deliveries count (orders with status IN 'out_for_delivery', 'picking', 'ready')
  - Pending orders count (orders with status IN 'placed', 'confirmed')
  - Last 7 days revenue for bar chart (aggregated by date in server)
  - Order status breakdown for pie chart (all orders grouped by status)
  - Recent 5 orders with customer name join
  - Active drivers (driver_profiles WHERE is_on_duty = true JOIN profiles for name)
  - Low stock products (stock_quantity < 10, joined with categories for name)
- **Bug Fix**: Fixed `.eq('role', 'CUSTOMER')` → `.eq('role', 'customer')` (though customer count is no longer shown, the fix applies if the query is reused)
- All queries run in parallel via `Promise.all` for optimal performance
- Graceful error handling with console.error logging
- Zero-data states handled (defaults to zeros and empty arrays)

### 2. `/home/z/my-project/src/components/admin/admin-dashboard-client.tsx` (Client Component)
- **Removed**: Old 4-card stats view + API keys alert + simple recent orders table
- **Added**: Full 4-row business intelligence dashboard:

**Row 1 — Top Stats (4 cards)**:
1. Today's Revenue — `£XX.XX` with PoundSterling icon, green left border
2. Orders Today — count + breakdown (placed/picking/delivered), blue left border
3. Active Deliveries — count with truck icon, orange left border
4. Pending Orders — count with clock icon, amber warning when > 0, gray when 0

**Row 2 — Charts (2 cards)**:
1. Revenue Chart — BarChart (recharts) showing last 7 days daily revenue, custom tooltip, green bars
2. Order Status Breakdown — Donut/PieChart showing orders by status with color-coded segments and custom legend

**Row 3 — Recent Orders + Quick Actions (2/3 + 1/3 layout)**:
1. Recent Orders Table — Last 5 orders with Order ID, Customer name, Status badge (color-coded), Total, Time ago. Clickable rows to `/admin/orders`
2. Quick Actions — 4 action cards: "Add Product", "View All Orders", "Manage Drivers", "Create Promotion" with hover effects

**Row 4 — Active Drivers + Low Stock (2 cards)**:
1. Active Drivers — List of on-duty drivers with vehicle icon, name, vehicle type, "On Duty" badge
2. Low Stock Alert — Products where stock < 10, amber warning styling, shows product name, category, remaining stock, "Out of stock" label when 0

### Color Scheme
- Primary: `#16a34a` (brand green)
- Status colors: placed=blue, confirmed=indigo, picking=amber, ready=purple, out_for_delivery=orange, delivered=green, cancelled=red
- Uses `formatPrice` from `@/lib/vat` for all currency formatting

### Technical Details
- Uses `recharts` library for BarChart and PieChart
- Uses shadcn/ui Card, Badge, Button, Table components
- Responsive grid layout (1 col mobile → 2-4 cols desktop)
- Custom scrollable lists with max height (`max-h-64 overflow-y-auto`)
- All empty states handled gracefully with icons and "No data yet" messages
- `export const dynamic = 'force-dynamic'` on server page
