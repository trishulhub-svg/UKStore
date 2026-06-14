import { getPrisma } from '@/lib/auth/prisma'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PoundSterling, TrendingUp, TrendingDown, Receipt, ShoppingBag } from 'lucide-react'

export const dynamic = 'force-dynamic'

const STORE_ID = 'store-fresh-mart-001'

export default async function AdminFinancePage() {
  const prisma = await getPrisma()

  let totalRevenue = 0
  let totalExpenses = 0
  let orderCount = 0
  let recentExpenses: any[] = []

  try {
    // Calculate revenue from paid orders
    const revenueResult = await prisma.order.aggregate({
      where: {
        storeId: STORE_ID,
        paymentStatus: 'paid',
      },
      _sum: { total: true },
      _count: true,
    })

    totalRevenue = revenueResult._sum.total || 0
    orderCount = revenueResult._count

    // Calculate expenses
    const expenseResult = await prisma.expense.aggregate({
      where: { storeId: STORE_ID },
      _sum: { amount: true },
    })

    totalExpenses = expenseResult._sum.amount || 0

    // Recent expenses
    recentExpenses = await prisma.expense.findMany({
      where: { storeId: STORE_ID },
      orderBy: { date: 'desc' },
      take: 10,
    })
  } catch (err) {
    console.error('[Admin Finance] Error:', err)
  }

  const profit = totalRevenue - totalExpenses

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Finance</h1>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                <PoundSterling className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Total Revenue</p>
                <p className="text-xl font-bold text-gray-900">£{totalRevenue.toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <TrendingDown className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Total Expenses</p>
                <p className="text-xl font-bold text-gray-900">£{totalExpenses.toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full ${profit >= 0 ? 'bg-green-100' : 'bg-red-100'} flex items-center justify-center`}>
                <TrendingUp className={`h-5 w-5 ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`} />
              </div>
              <div>
                <p className="text-xs text-gray-500">Net Profit</p>
                <p className={`text-xl font-bold ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  £{profit.toFixed(2)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                <ShoppingBag className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Paid Orders</p>
                <p className="text-xl font-bold text-gray-900">{orderCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Expenses */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <Receipt className="h-5 w-5 text-gray-600" />
            Recent Expenses
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentExpenses.length === 0 ? (
            <div className="text-center py-8">
              <Receipt className="h-10 w-10 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No expenses recorded yet</p>
              <p className="text-xs text-gray-400">Add expenses from the admin dashboard</p>
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-3 font-medium text-gray-500">Description</th>
                      <th className="text-left py-3 px-3 font-medium text-gray-500">Category</th>
                      <th className="text-left py-3 px-3 font-medium text-gray-500">Amount</th>
                      <th className="text-left py-3 px-3 font-medium text-gray-500">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentExpenses.map((expense) => (
                      <tr key={expense.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-3 font-medium text-gray-900">{expense.description}</td>
                        <td className="py-3 px-3">
                          <Badge variant="outline" className="text-xs capitalize">
                            {expense.category}
                          </Badge>
                        </td>
                        <td className="py-3 px-3 font-medium text-red-600">-£{expense.amount.toFixed(2)}</td>
                        <td className="py-3 px-3 text-gray-500">
                          {new Date(expense.date).toLocaleDateString('en-GB', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden space-y-3">
                {recentExpenses.map((expense) => (
                  <div key={expense.id} className="border border-gray-200 rounded-lg p-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm text-gray-900">{expense.description}</span>
                      <span className="font-medium text-red-600">-£{expense.amount.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <Badge variant="outline" className="text-[10px] capitalize">{expense.category}</Badge>
                      <span>{new Date(expense.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
