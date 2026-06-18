'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { FileDown, Mail, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/api-fetch'

interface FinanceClientProps {
  initialSummary: {
    totalRevenue: number
    totalExpenses: number
    profit: number
    orderCount: number
  }
  storeName: string
}

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
  topOrders: Array<{ id: string; total: number; paymentMethod: string | null; paymentStatus: string; date: string }>
  topExpenses: Array<{ id: string; description: string; category: string; amount: number; date: string }>
}

const fmt = (n: number) => `£${n.toFixed(2)}`
const fmtDate = (s: string) => new Date(s).toLocaleDateString('en-GB')
const fmtShortDate = (s: string) => {
  const d = new Date(s)
  return `${d.getDate()}/${d.getMonth() + 1}`
}

// ─── Color palette ──────────────────────────────────────────────
const COLORS = {
  green: [22, 163, 74] as [number, number, number],
  darkGreen: [21, 128, 61] as [number, number, number],
  red: [220, 38, 38] as [number, number, number],
  blue: [37, 99, 235] as [number, number, number],
  orange: [249, 115, 22] as [number, number, number],
  amber: [245, 158, 11] as [number, number, number],
  purple: [147, 51, 234] as [number, number, number],
  gray: [107, 114, 128] as [number, number, number],
  light: [245, 245, 245] as [number, number, number],
  textDark: [17, 24, 39] as [number, number, number],
  textMuted: [107, 114, 128] as [number, number, number],
}

const PIE_COLORS = [
  COLORS.green,
  COLORS.red,
  COLORS.blue,
  COLORS.orange,
  COLORS.amber,
  COLORS.purple,
  COLORS.gray,
  COLORS.darkGreen,
]

