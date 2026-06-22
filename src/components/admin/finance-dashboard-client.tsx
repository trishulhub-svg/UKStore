'use client'

// ============================================================
// Finance Dashboard (client-side, interactive)
//
// Replaces the old static server-rendered finance page. Fetches
// data from /api/admin/finance/report, /api/admin/finance/vat-report
// and renders a Stripe-style analytics dashboard with:
//   - Period selector (Today / 7d / 30d / 90d / Custom range)
//   - 6 KPI cards with trend arrows vs previous period
//   - Daily Revenue vs Expenses area chart
//   - Expense Breakdown by Category donut chart
//   - Revenue by Payment Method bar chart
//   - Top 10 Orders + Top 10 Expenses tables
//   - VAT Summary card (standard / reduced / zero-rated)
//   - PDF / Email action buttons (reuses <FinanceClient/>)
// ============================================================

import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from '@/components/ui/chart'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  PoundSterling,
  TrendingUp,
  TrendingDown,
  ShoppingBag,
  Receipt,
  Calculator,
  ArrowUp,
  ArrowDown,
  RefreshCw,
  AlertCircle,
  Minus,
} from 'lucide-react'
import { toast } from 'sonner'
import { formatPrice } from '@/lib/vat'
import { apiFetch } from '@/lib/api-fetch'
import { FinanceClient } from '@/components/admin/finance-client'

// ------------------------------------------------------------
// Types
// ------------------------------------------------------------
interface FinanceReport {
  period: { startDate: string; endDate: string }
  summary: {
    totalRevenue: number
    totalExpenses: number
    profit: number
    profitMargin: number
    totalVat: number
    totalDeliveryFees: number
    totalSubtotal: number
    orderCount: number
    paidOrdersCount: number
    expenseCount: number
  }
  dailyChart: Array<{ date: string; revenue: number; expenses: number }>
  expenseBreakdown: Array<{ category: string; amount: number; percentage: number }>
  paymentByMethod: Array<{ method: string; count: number; total: number }>
  topOrders: Array<{
    id: string
    total: number
    paymentMethod: string | null
    paymentStatus: string
    date: string
  }>
  topExpenses: Array<{
    id: string
    description: string
    category: string
    amount: number
    date: string
  }>
}

interface VatBucket {
  netSales: number
  vatAmount: number
  grossSales: number
  itemCount: number
}
interface VatReport {
  period: string
  startDate: string
  vatBreakdown: Record<string, VatBucket>
  totals: { netSales: number; vatAmount: number; grossSales: number }
}

type PeriodKey = 'today' | '7d' | '30d' | '90d' | 'custom'

// ------------------------------------------------------------
// Palette & chart config
// ------------------------------------------------------------
const PIE_COLORS = [
  '#16a34a',
  '#dc2626',
  '#2563eb',
  '#f97316',
  '#f59e0b',
  '#9333ea',
  '#6b7280',
  '#15803d',
  '#0ea5e9',
  '#d97706',
]
const BAR_COLORS = ['#16a34a', '#2563eb', '#f97316', '#9333ea', '#f59e0b', '#dc2626']

const chartConfig = {
  revenue: { label: 'Revenue', color: '#16a34a' },
  expenses: { label: 'Expenses', color: '#dc2626' },
  total: { label: 'Revenue', color: '#16a34a' },
  amount: { label: 'Amount', color: '#16a34a' },
} as const

