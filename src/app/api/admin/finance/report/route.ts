import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/auth/prisma'
import { requireAdmin } from '@/lib/admin-auth'

const STORE_ID = 'store-fresh-mart-001'

/**
 * GET /api/admin/finance/report
 *
 * Returns aggregated finance data for a given period, used to render the
 * visualized PDF on the client. Includes:
 *   - Revenue, expenses, profit summary
 *   - Daily revenue + expenses for the chart
 *   - Expenses broken down by category
 *   - Top 10 orders by value
 *   - Top 10 expense line items
 *
 * Query params:
 *   - startDate (YYYY-MM-DD, default: 30 days ago)
 *   - endDate   (YYYY-MM-DD, default: today)
 */
export async function GET(request: NextRequest) {
  const { error } = await requireAdmin()
  if (error) return error

  try {
    const prisma = await getPrisma()
    const { searchParams } = new URL(request.url)

    const endDate = searchParams.get('endDate')
      ? new Date(searchParams.get('endDate')! + 'T23:59:59')
      : new Date()
    const startDate = searchParams.get('startDate')
      ? new Date(searchParams.get('startDate')! + 'T00:00:00')
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

    // ─── Fetch orders in period ──────────────────────────────────────
    const orders = await prisma.order.findMany({
      where: {
        storeId: STORE_ID,
        createdAt: { gte: startDate, lte: endDate },
        status: { not: 'cancelled' },
      },
      select: {
        id: true,
        total: true,
        subtotal: true,
        vatAmount: true,
        deliveryFee: true,
        paymentMethod: true,
        paymentStatus: true,
        createdAt: true,
      },
      orderBy: { total: 'desc' },
    })

    const expenses = await prisma.expense.findMany({
      where: {
        storeId: STORE_ID,
        date: { gte: startDate, lte: endDate },
      },
      orderBy: { date: 'desc' },
    })

    // ─── Aggregate ───────────────────────────────────────────────────
    const totalRevenue = orders.reduce((s, o) => s + o.total, 0)
    const totalVat = orders.reduce((s, o) => s + o.vatAmount, 0)
    const totalDeliveryFees = orders.reduce((s, o) => s + o.deliveryFee, 0)
    const totalSubtotal = orders.reduce((s, o) => s + o.subtotal, 0)
    const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0)
    const profit = totalRevenue - totalExpenses
    const paidOrdersCount = orders.filter((o) => o.paymentStatus === 'paid').length

    // Daily revenue + expenses for the chart
    const dailyMap: Record<string, { revenue: number; expenses: number }> = {}
    const dayMs = 24 * 60 * 60 * 1000
    for (let t = startDate.getTime(); t <= endDate.getTime(); t += dayMs) {
      const key = new Date(t).toISOString().split('T')[0]
      dailyMap[key] = { revenue: 0, expenses: 0 }
    }
    orders.forEach((o) => {
      const key = o.createdAt.toISOString().split('T')[0]
      if (key in dailyMap) dailyMap[key].revenue += o.total
    })
    expenses.forEach((e) => {
      const key = e.date.toISOString().split('T')[0]
      if (key in dailyMap) dailyMap[key].expenses += e.amount
    })

    const dailyChart = Object.entries(dailyMap).map(([date, vals]) => ({
      date,
      revenue: Math.round(vals.revenue * 100) / 100,
      expenses: Math.round(vals.expenses * 100) / 100,
    }))

    // Expense breakdown by category
    const expenseByCategory: Record<string, number> = {}
    expenses.forEach((e) => {
      expenseByCategory[e.category] = (expenseByCategory[e.category] || 0) + e.amount
    })
    const expenseBreakdown = Object.entries(expenseByCategory).map(([category, amount]) => ({
      category,
      amount: Math.round(amount * 100) / 100,
      percentage: totalExpenses > 0 ? Math.round((amount / totalExpenses) * 1000) / 10 : 0,
    }))

    // Payment method breakdown
    const paymentByMethod: Record<string, { count: number; total: number }> = {}
    orders.forEach((o) => {
      const method = o.paymentMethod || 'unspecified'
      if (!paymentByMethod[method]) paymentByMethod[method] = { count: 0, total: 0 }
      paymentByMethod[method].count++
      paymentByMethod[method].total += o.total
    })

    return NextResponse.json({
      period: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      },
      summary: {
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        totalExpenses: Math.round(totalExpenses * 100) / 100,
        profit: Math.round(profit * 100) / 100,
        profitMargin: totalRevenue > 0 ? Math.round((profit / totalRevenue) * 1000) / 10 : 0,
        totalVat: Math.round(totalVat * 100) / 100,
        totalDeliveryFees: Math.round(totalDeliveryFees * 100) / 100,
        totalSubtotal: Math.round(totalSubtotal * 100) / 100,
        orderCount: orders.length,
        paidOrdersCount,
        expenseCount: expenses.length,
      },
      dailyChart,
      expenseBreakdown,
      paymentByMethod: Object.entries(paymentByMethod).map(([method, data]) => ({
        method,
        count: data.count,
        total: Math.round(data.total * 100) / 100,
      })),
      topOrders: orders.slice(0, 10).map((o) => ({
        id: o.id,
        total: o.total,
        paymentMethod: o.paymentMethod,
        paymentStatus: o.paymentStatus,
        date: o.createdAt.toISOString(),
      })),
      topExpenses: expenses.slice(0, 10).map((e) => ({
        id: e.id,
        description: e.description,
        category: e.category,
        amount: e.amount,
        date: e.date.toISOString(),
      })),
    })
  } catch (err) {
    console.error('[Finance Report GET]', err)
    return NextResponse.json({ error: 'Failed to fetch finance report' }, { status: 500 })
  }
}
