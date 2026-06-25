'use client'

// ============================================================
// Shared admin navigation items — client-safe
//
// Used by:
//   - AdminShell sidebar (admin dashboard)
//   - PickerLayout "Admin Tools" sheet
//   - DriverLayout "Admin Tools" sheet
//
// This file MUST NOT import from `@/lib/feature-permissions` (that
// module pulls in server-only Prisma/NextResponse code which would
// balloon the client bundle). Each layout already has its own
// ADMIN_FEATURE_KEYS set for the "has any admin feature?" check;
// this file just maps feature keys to nav items.
// ============================================================

import {
  LayoutDashboard,
  Package,
  FolderOpen,
  ShoppingBag,
  Users,
  Truck,
  UserCog,
  Image as ImageIcon,
  CalendarDays,
  PoundSterling,
  Trash2,
  Tag,
  MapPin,
  BarChart3,
  Settings,
  type LucideIcon,
} from 'lucide-react'

export interface AdminNavItem {
  /** Feature permission key. `null` = always visible (no feature check). */
  feature: string | null
  /** Route on the site. */
  href: string
  /** Display label. */
  label: string
  /** Lucide icon component. */
  icon: LucideIcon
}

/**
 * Full admin nav list — matches the AdminShell sidebar.
 * The first item (Dashboard) has feature=null so it's always visible
 * inside the admin shell. Picker/driver layouts should use
 * `ADMIN_TOOLS_ITEMS` (below) which excludes the dashboard root
 * because /admin is blocked for non-admin roles.
 */
export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { feature: null, href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { feature: 'orders', href: '/admin/orders', label: 'Orders', icon: ShoppingBag },
  { feature: 'products', href: '/admin/products', label: 'Products', icon: Package },
  { feature: 'categories', href: '/admin/categories', label: 'Categories', icon: FolderOpen },
  { feature: 'customers', href: '/admin/customers', label: 'Customers', icon: Users },
  { feature: 'drivers', href: '/admin/drivers', label: 'Drivers', icon: Truck },
  { feature: 'employees', href: '/admin/employees', label: 'Employees', icon: UserCog },
  { feature: 'banners', href: '/admin/banners', label: 'Banners', icon: ImageIcon },
  { feature: 'shifts', href: '/admin/shifts', label: 'Shifts', icon: CalendarDays },
  { feature: 'finance', href: '/admin/finance', label: 'Finance', icon: PoundSterling },
  { feature: 'wastage', href: '/admin/wastage', label: 'Wastage', icon: Trash2 },
  { feature: 'promotions', href: '/admin/promotions', label: 'Promotions', icon: Tag },
  { feature: 'delivery_zones', href: '/admin/delivery-zones', label: 'Delivery Zones', icon: MapPin },
  { feature: 'analytics', href: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
  { feature: 'settings', href: '/admin/settings', label: 'Settings', icon: Settings },
]

/**
 * Admin nav items excluding the dashboard root (`/admin`).
 *
 * Used by picker/driver layouts for their "Admin Tools" menu.
 * The /admin root is blocked for picker/driver by middleware
 * (they're redirected to their own dashboard), so we don't show
 * a link to it. They CAN access specific /admin/<feature> pages
 * when they have the corresponding feature permission.
 *
 * `kanban` is a sub-feature of orders (the kanban board lives at
 * /admin/orders), so it doesn't get its own nav item here. If a
 * picker has `kanban` but not `orders`, they won't see a link —
 * but they can still navigate to /admin/orders directly if they
 * know the URL. This is a rare edge case.
 */
export const ADMIN_TOOLS_ITEMS: AdminNavItem[] = ADMIN_NAV_ITEMS.filter(
  (item) => item.feature !== null,
)
