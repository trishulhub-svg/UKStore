'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  TrendingUp, TrendingDown, DollarSign, ShoppingCart, Receipt, Calculator,
  Download, Trash2, Plus, Loader2, PoundSterling, AlertTriangle, CheckCircle2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { formatPrice } from '@/lib/vat'

// ─── Types ────────────────────────────────────────────────────

interface RevenueData {
  grossSales: { today: number; week: number; month: number }
  expenses: { today: number; week: number; month: number }
  stripeFees: { today: number; week: number; month: number }
  netProfit: { today: number; week: number; month: number }
  aov: number
  completedOrders: number
}

interface ExpenseRecord {
  id: string
  category: string
  description: string
  amount: number
  date: string
  createdAt: string
}

interface VatBreakdown {
  [rate: number]: {
    netSales: number
    vatAmount: number
    grossSales: number
    itemCount: number
  }
}

interface VatReport {
  period: string
  startDate: string
  vatBreakdown: VatBreakdown
  totals: {
    netSales: number
    vatAmount: number
    grossSales: number
  }
}

interface BankTransferOrder {
  id: string
  total: number
  customer: { name: string; email: string }
  bankTransferRef: string | null
  bankTransferVerified: boolean
  createdAt: string
}

const EXPENSE_CATEGORIES = [
  { value: 'electricity', label: 'Electricity' },
  { value: 'rent', label: 'Rent' },
  { value: 'packaging', label: 'Packaging' },
  { value: 'fuel', label: 'Fuel' },
  { value: 'other', label: 'Other' },
]

const VAT_LABELS: Record<number, string> = {
  0: '0% (Zero-rated)',
  0.05: '5% (Reduced)',
  0.2: '20% (Standard)',
}

// ─── Finance Client Component ─────────────────────────────────