export function FinanceClient({ initialSummary, storeName }: FinanceClientProps) {
  const [generatingPdf, setGeneratingPdf] = useState(false)
  const [sendingEmail, setSendingEmail] = useState(false)

  // ─── Chart drawing helpers (jsPDF primitives) ───────────────
  const drawBarChart = (
    doc: any,
    x: number,
    y: number,
    w: number,
    h: number,
    data: Array<{ label: string; revenue: number; expenses: number }>,
  ) => {
    const padding = { left: 36, right: 12, top: 16, bottom: 28 }
    const chartW = w - padding.left - padding.right
    const chartH = h - padding.top - padding.bottom
    const maxVal = Math.max(...data.flatMap((d) => [d.revenue, d.expenses]), 1)
    const niceMax = Math.ceil(maxVal / 50) * 50 || 50
    const barGroupW = chartW / data.length
    const barW = Math.min(8, barGroupW / 3)

    // Background
    doc.setFillColor(...COLORS.light)
    doc.rect(x, y, w, h, 'F')

    // Title
    doc.setFontSize(11)
    doc.setTextColor(...COLORS.textDark)
    doc.text('Daily Revenue vs Expenses', x + 4, y + 10)

    // Y-axis gridlines + labels (4 ticks)
    doc.setFontSize(7)
    doc.setTextColor(...COLORS.textMuted)
    for (let i = 0; i <= 4; i++) {
      const tickVal = (niceMax / 4) * i
      const yPos = y + padding.top + chartH - (chartH * i) / 4
      doc.setDrawColor(220, 220, 220)
      doc.setLineWidth(0.1)
      doc.line(x + padding.left, yPos, x + w - padding.right, yPos)
      doc.text(`£${tickVal.toFixed(0)}`, x + 2, yPos + 2)
    }

    // Bars
    data.forEach((d, i) => {
      const cx = x + padding.left + barGroupW * i + barGroupW / 2
      const revH = (d.revenue / niceMax) * chartH
      const expH = (d.expenses / niceMax) * chartH

      // Revenue bar (green)
      if (d.revenue > 0) {
        doc.setFillColor(...COLORS.green)
        doc.rect(cx - barW - 1, y + padding.top + chartH - revH, barW, revH, 'F')
      }
      // Expenses bar (red)
      if (d.expenses > 0) {
        doc.setFillColor(...COLORS.red)
        doc.rect(cx + 1, y + padding.top + chartH - expH, barW, expH, 'F')
      }

      // X-axis label
      doc.setFontSize(6)
      doc.setTextColor(...COLORS.textMuted)
      if (data.length <= 14 || i % Math.ceil(data.length / 14) === 0) {
        doc.text(d.label, cx, y + padding.top + chartH + 6, { align: 'center' })
      }
    })

    // Legend
    doc.setFontSize(8)
    doc.setTextColor(...COLORS.textDark)
    doc.setFillColor(...COLORS.green)
    doc.rect(x + w - 80, y + 6, 6, 6, 'F')
    doc.text('Revenue', x + w - 70, y + 11)
    doc.setFillColor(...COLORS.red)
    doc.rect(x + w - 45, y + 6, 6, 6, 'F')
    doc.text('Expenses', x + w - 35, y + 11)
  }

  const drawPieChart = (
    doc: any,
    cx: number,
    cy: number,
    radius: number,
    data: Array<{ label: string; value: number; percentage: number }>,
  ) => {
    const total = data.reduce((s, d) => s + d.value, 0) || 1
    let startAngle = -Math.PI / 2 // start at top

    // Slices
    data.forEach((d, i) => {
      const sliceAngle = (d.value / total) * 2 * Math.PI
      const endAngle = startAngle + sliceAngle
      const color = PIE_COLORS[i % PIE_COLORS.length]

      doc.setFillColor(...color)
      doc.setDrawColor(255, 255, 255)
      doc.setLineWidth(0.3)
      // Draw slice as a series of small triangles for smooth curve
      const steps = 30
      doc.beginPath()
      doc.moveTo(cx, cy)
      for (let s = 0; s <= steps; s++) {
        const t = startAngle + (sliceAngle * s) / steps
        const px = cx + radius * Math.cos(t)
        const py = cy + radius * Math.sin(t)
        doc.lineTo(px, py)
      }
      doc.lineTo(cx, cy)
      doc.closePath()
      doc.fill()
      doc.stroke()
      startAngle = endAngle
    })

    // Donut hole (white circle in center)
    doc.setFillColor(255, 255, 255)
    doc.circle(cx, cy, radius * 0.5, 'F')

    // Total in center
    doc.setFontSize(10)
    doc.setTextColor(...COLORS.textDark)
    doc.text('Total', cx, cy - 4, { align: 'center' })
    doc.setFontSize(11)
    doc.text(fmt(total), cx, cy + 6, { align: 'center' })
  }

  const drawLegend = (
    doc: any,
    x: number,
    y: number,
    data: Array<{ label: string; value: number; percentage: number }>,
  ) => {
    doc.setFontSize(8)
    data.forEach((d, i) => {
      const color = PIE_COLORS[i % PIE_COLORS.length]
      const yPos = y + i * 11

      // Color swatch
      doc.setFillColor(...color)
      doc.rect(x, yPos, 6, 6, 'F')

      // Label
      doc.setTextColor(...COLORS.textDark)
      doc.text(d.label, x + 10, yPos + 5)

      // Value + percentage right-aligned
      doc.setTextColor(...COLORS.textMuted)
      doc.text(`${fmt(d.value)} (${d.percentage}%)`, x + 90, yPos + 5, { align: 'right' })
    })
  }

  const handleGeneratePdf = async () => {
    setGeneratingPdf(true)
    try {
      const res = await apiFetch('/api/admin/finance/report')
      if (!res.ok) throw new Error()
      const report: FinanceReport = await res.json()

      const { jsPDF } = await import('jspdf')
      const { default: autoTable } = await import('jspdf-autotable')
      const doc = new jsPDF()

      const periodLabel = `${fmtDate(report.period.startDate)} – ${fmtDate(report.period.endDate)}`

      // ─── Cover ────────────────────────────────────────────────────
      doc.setFillColor(...COLORS.green)
      doc.rect(0, 0, 210, 50, 'F')
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(22)
      doc.text(storeName, 14, 22)
      doc.setFontSize(13)
      doc.text('Finance Report', 14, 32)
      doc.setFontSize(10)
      doc.text(`Period: ${periodLabel}`, 14, 40)
      doc.text(`Generated: ${new Date().toLocaleString('en-GB')}`, 14, 46)

      // ─── Summary cards row ────────────────────────────────────────
      const s = report.summary
      const cardY = 60
      const cardH = 24
      const cardW = 44
      const cards = [
        { label: 'Revenue', value: fmt(s.totalRevenue), color: COLORS.green },
        { label: 'Expenses', value: fmt(s.totalExpenses), color: COLORS.red },
        { label: 'Net Profit', value: fmt(s.profit), color: s.profit >= 0 ? COLORS.green : COLORS.red },
        { label: 'Margin', value: `${s.profitMargin}%`, color: COLORS.blue },
      ]
      cards.forEach((c, i) => {
        const cx = 14 + i * (cardW + 4)
        doc.setFillColor(...COLORS.light)
        doc.rect(cx, cardY, cardW, cardH, 'F')
        // Top color bar
        doc.setFillColor(...c.color)
        doc.rect(cx, cardY, cardW, 2, 'F')
        // Label
        doc.setFontSize(8)
        doc.setTextColor(...COLORS.textMuted)
        doc.text(c.label.toUpperCase(), cx + 4, cardY + 9)
        // Value
        doc.setFontSize(13)
        doc.setTextColor(...COLORS.textDark)
        doc.text(c.value, cx + 4, cardY + 18)
      })

      // ─── Summary text rows ────────────────────────────────────────
      doc.setTextColor(...COLORS.textDark)
      doc.setFontSize(12)
      doc.text('Summary', 14, 100)
      doc.setFontSize(9)
      const summaryRows: [string, string][] = [
        ['VAT Collected', fmt(s.totalVat)],
        ['Delivery Fees', fmt(s.totalDeliveryFees)],
        ['Subtotal (ex-VAT)', fmt(s.totalSubtotal)],
        ['Orders', `${s.orderCount} (${s.paidOrdersCount} paid)`],
        ['Expenses Logged', `${s.expenseCount}`],
      ]
      summaryRows.forEach(([label, value], i) => {
        const y = 106 + i * 5
        doc.setTextColor(...COLORS.textMuted)
        doc.text(label, 14, y)
        doc.setTextColor(...COLORS.textDark)
        doc.text(value, 80, y)
      })

      // ─── Bar chart: Daily Revenue vs Expenses ─────────────────────
      drawBarChart(doc, 14, 138, 182, 70, report.dailyChart.map((d) => ({
        label: fmtShortDate(d.date),
        revenue: d.revenue,
        expenses: d.expenses,
      })))

      // ─── Pie chart: Expense breakdown by category ─────────────────
      doc.setFontSize(11)
      doc.setTextColor(...COLORS.textDark)
      doc.text('Expense Breakdown by Category', 14, 220)

      if (report.expenseBreakdown.length > 0) {
        drawPieChart(doc, 50, 250, 24, report.expenseBreakdown.map((e) => ({
          label: e.category,
          value: e.amount,
          percentage: e.percentage,
        })))
        drawLegend(doc, 90, 240, report.expenseBreakdown.map((e) => ({
          label: e.category,
          value: e.amount,
          percentage: e.percentage,
        })))
      } else {
        doc.setFontSize(9)
        doc.setTextColor(...COLORS.textMuted)
        doc.text('No expenses recorded for this period.', 14, 240)
      }

      // ─── Page 2: Top orders + expenses ────────────────────────────
      doc.addPage()
      doc.setFontSize(14)
      doc.setTextColor(...COLORS.textDark)
      doc.text('Top Orders (by value)', 14, 20)
      autoTable(doc, {
        startY: 26,
        head: [['Order ID', 'Date', 'Payment', 'Status', 'Total']],
        body: report.topOrders.map((o) => [
          o.id.substring(0, 8),
          fmtDate(o.date),
          o.paymentMethod || '—',
          o.paymentStatus,
          fmt(o.total),
        ]),
        styles: { fontSize: 9 },
        headStyles: { fillColor: [...COLORS.green] },
      })

      const afterOrdersY = (doc as any).lastAutoTable?.finalY || 80
      doc.setFontSize(14)
      doc.setTextColor(...COLORS.textDark)
      doc.text('Top Expense Line Items', 14, afterOrdersY + 14)
      autoTable(doc, {
        startY: afterOrdersY + 20,
        head: [['Description', 'Category', 'Date', 'Amount']],
        body: report.topExpenses.map((e) => [
          e.description,
          e.category,
          fmtDate(e.date),
          fmt(e.amount),
        ]),
        styles: { fontSize: 9 },
        headStyles: { fillColor: [...COLORS.red] },
      })

      // ─── Page 3: Payment methods breakdown ───────────────────────
      if (report.paymentByMethod.length > 0) {
        doc.addPage()
        doc.setFontSize(14)
        doc.setTextColor(...COLORS.textDark)
        doc.text('Payment Methods', 14, 20)

        // Bar chart for payment methods
        drawBarChart(doc, 14, 30, 182, 70, report.paymentByMethod.map((p) => ({
          label: p.method,
          revenue: p.total,
          expenses: 0,
        })))

        // Table of payment methods
        autoTable(doc, {
          startY: 110,
          head: [['Method', 'Count', 'Total']],
          body: report.paymentByMethod.map((p) => [
            p.method,
            String(p.count),
            fmt(p.total),
          ]),
          styles: { fontSize: 9 },
          headStyles: { fillColor: [...COLORS.blue] },
        })
      }

      // ─── Footer on every page ────────────────────────────────────
      const pageCount = doc.getNumberOfPages()
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i)
        doc.setFontSize(8)
        doc.setTextColor(150, 150, 150)
        doc.text(
          `${storeName} — Finance Report — Page ${i} of ${pageCount}`,
          14,
          290
        )
      }

      doc.save(`${storeName.toLowerCase().replace(/\s+/g, '-')}-finance-${new Date().toISOString().split('T')[0]}.pdf`)
      toast.success('Finance PDF generated')
    } catch (err) {
      console.error(err)
      toast.error('Failed to generate PDF')
    } finally {
      setGeneratingPdf(false)
    }
  }

  const handleEmailReport = async () => {
    setSendingEmail(true)
    try {
      const res = await apiFetch('/api/admin/finance/email-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed')
      }
      const data = await res.json()
      if (data.emailSent) {
        toast.success(`Report emailed to ${data.recipient}`)
      } else {
        toast.info(data.message || 'Report saved as in-app notification (SMTP not configured)')
      }
    } catch (err: any) {
      if (err?.message !== 'Session expired — redirecting to login') {
        toast.error(err.message || 'Failed to send email')
      }

    } finally {
      setSendingEmail(false)
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        onClick={handleGeneratePdf}
        disabled={generatingPdf}
        className="bg-[#16a34a] hover:bg-[#15803d] text-white"
      >
        {generatingPdf ? (
          <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Generating…</>
        ) : (
          <><FileDown className="h-4 w-4 mr-1" /> Generate PDF Report</>
        )}
      </Button>
      <Button
        onClick={handleEmailReport}
        disabled={sendingEmail}
        variant="outline"
        className="border-[#16a34a] text-[#16a34a] hover:bg-[#16a34a] hover:text-white"
      >
        {sendingEmail ? (
          <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Sending…</>
        ) : (
          <><Mail className="h-4 w-4 mr-1" /> Email to Owner</>
        )}
      </Button>
    </div>
  )
}
