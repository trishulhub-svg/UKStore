import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/auth/prisma'
import { requireAdmin } from '@/lib/admin-auth'

const STORE_ID = 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890'

// GET /api/admin/finance/revenue
export async function GET(request: NextRequest) {
  const { error } = await requireAdmin()
  if (error) return error

  try {
    const prisma = await getPrisma()
    const now = new Date()

    // Today bounds
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)

    // Week start (Monday)
    const dayOfWeek = now.getDay() || 7 // Convert Sunday=0 to 7
    const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek + 1)
    const weekEnd = new Date(weekStart.getTime() + 7 * 86400000)

    // Month start
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1)

    const [
      todayOrders,
      weekOrders,
      monthOrders,
      allDeliveredOrders,
      todayExpenses,
      weekExpenses,
      monthExpenses,
    ] = await Promise.all([
      // Today's delivered orders revenue
      prisma.order.findMany({
        where: {
          storeId: STORE_ID,
          status: { in: ['delivered', 'out_for_delivery', 'ready', 'picking', 'placed'] },
          paymentStatus: 'paid',
          createdAt: { gte: todayStart, lt: todayEnd },
        },
        select: { total: true, deliveryFee: true, vatAmount: true, subtotal: true },
      }),
      // This week's orders
      prisma.order.findMany({
        where: {
          storeId: STORE_ID,
          status: { in: ['delivered', 'out_for_delivery', 'ready', 'picking', 'placed'] },
          paymentStatus: 'paid',
          createdAt: { gte: weekStart, lt: weekEnd },
        },
        select: { total: true, deliveryFee: true, vatAmount: true, subtotal: true },
      }),
      // This month's orders
      prisma.order.findMany({
        where: {
          storeId: STORE_ID,
          status: { in: ['delivered', 'out_for_delivery', 'ready', 'picking', 'placed'] },
          paymentStatus: 'paid',
          createdAt: { gte: monthStart, lt: monthEnd },
        },
        select: { total: true, deliveryFee: true, vatAmount: true, subtotal: true },
      }),
      // All delivered orders for AOV
      prisma.order.findMany({
        where: {
          storeId: STORE_ID,
          status: 'delivered',
          paymentStatus: 'paid',
        },
        select: { total: true },
      }),
      // Today expenses
      prisma.expense.findMany({
        where: { storeId: STORE_ID, date: { gte: todayStart, lt: todayEnd } },
        select: { amount: true },
      }),
      // Week expenses
      prisma.expense.findMany({
        where: { storeId: STORE_ID, date: { gte: weekStart, lt: weekEnd } },
        select: { amount: true },
      }),
      // Month expenses
      prisma.expense.findMany({
        where: { storeId: STORE_ID, date: { gte: monthStart, lt: monthEnd } },
        select: { amount: true },
      }),
    ])

    const sumOrders = (orders: { total: number }[]) => orders.reduce((acc, o) => acc + o.total, 0)
    const sumExpenses = (expenses: { amount: number }[]) => expenses.reduce((acc, e) => acc + e.amount, 0)

    const grossSalesToday = sumOrders(todayOrders)
    const grossSalesWeek = sumOrders(weekOrders)
    const grossSalesMonth = sumOrders(monthOrders)

    const completedOrders = allDeliveredOrders.length
    const aov = completedOrders > 0 ? sumOrders(allDeliveredOrders) / completedOrders : 0

    const expensesToday = sumExpenses(todayExpenses)
    const expensesWeek = sumExpenses(weekExpenses)
    const expensesMonth = sumExpenses(monthExpenses)

    // Stripe fees estimate (1.5% + 20p per transaction for UK)
    const stripeFeeRate = 0.015
    const stripeFixedFee = 0.20
    const stripeFeesToday = todayOrders.length * stripeFixedFee + grossSalesToday * stripeFeeRate
    const stripeFeesWeek = weekOrders.length * stripeFixedFee + grossSalesWeek * stripeFeeRate
    const stripeFeesMonth = monthOrders.length * stripeFixedFee + grossSalesMonth * stripeFeeRate

    const netProfitToday = grossSalesToday - expensesToday - stripeFeesToday
    const netProfitWeek = grossSalesWeek - expensesWeek - stripeFeesWeek
    const netProfitMonth = grossSalesMonth - expensesMonth - stripeFeesMonth

    return NextResponse.json({
      grossSales: { today: grossSalesToday, week: grossSalesWeek, month: grossSalesMonth },
      expenses: { today: expensesToday, week: expensesWeek, month: expensesMonth },
      stripeFees: { today: stripeFeesToday, week: stripeFeesWeek, month: stripeFeesMonth },
      netProfit: { today: netProfitToday, week: netProfitWeek, month: netProfitMonth },
      aov,
      completedOrders,
    })
  } catch (err) {
    console.error('[Finance Revenue GET]', err)
    return NextResponse.json({ error: 'Failed to fetch revenue data' }, { status: 500 })
  }
}