export function FinanceClient() {
  const [revenue, setRevenue] = useState<RevenueData | null>(null)
  const [revenueLoading, setRevenueLoading] = useState(true)

  const [expenses, setExpenses] = useState<ExpenseRecord[]>([])
  const [expensesLoading, setExpensesLoading] = useState(true)

  const [vatReport, setVatReport] = useState<VatReport | null>(null)
  const [vatLoading, setVatLoading] = useState(true)
  const [vatPeriod, setVatPeriod] = useState('month')

  const [bankTransfers, setBankTransfers] = useState<BankTransferOrder[]>([])
  const [bankLoading, setBankLoading] = useState(true)

  // Expense form state
  const [expCategory, setExpCategory] = useState('')
  const [expDescription, setExpDescription] = useState('')
  const [expAmount, setExpAmount] = useState('')
  const [expDate, setExpDate] = useState(new Date().toISOString().split('T')[0])
  const [expSubmitting, setExpSubmitting] = useState(false)

  const fetchRevenue = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/finance/revenue')
      if (!res.ok) throw new Error()
      const data = await res.json()
      setRevenue(data)
    } catch {
      toast.error('Failed to load revenue data')
    } finally {
      setRevenueLoading(false)
    }
  }, [])

  const fetchExpenses = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/expenses?limit=50')
      if (!res.ok) throw new Error()
      const data = await res.json()
      setExpenses(data.expenses || [])
    } catch {
      toast.error('Failed to load expenses')
    } finally {
      setExpensesLoading(false)
    }
  }, [])

  const fetchVatReport = useCallback(async () => {
    setVatLoading(true)
    try {
      const res = await fetch(`/api/admin/finance/vat-report?period=${vatPeriod}`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      setVatReport(data)
    } catch {
      toast.error('Failed to load VAT report')
    } finally {
      setVatLoading(false)
    }
  }, [vatPeriod])

  const fetchBankTransfers = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/orders?paymentMethod=bank_transfer&bankTransferVerified=false&limit=100')
      if (!res.ok) throw new Error()
      const data = await res.json()
      setBankTransfers(data.orders || [])
    } catch {
      toast.error('Failed to load bank transfers')
    } finally {
      setBankLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchRevenue()
    fetchExpenses()
    fetchBankTransfers()
  }, [fetchRevenue, fetchExpenses, fetchBankTransfers])

  useEffect(() => {
    fetchVatReport()
  }, [fetchVatReport])

  const handleAddExpense = async () => {
    if (!expCategory || !expDescription || !expAmount || !expDate) {
      toast.error('Please fill in all fields')
      return
    }
    setExpSubmitting(true)
    try {
      const res = await fetch('/api/admin/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: expCategory,
          description: expDescription,
          amount: parseFloat(expAmount),
          date: expDate,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed')
      }
      toast.success('Expense added')
      setExpCategory('')
      setExpDescription('')
      setExpAmount('')
      setExpDate(new Date().toISOString().split('T')[0])
      fetchExpenses()
      fetchRevenue()
    } catch (err: any) {
      toast.error(err.message || 'Failed to add expense')
    } finally {
      setExpSubmitting(false)
    }
  }

  const handleDeleteExpense = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/expenses/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      toast.success('Expense deleted')
      fetchExpenses()
      fetchRevenue()
    } catch {
      toast.error('Failed to delete expense')
    }
  }

  const handleVerifyBankTransfer = async (orderId: string) => {
    try {
      const res = await fetch('/api/admin/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, bankTransferVerified: true }),
      })
      if (!res.ok) throw new Error()
      toast.success('Bank transfer verified')
      fetchBankTransfers()
      fetchRevenue()
    } catch {
      toast.error('Failed to verify transfer')
    }
  }

  const handleExportVatCsv = () => {
    if (!vatReport) return

    const rows: string[][] = []
    rows.push(['VAT Rate', 'Net Sales', 'VAT Amount', 'Gross Sales', 'Item Count'])

    for (const [rate, data] of Object.entries(vatReport.vatBreakdown)) {
      rows.push([
        VAT_LABELS[parseFloat(rate)] || `${rate}%`,
        data.netSales.toFixed(2),
        data.vatAmount.toFixed(2),
        data.grossSales.toFixed(2),
        String(data.itemCount),
      ])
    }

    rows.push([])
    rows.push(['TOTALS', vatReport.totals.netSales.toFixed(2), vatReport.totals.vatAmount.toFixed(2), vatReport.totals.grossSales.toFixed(2), ''])

    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `vat-report-${vatReport.period}-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      {/* Page Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <PoundSterling className="h-6 w-6 text-[#16a34a]" />
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Finance & Ledger</h1>
        </div>
        <p className="text-gray-500">Revenue tracking, expense management, VAT reporting & bank transfer verification</p>
      </div>

      {/* ─── Revenue Widgets ──────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        {revenueLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <Card key={i}><CardContent className="p-5"><Skeleton className="h-20 w-full" /></CardContent></Card>
          ))
        ) : revenue ? (
          <>
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Sales Today</p>
                    <p className="text-xl font-bold text-gray-900 mt-1">{formatPrice(revenue.grossSales.today)}</p>
                  </div>
                  <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center">
                    <DollarSign className="h-5 w-5 text-green-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Sales This Week</p>
                    <p className="text-xl font-bold text-gray-900 mt-1">{formatPrice(revenue.grossSales.week)}</p>
                  </div>
                  <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center">
                    <TrendingUp className="h-5 w-5 text-green-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Sales This Month</p>
                    <p className="text-xl font-bold text-gray-900 mt-1">{formatPrice(revenue.grossSales.month)}</p>
                  </div>
                  <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center">
                    <TrendingUp className="h-5 w-5 text-green-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Avg Order Value</p>
                    <p className="text-xl font-bold text-gray-900 mt-1">{formatPrice(revenue.aov)}</p>
                  </div>
                  <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
                    <ShoppingCart className="h-5 w-5 text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Completed Orders</p>
                    <p className="text-xl font-bold text-gray-900 mt-1">{revenue.completedOrders}</p>
                  </div>
                  <div className="w-10 h-10 rounded-full bg-purple-50 flex items-center justify-center">
                    <CheckCircle2 className="h-5 w-5 text-purple-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>

      {/* ─── Net Profit Calculator ────────────────────────────── */}
      {revenue && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Calculator className="h-5 w-5 text-gray-600" />
              Net Profit Calculator
            </CardTitle>
            <CardDescription>Revenue minus expenses minus Stripe fees</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {(['today', 'week', 'month'] as const).map((period) => {
                const label = period === 'today' ? 'Today' : period === 'week' ? 'This Week' : 'This Month'
                const profit = revenue.netProfit[period]
                const sales = revenue.grossSales[period]
                const exp = revenue.expenses[period]
                const stripe = revenue.stripeFees[period]
                const isPositive = profit >= 0

                return (
                  <div key={period} className="border rounded-lg p-4 space-y-3">
                    <h4 className="font-medium text-gray-700">{label}</h4>
                    <div className="space-y-1.5 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Gross Sales</span>
                        <span className="font-medium">{formatPrice(sales)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Expenses</span>
                        <span className="text-red-600">-{formatPrice(exp)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Stripe Fees (est.)</span>
                        <span className="text-red-600">-{formatPrice(stripe)}</span>
                      </div>
                      <Separator />
                      <div className="flex justify-between font-bold">
                        <span>Net Profit</span>
                        <span className={isPositive ? 'text-green-600' : 'text-red-600'}>
                          {isPositive ? '+' : ''}{formatPrice(profit)}
                        </span>
                      </div>
                    </div>
                    <div className={`flex items-center gap-1.5 text-xs font-medium ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                      {isPositive ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                      {isPositive ? 'Profitable' : 'Loss'}
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* ─── Manual Expense Tracker ─────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Receipt className="h-5 w-5 text-gray-600" />
              Expense Tracker
            </CardTitle>
            <CardDescription>Add and manage business expenses</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Add Expense Form */}
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <h4 className="font-medium text-sm text-gray-700">Add New Expense</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Category</Label>
                  <Select value={expCategory} onValueChange={setExpCategory}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {EXPENSE_CATEGORIES.map((c) => (
                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Amount</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={expAmount}
                    onChange={(e) => setExpAmount(e.target.value)}
                    className="h-9 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Description</Label>
                  <Input
                    placeholder="What was this for..."
                    value={expDescription}
                    onChange={(e) => setExpDescription(e.target.value)}
                    className="h-9 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Date</Label>
                  <Input
                    type="date"
                    value={expDate}
                    onChange={(e) => setExpDate(e.target.value)}
                    className="h-9 text-sm"
                  />
                </div>
              </div>
              <Button
                onClick={handleAddExpense}
                disabled={expSubmitting}
                className="w-full h-9 bg-[#16a34a] hover:bg-[#15803d] text-white text-sm"
              >
                {expSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Plus className="h-3.5 w-3.5 mr-1" />}
                Add Expense
              </Button>
            </div>

            {/* Expense List */}
            <div className="space-y-2 max-h-96 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
              {expensesLoading ? (
                Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)
              ) : expenses.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-6">No expenses recorded yet</p>
              ) : (
                expenses.map((exp) => (
                  <div key={exp.id} className="flex items-center justify-between border rounded-lg p-3 hover:bg-gray-50">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px] shrink-0">
                          {exp.category}
                        </Badge>
                        <span className="text-sm font-medium truncate">{exp.description}</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {new Date(exp.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 ml-2">
                      <span className="font-medium text-sm text-red-600">{formatPrice(exp.amount)}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-gray-400 hover:text-red-600 shrink-0"
                        onClick={() => handleDeleteExpense(exp.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* ─── HMRC UK VAT Report ─────────────────────────────── */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Calculator className="h-5 w-5 text-gray-600" />
                  HMRC UK VAT Report
                </CardTitle>
                <CardDescription>VAT breakdown by rate</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Select value={vatPeriod} onValueChange={setVatPeriod}>
                  <SelectTrigger className="w-28 h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="today">Today</SelectItem>
                    <SelectItem value="week">This Week</SelectItem>
                    <SelectItem value="month">This Month</SelectItem>
                    <SelectItem value="quarter">This Quarter</SelectItem>
                    <SelectItem value="year">This Year</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" size="sm" className="h-8 text-xs" onClick={handleExportVatCsv} disabled={!vatReport}>
                  <Download className="h-3.5 w-3.5 mr-1" />
                  CSV
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {vatLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : vatReport && Object.keys(vatReport.vatBreakdown).length > 0 ? (
              <div className="space-y-3">
                {/* Table Header */}
                <div className="grid grid-cols-5 gap-2 text-xs font-medium text-gray-500 pb-2 border-b">
                  <span>VAT Rate</span>
                  <span className="text-right">Net Sales</span>
                  <span className="text-right">VAT Amount</span>
                  <span className="text-right">Gross Sales</span>
                  <span className="text-right">Items</span>
                </div>
                {/* Rows */}
                {Object.entries(vatReport.vatBreakdown).map(([rate, data]) => (
                  <div key={rate} className="grid grid-cols-5 gap-2 text-sm py-2 border-b border-gray-100">
                    <span className="font-medium">{VAT_LABELS[parseFloat(rate)] || `${rate}%`}</span>
                    <span className="text-right">{formatPrice(data.netSales)}</span>
                    <span className="text-right font-medium text-amber-700">{formatPrice(data.vatAmount)}</span>
                    <span className="text-right">{formatPrice(data.grossSales)}</span>
                    <span className="text-right text-gray-500">{data.itemCount}</span>
                  </div>
                ))}
                {/* Totals */}
                <div className="grid grid-cols-5 gap-2 text-sm font-bold pt-2 bg-gray-50 rounded px-2 py-3">
                  <span>TOTAL</span>
                  <span className="text-right">{formatPrice(vatReport.totals.netSales)}</span>
                  <span className="text-right text-amber-700">{formatPrice(vatReport.totals.vatAmount)}</span>
                  <span className="text-right">{formatPrice(vatReport.totals.grossSales)}</span>
                  <span />
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Receipt className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                <p className="text-sm">No VAT data for this period</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ─── Bank Transfer Verification Queue ─────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            Bank Transfer Verification Queue
          </CardTitle>
          <CardDescription>Orders paid by bank transfer awaiting verification</CardDescription>
        </CardHeader>
        <CardContent>
          {bankLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : bankTransfers.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-400" />
              <p className="text-sm">No pending bank transfers to verify</p>
            </div>
          ) : (
            <div className="space-y-2">
              {/* Desktop Header */}
              <div className="hidden sm:grid grid-cols-5 gap-2 text-xs font-medium text-gray-500 pb-2 border-b">
                <span>Order ID</span>
                <span>Customer</span>
                <span>Amount</span>
                <span>Reference</span>
                <span className="text-right">Action</span>
              </div>
              {bankTransfers.map((order) => (
                <div key={order.id} className="grid grid-cols-1 sm:grid-cols-5 gap-2 sm:gap-2 items-center border rounded-lg p-3 hover:bg-gray-50">
                  <span className="font-mono text-xs">#{order.id.substring(0, 8).toUpperCase()}</span>
                  <span className="text-sm">{order.customer?.name || 'N/A'}</span>
                  <span className="font-medium text-sm">{formatPrice(order.total)}</span>
                  <span className="text-xs text-gray-500">{order.bankTransferRef || 'No ref'}</span>
                  <div className="sm:text-right">
                    <Button
                      size="sm"
                      className="h-8 text-xs bg-[#16a34a] hover:bg-[#15803d] text-white"
                      onClick={() => handleVerifyBankTransfer(order.id)}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                      Approve Payment
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
