import { getPrisma } from '@/lib/auth/prisma'
import { FinanceDashboardClient } from '@/components/admin/finance-dashboard-client'

export const dynamic = 'force-dynamic'

const STORE_ID = 'store-fresh-mart-001'

// Thin server-component shell.
//
// All financial data is fetched client-side by <FinanceDashboardClient/>
// (which calls /api/admin/finance/report and /api/admin/finance/vat-report)
// so the page can support interactive period selection and live re-fetches
// without a full server round-trip.
//
// The only thing we still need from the server is the store name (used as
// the brand title on the generated PDF / email).
export default async function AdminFinancePage() {
  let storeName = 'Fresh Mart'

  try {
    const prisma = await getPrisma()
    const store = await prisma.store.findUnique({ where: { id: STORE_ID } })
    if (store?.name) storeName = store.name
  } catch (err) {
    console.error('[Admin Finance] Error loading store name:', err)
  }

  return <FinanceDashboardClient storeName={storeName} />
}
