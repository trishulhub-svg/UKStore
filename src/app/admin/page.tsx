import { getPrisma } from '@/lib/auth/prisma'
import { AdminDashboardClient } from '@/components/admin/admin-dashboard-client'

export const dynamic = 'force-dynamic'

const STORE_ID = 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890'

export default async function AdminDashboardPage() {
  const prisma = await getPrisma()

  let stats = {
    products: 0,
    orders: 0,
    customers: 0,
    configuredKeys: 0,
    totalKeys: 0,
  }
  let recentOrders: any[] = []

  try {
    const [
      productCount,
      orderCount,
      customerCount,
      recentOrdersData,
    ] = await Promise.all([
      prisma.product.count({ where: { storeId: STORE_ID } }),
      prisma.order.count({ where: { storeId: STORE_ID } }),
      prisma.user.count({ where: { role: 'CUSTOMER' } }),
      prisma.order.findMany({
        where: { storeId: STORE_ID },
        include: {
          customer: { select: { name: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
    ])

    const settingsCount = await prisma.storeSetting.count({ where: { storeId: STORE_ID } })
    const configuredCount = await prisma.storeSetting.count({
      where: { storeId: STORE_ID, value: { not: '' } },
    })

    stats = {
      products: productCount,
      orders: orderCount,
      customers: customerCount,
      configuredKeys: configuredCount,
      totalKeys: settingsCount,
    }

    recentOrders = recentOrdersData.map((o) => ({
      id: o.id,
      status: o.status,
      total: o.total,
      created_at: o.createdAt.toISOString(),
      customer: o.customer,
    }))
  } catch (err) {
    console.error('[Admin Dashboard] Error fetching stats:', err)
  }

  return (
    <AdminDashboardClient
      stats={stats}
      recentOrders={recentOrders}
    />
  )
}