// ------------------------------------------------------------
// Date helpers
// ------------------------------------------------------------
function toYMD(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function getDatesForPeriod(
  period: PeriodKey,
  customStart?: string,
  customEnd?: string,
): { start: string; end: string } {
  const today = new Date()
  if (period === 'today') return { start: toYMD(today), end: toYMD(today) }
  if (period === '7d') {
    const start = new Date(today.getTime() - 6 * 86400000)
    return { start: toYMD(start), end: toYMD(today) }
  }
  if (period === '30d') {
    const start = new Date(today.getTime() - 29 * 86400000)
    return { start: toYMD(start), end: toYMD(today) }
  }
  if (period === '90d') {
    const start = new Date(today.getTime() - 89 * 86400000)
    return { start: toYMD(start), end: toYMD(today) }
  }
  // custom
  return { start: customStart || toYMD(today), end: customEnd || toYMD(today) }
}

function getPreviousPeriod(start: string, end: string): { start: string; end: string } {
  const s = new Date(start + 'T00:00:00')
  const e = new Date(end + 'T00:00:00')
  const periodDays = Math.round((e.getTime() - s.getTime()) / 86400000) + 1
  const prevEnd = new Date(s.getTime() - 86400000) // day before current start
  const prevStart = new Date(prevEnd.getTime() - (periodDays - 1) * 86400000)
  return { start: toYMD(prevStart), end: toYMD(prevEnd) }
}

function formatShortDate(s: string): string {
  const d = new Date(s)
  if (isNaN(d.getTime())) return s
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
}

function formatLongDate(s: string): string {
  const d = new Date(s)
  if (isNaN(d.getTime())) return s
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function pctChange(curr: number, prev: number): number | null {
  if (prev === 0) return null // can't compute % change from zero
  return ((curr - prev) / Math.abs(prev)) * 100
}

function mapVatPeriod(period: PeriodKey): string {
  if (period === 'today') return 'today'
  if (period === '7d') return 'week'
  if (period === '30d') return 'month'
  if (period === '90d') return 'quarter'
  return 'month' // custom falls back to current month
}

// ------------------------------------------------------------
// KPI card
// ------------------------------------------------------------
interface KpiCardProps {
  label: string
  value: string
  icon: React.ReactNode
  iconBg: string
  trend: number | null
  trendInverse?: boolean // true if lower-is-better (e.g. expenses)
  trendSuffix?: 'pct' | 'pts' // display suffix
  subValue?: string
}

function KpiCard({
  label,
  value,
  icon,
  iconBg,
  trend,
  trendInverse,
  trendSuffix = 'pct',
  subValue,
}: KpiCardProps) {
  const isFlat = trend !== null && trend === 0
  const isUp = trend !== null && trend > 0
  const isDown = trend !== null && trend < 0
  const isGoodTrend = trendInverse ? isDown : isUp
  const trendColor =
    trend === null
      ? 'text-gray-400'
      : isFlat
        ? 'text-gray-400'
        : isGoodTrend
          ? 'text-green-600'
          : 'text-red-600'

  const trendLabel =
    trendSuffix === 'pts'
      ? `${trend! > 0 ? '+' : ''}${trend!.toFixed(1)} pts`
      : `${Math.abs(trend!).toFixed(1)}%`

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-3 sm:p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] sm:text-xs text-gray-500 truncate">{label}</p>
            <p className="text-base sm:text-xl font-bold text-gray-900 mt-1 truncate">{value}</p>
            {subValue && <p className="text-[10px] text-gray-400 mt-0.5 truncate">{subValue}</p>}
          </div>
          <div
            className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full ${iconBg} flex items-center justify-center shrink-0`}
          >
            {icon}
          </div>
        </div>
        <div className={`mt-2 flex items-center gap-1 text-[11px] font-medium ${trendColor}`}>
          {trend === null ? (
            <>
              <Minus className="h-3 w-3" />
              <span>new this period</span>
            </>
          ) : isFlat ? (
            <>
              <Minus className="h-3 w-3" />
              <span>no change vs prev</span>
            </>
          ) : isUp ? (
            <>
              <ArrowUp className="h-3 w-3" />
              <span>{trendLabel}</span>
              <span className="text-gray-400 font-normal">vs prev</span>
            </>
          ) : (
            <>
              <ArrowDown className="h-3 w-3" />
              <span>{trendLabel}</span>
              <span className="text-gray-400 font-normal">vs prev</span>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// ------------------------------------------------------------
// Main dashboard component
// ------------------------------------------------------------
interface FinanceDashboardClientProps {
  storeName: string
}

export function FinanceDashboardClient({ storeName }: FinanceDashboardClientProps) {
  const [period, setPeriod] = useState<PeriodKey>('30d')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')

  const [report, setReport] = useState<FinanceReport | null>(null)
  const [prevReport, setPrevReport] = useState<FinanceReport | null>(null)
  const [vatReport, setVatReport] = useState<VatReport | null>(null)

  const [loading, setLoading] = useState(true) // initial load
  const [refreshing, setRefreshing] = useState(false) // subsequent period changes
  const [error, setError] = useState<string | null>(null)

  const dates = useMemo(
    () => getDatesForPeriod(period, customStart, customEnd),
    [period, customStart, customEnd],
  )
  const prevDates = useMemo(
    () => getPreviousPeriod(dates.start, dates.end),
    [dates.start, dates.end],
  )

  const fetchData = useCallback(async () => {
    // Skip if custom range not yet picked
    if (period === 'custom' && (!customStart || !customEnd)) {
      return
    }
    if (report) setRefreshing(true)
    else setLoading(true)
    setError(null)
    try {
      const qs = `startDate=${dates.start}&endDate=${dates.end}`
      const prevQs = `startDate=${prevDates.start}&endDate=${prevDates.end}`
      const vatQs = `period=${mapVatPeriod(period)}`

      const [currRes, prevRes, vatRes] = await Promise.all([
        apiFetch(`/api/admin/finance/report?${qs}`),
        apiFetch(`/api/admin/finance/report?${prevQs}`),
        apiFetch(`/api/admin/finance/vat-report?${vatQs}`),
      ])

      if (!currRes.ok) throw new Error('Failed to load finance report')
      const currData: FinanceReport = await currRes.json()
      setReport(currData)

      if (prevRes.ok) {
        setPrevReport(await prevRes.json())
      } else {
        setPrevReport(null)
      }

      if (vatRes.ok) {
        setVatReport(await vatRes.json())
      } else {
        setVatReport(null)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load finance data'
      if (msg !== 'Session expired — redirecting to login') {
        setError(msg)
        toast.error(msg)
      }
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [period, dates.start, dates.end, prevDates.start, prevDates.end, customStart, customEnd, report])

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, dates.start, dates.end, prevDates.start, prevDates.end])

  // ------------------------------------------------------------
  // Derived KPIs
  // ------------------------------------------------------------
  const kpis = useMemo(() => {
    const s = report?.summary
    const p = prevReport?.summary
    if (!s) return null
    const aov = s.orderCount > 0 ? s.totalRevenue / s.orderCount : 0
    const prevAov = p && p.orderCount > 0 ? p.totalRevenue / p.orderCount : 0
    return {
      revenue: s.totalRevenue,
      expenses: s.totalExpenses,
      profit: s.profit,
      margin: s.profitMargin,
      aov,
      orderCount: s.orderCount,
      trends: {
        revenue: pctChange(s.totalRevenue, p?.totalRevenue ?? 0),
        expenses: pctChange(s.totalExpenses, p?.totalExpenses ?? 0),
        profit: pctChange(s.profit, p?.profit ?? 0),
        margin: p ? s.profitMargin - p.profitMargin : null, // percentage-point delta
        aov: pctChange(aov, prevAov),
        orderCount: pctChange(s.orderCount, p?.orderCount ?? 0),
      },
    }
  }, [report, prevReport])

  // ------------------------------------------------------------
  // Initial loading skeleton
  // ------------------------------------------------------------
  if (loading && !report) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-8 w-40" />
            <Skeleton className="h-4 w-72" />
          </div>
          <Skeleton className="h-10 w-64" />
        </div>
        <Skeleton className="h-20 w-full" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Skeleton className="h-80 lg:col-span-2" />
          <Skeleton className="h-72" />
          <Skeleton className="h-72" />
        </div>
        <Skeleton className="h-40 w-full" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Skeleton className="h-72" />
          <Skeleton className="h-72" />
        </div>
      </div>
    )
  }

  // ------------------------------------------------------------
  // Error state (initial load failed)
  // ------------------------------------------------------------
  if (error && !report) {
    return (
      <div className="text-center py-16">
        <AlertCircle className="h-12 w-12 text-red-300 mx-auto mb-4" />
        <p className="text-gray-700 font-medium">{error}</p>
        <p className="text-gray-500 text-sm mt-1">Please try again in a moment.</p>
        <Button
          onClick={() => fetchData()}
          variant="outline"
          className="mt-4 border-[#16a34a] text-[#16a34a] hover:bg-[#16a34a] hover:text-white"
        >
          <RefreshCw className="h-4 w-4 mr-1" /> Retry
        </Button>
      </div>
    )
  }

  if (!report || !kpis) return null

  const hasAnyData = report.summary.orderCount > 0 || report.summary.expenseCount > 0
  const dailyHasData = report.dailyChart.some((d) => d.revenue > 0 || d.expenses > 0)

  return (
    <div className="space-y-6">
      {/* ─── Header + PDF / Email actions ──────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Finance</h1>
          <p className="text-gray-500 text-sm">
            Revenue, expenses, profit, VAT and order analytics
          </p>
        </div>
        <FinanceClient
          initialSummary={{
            totalRevenue: kpis.revenue,
            totalExpenses: kpis.expenses,
            profit: kpis.profit,
            orderCount: kpis.orderCount,
          }}
          storeName={storeName}
        />
      </div>

      {/* ─── Period selector ───────────────────────────────────────── */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row sm:items-end gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-gray-500">Period</label>
              <Select value={period} onValueChange={(v) => setPeriod(v as PeriodKey)}>
                <SelectTrigger className="w-full sm:w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="7d">Last 7 days</SelectItem>
                  <SelectItem value="30d">Last 30 days</SelectItem>
                  <SelectItem value="90d">Last 90 days</SelectItem>
                  <SelectItem value="custom">Custom range</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {period === 'custom' && (
              <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-gray-500">Start date</label>
                  <Input
                    type="date"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                    className="sm:w-44"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-gray-500">End date</label>
                  <Input
                    type="date"
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    className="sm:w-44"
                  />
                </div>
              </div>
            )}

            <div className="text-xs text-gray-500 sm:ml-auto flex items-center gap-2">
              {refreshing && <RefreshCw className="h-3 w-3 animate-spin" />}
              <span>
                Showing{' '}
                <span className="font-medium text-gray-700">{formatLongDate(dates.start)}</span>{' '}
                — <span className="font-medium text-gray-700">{formatLongDate(dates.end)}</span>
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ─── KPI cards ─────────────────────────────────────────────── */}
      <section>
        <div className="flex items-baseline justify-between mb-2">
          <h2 className="text-sm font-semibold text-gray-700">Key performance indicators</h2>
          <p className="text-xs text-gray-400 hidden sm:block">
            Compared to the previous equivalent period
          </p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <KpiCard
            label="Total Revenue"
            value={formatPrice(kpis.revenue)}
            icon={<PoundSterling className="h-4 w-4 text-green-600" />}
            iconBg="bg-green-100"
            trend={kpis.trends.revenue}
          />
          <KpiCard
            label="Total Expenses"
            value={formatPrice(kpis.expenses)}
            icon={<TrendingDown className="h-4 w-4 text-red-600" />}
            iconBg="bg-red-100"
            trend={kpis.trends.expenses}
            trendInverse
          />
          <KpiCard
            label="Net Profit"
            value={formatPrice(kpis.profit)}
            icon={
              kpis.profit >= 0 ? (
                <TrendingUp className="h-4 w-4 text-green-600" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-600" />
              )
            }
            iconBg={kpis.profit >= 0 ? 'bg-green-100' : 'bg-red-100'}
            trend={kpis.trends.profit}
          />
          <KpiCard
            label="Profit Margin"
            value={`${kpis.margin.toFixed(1)}%`}
            icon={<Calculator className="h-4 w-4 text-blue-600" />}
            iconBg="bg-blue-100"
            trend={kpis.trends.margin}
            trendSuffix="pts"
          />
          <KpiCard
            label="Avg Order Value"
            value={formatPrice(kpis.aov)}
            icon={<Receipt className="h-4 w-4 text-purple-600" />}
            iconBg="bg-purple-100"
            trend={kpis.trends.aov}
          />
          <KpiCard
            label="Order Count"
            value={kpis.orderCount.toLocaleString('en-GB')}
            icon={<ShoppingBag className="h-4 w-4 text-orange-600" />}
            iconBg="bg-orange-100"
            trend={kpis.trends.orderCount}
          />
        </div>
      </section>

      {/* ─── Empty state ───────────────────────────────────────────── */}
      {!hasAnyData && (
        <Card>
          <CardContent className="py-12 text-center">
            <Receipt className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-700 font-medium">No financial activity in this period</p>
            <p className="text-gray-500 text-sm mt-1 max-w-md mx-auto">
              There were no orders or expenses recorded between{' '}
              {formatLongDate(dates.start)} and {formatLongDate(dates.end)}. Try widening your date
              range or check back later.
            </p>
          </CardContent>
        </Card>
      )}

      {/* ─── Charts grid ───────────────────────────────────────────── */}
      {hasAnyData && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Daily Revenue vs Expenses — full width */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-[#16a34a]" />
                Daily Revenue vs Expenses
              </CardTitle>
              <CardDescription className="text-xs">
                Track gross sales against operating costs, day by day
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!dailyHasData ? (
                <div className="text-center py-12 text-sm text-gray-500">
                  No revenue or expenses recorded on any day in this period
                </div>
              ) : (
                <ChartContainer
                  config={chartConfig}
                  className="aspect-auto h-72 sm:h-80 w-full"
                >
                  <AreaChart
                    data={report.dailyChart}
                    margin={{ left: 4, right: 12, top: 8, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="fillRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#16a34a" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#16a34a" stopOpacity={0.05} />
                      </linearGradient>
                      <linearGradient id="fillExpenses" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#dc2626" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#dc2626" stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={formatShortDate}
                      minTickGap={24}
                    />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                      width={50}
                      tickFormatter={(v: number) => `£${v}`}
                    />
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          labelFormatter={(label) => formatLongDate(String(label))}
                          formatter={(value, name) => [
                            formatPrice(Number(value)),
                            name === 'revenue' ? 'Revenue' : 'Expenses',
                          ]}
                        />
                      }
                    />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      stroke="#16a34a"
                      strokeWidth={2}
                      fill="url(#fillRevenue)"
                      name="revenue"
                    />
                    <Area
                      type="monotone"
                      dataKey="expenses"
                      stroke="#dc2626"
                      strokeWidth={2}
                      fill="url(#fillExpenses)"
                      name="expenses"
                    />
                    <ChartLegend content={<ChartLegendContent />} />
                  </AreaChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>

          {/* Expense Breakdown donut */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Receipt className="h-4 w-4 text-red-600" />
                Expense Breakdown by Category
              </CardTitle>
              <CardDescription className="text-xs">Where your money is going</CardDescription>
            </CardHeader>
            <CardContent>
              {report.expenseBreakdown.length === 0 ? (
                <div className="text-center py-12 text-sm text-gray-500">
                  No expenses recorded in this period
                </div>
              ) : (
                <>
                  <ChartContainer
                    config={chartConfig}
                    className="aspect-auto h-56 w-full mx-auto"
                  >
                    <PieChart>
                      <Pie
                        data={report.expenseBreakdown}
                        dataKey="amount"
                        nameKey="category"
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={2}
                      >
                        {report.expenseBreakdown.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <ChartTooltip
                        content={
                          <ChartTooltipContent
                            hideLabel
                            formatter={(value, _name, item) => {
                              const p = item?.payload as
                                | { category: string; amount: number; percentage: number }
                                | undefined
                              return [
                                `${formatPrice(Number(value))}${
                                  p ? ` (${p.percentage}%)` : ''
                                }`,
                                p?.category ?? '',
                              ]
                            }}
                          />
                        }
                      />
                    </PieChart>
                  </ChartContainer>
                  <ul className="mt-4 space-y-1.5">
                    {report.expenseBreakdown.slice(0, 6).map((e, i) => (
                      <li
                        key={e.category}
                        className="flex items-center justify-between text-xs gap-2"
                      >
                        <span className="flex items-center gap-2 text-gray-700 min-w-0">
                          <span
                            className="w-2.5 h-2.5 rounded-sm shrink-0"
                            style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}
                          />
                          <span className="capitalize truncate">{e.category}</span>
                        </span>
                        <span className="font-medium text-gray-900 shrink-0">
                          {formatPrice(e.amount)}{' '}
                          <span className="text-gray-400">({e.percentage}%)</span>
                        </span>
                      </li>
                    ))}
                    {report.expenseBreakdown.length > 6 && (
                      <li className="text-[11px] text-gray-400 pt-1">
                        + {report.expenseBreakdown.length - 6} more categories
                      </li>
                    )}
                  </ul>
                </>
              )}
            </CardContent>
          </Card>

          {/* Revenue by Payment Method bar chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <PoundSterling className="h-4 w-4 text-blue-600" />
                Revenue by Payment Method
              </CardTitle>
              <CardDescription className="text-xs">
                Sales split by how customers paid
              </CardDescription>
            </CardHeader>
            <CardContent>
              {report.paymentByMethod.length === 0 ? (
                <div className="text-center py-12 text-sm text-gray-500">
                  No payments recorded in this period
                </div>
              ) : (
                <>
                  <ChartContainer
                    config={chartConfig}
                    className="aspect-auto h-56 w-full"
                  >
                    <BarChart
                      data={report.paymentByMethod}
                      margin={{ left: 4, right: 12, top: 8, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
                      <XAxis
                        dataKey="method"
                        tick={{ fontSize: 11 }}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(v: string) =>
                          v.length > 10 ? v.substring(0, 9) + '…' : v
                        }
                      />
                      <YAxis
                        tick={{ fontSize: 11 }}
                        tickLine={false}
                        axisLine={false}
                        width={50}
                        tickFormatter={(v: number) => `£${v}`}
                      />
                      <ChartTooltip
                        content={
                          <ChartTooltipContent
                            formatter={(value, _name, item) => {
                              const p = item?.payload as
                                | { method: string; total: number; count: number }
                                | undefined
                              return [
                                `${formatPrice(Number(value))}${
                                  p ? ` (${p.count} orders)` : ''
                                }`,
                                p?.method ?? '',
                              ]
                            }}
                          />
                        }
                      />
                      <Bar dataKey="total" radius={[4, 4, 0, 0]} name="total">
                        {report.paymentByMethod.map((_, i) => (
                          <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ChartContainer>
                  <ul className="mt-4 space-y-1.5">
                    {report.paymentByMethod.slice(0, 6).map((p, i) => (
                      <li
                        key={p.method}
                        className="flex items-center justify-between text-xs gap-2"
                      >
                        <span className="flex items-center gap-2 text-gray-700 min-w-0">
                          <span
                            className="w-2.5 h-2.5 rounded-sm shrink-0"
                            style={{ backgroundColor: BAR_COLORS[i % BAR_COLORS.length] }}
                          />
                          <span className="capitalize truncate">{p.method}</span>
                        </span>
                        <span className="font-medium text-gray-900 shrink-0">
                          {formatPrice(p.total)}{' '}
                          <span className="text-gray-400">
                            ({p.count} {p.count === 1 ? 'order' : 'orders'})
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ─── VAT Summary ───────────────────────────────────────────── */}
      {vatReport && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Calculator className="h-4 w-4 text-[#16a34a]" />
              VAT Summary
            </CardTitle>
            <CardDescription className="text-xs">
              VAT collected in the {vatReport.period} period — broken down by rate
            </CardDescription>
          </CardHeader>
          <CardContent>
            {Object.keys(vatReport.vatBreakdown).length === 0 ? (
              <div className="text-center py-8 text-sm text-gray-500">
                No VAT data for this period
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {Object.keys(vatReport.vatBreakdown)
                  .map(Number)
                  .sort((a, b) => b - a)
                  .map((rate) => {
                    const b = vatReport.vatBreakdown[rate]
                    const label =
                      rate === 0
                        ? 'Zero-rated (0%)'
                        : rate === 0.05
                          ? 'Reduced (5%)'
                          : rate === 0.2
                            ? 'Standard (20%)'
                            : `${(rate * 100).toFixed(1)}%`
                    const bg =
                      rate === 0
                        ? 'bg-gray-50 border-gray-200'
                        : rate === 0.05
                          ? 'bg-orange-50 border-orange-200'
                          : 'bg-green-50 border-green-200'
                    const text =
                      rate === 0
                        ? 'text-gray-700'
                        : rate === 0.05
                          ? 'text-orange-700'
                          : 'text-green-700'
                    return (
                      <div key={rate} className={`rounded-lg border p-4 ${bg}`}>
                        <p className={`text-xs font-medium ${text}`}>{label}</p>
                        <p className="text-lg font-bold text-gray-900 mt-1">
                          {formatPrice(b.vatAmount)}
                        </p>
                        <p className="text-[11px] text-gray-500 mt-0.5">
                          on {formatPrice(b.grossSales)} gross · {b.itemCount} items
                        </p>
                      </div>
                    )
                  })}

                <div className="rounded-lg border bg-[#16a34a]/5 border-[#16a34a]/20 p-4 sm:col-span-3">
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div>
                      <p className="text-xs font-medium text-[#15803d]">Total VAT Collected</p>
                      <p className="text-2xl font-bold text-[#16a34a]">
                        {formatPrice(vatReport.totals.vatAmount)}
                      </p>
                    </div>
                    <div className="text-right grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs">
                      <p className="text-gray-500">Net sales</p>
                      <p className="font-medium text-gray-900 text-left">
                        {formatPrice(vatReport.totals.netSales)}
                      </p>
                      <p className="text-gray-500">Gross sales</p>
                      <p className="font-medium text-gray-900 text-left">
                        {formatPrice(vatReport.totals.grossSales)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ─── Top Orders + Top Expenses tables ──────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <ShoppingBag className="h-4 w-4 text-[#16a34a]" />
              Top 10 Orders
            </CardTitle>
            <CardDescription className="text-xs">
              Highest-value orders placed in this period
            </CardDescription>
          </CardHeader>
          <CardContent>
            {report.topOrders.length === 0 ? (
              <div className="text-center py-8 text-sm text-gray-500">
                No orders in this period yet
              </div>
            ) : (
              <div className="overflow-x-auto -mx-2">
                <table className="w-full text-sm min-w-[480px]">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2 px-2 font-medium text-gray-500 text-xs">
                        Order ID
                      </th>
                      <th className="text-left py-2 px-2 font-medium text-gray-500 text-xs">
                        Date
                      </th>
                      <th className="text-left py-2 px-2 font-medium text-gray-500 text-xs">
                        Method
                      </th>
                      <th className="text-left py-2 px-2 font-medium text-gray-500 text-xs">
                        Status
                      </th>
                      <th className="text-right py-2 px-2 font-medium text-gray-500 text-xs">
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.topOrders.map((o) => (
                      <tr key={o.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-2 px-2 font-mono text-xs text-gray-700">
                          {o.id.substring(0, 8)}
                        </td>
                        <td className="py-2 px-2 text-gray-700 whitespace-nowrap">
                          {formatShortDate(o.date)}
                        </td>
                        <td className="py-2 px-2 text-gray-700 capitalize">
                          {o.paymentMethod || '—'}
                        </td>
                        <td className="py-2 px-2">
                          <Badge
                            variant="outline"
                            className={`text-[10px] capitalize ${
                              o.paymentStatus === 'paid'
                                ? 'border-green-200 text-green-700 bg-green-50'
                                : 'border-amber-200 text-amber-700 bg-amber-50'
                            }`}
                          >
                            {o.paymentStatus}
                          </Badge>
                        </td>
                        <td className="py-2 px-2 text-right font-medium text-gray-900 whitespace-nowrap">
                          {formatPrice(o.total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Receipt className="h-4 w-4 text-red-600" />
              Top 10 Expense Line Items
            </CardTitle>
            <CardDescription className="text-xs">
              Biggest single expenses recorded in this period
            </CardDescription>
          </CardHeader>
          <CardContent>
            {report.topExpenses.length === 0 ? (
              <div className="text-center py-8 text-sm text-gray-500">
                No expenses in this period yet
              </div>
            ) : (
              <div className="overflow-x-auto -mx-2">
                <table className="w-full text-sm min-w-[480px]">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2 px-2 font-medium text-gray-500 text-xs">
                        Description
                      </th>
                      <th className="text-left py-2 px-2 font-medium text-gray-500 text-xs">
                        Category
                      </th>
                      <th className="text-left py-2 px-2 font-medium text-gray-500 text-xs">
                        Date
                      </th>
                      <th className="text-right py-2 px-2 font-medium text-gray-500 text-xs">
                        Amount
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.topExpenses.map((e) => (
                      <tr key={e.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-2 px-2 font-medium text-gray-900 max-w-[200px] truncate">
                          {e.description}
                        </td>
                        <td className="py-2 px-2">
                          <Badge
                            variant="outline"
                            className="text-[10px] capitalize"
                          >
                            {e.category}
                          </Badge>
                        </td>
                        <td className="py-2 px-2 text-gray-700 whitespace-nowrap">
                          {formatShortDate(e.date)}
                        </td>
                        <td className="py-2 px-2 text-right font-medium text-red-600 whitespace-nowrap">
                          -{formatPrice(e.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
