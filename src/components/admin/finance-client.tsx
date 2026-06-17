'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { FileDown, Mail, Loader2, PoundSterling } from 'lucide-react'
import { toast } from 'sonner'
import { exportTableToPdf } from '@/lib/client-pdf'

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

export function FinanceClient({ initialSummary, storeName }: FinanceClientProps) {
  const [generatingPdf, setGeneratingPdf] = useState(false)
  const [sendingEmail, setSendingEmail] = useState(false)

  const handleGeneratePdf = async () => {
    setGeneratingPdf(true)
    try {
      // Fetch the full report for the last 30 days
      const res = await fetch('/api/admin/finance/report')
      if (!res.ok) throw new Error()
      const report: FinanceReport = await res.json()

      // Build a multi-section PDF: cover, summary, daily table, expense breakdown, top orders
      const { jsPDF } = await import('jspdf')
      const { default: autoTable } = await import('jspdf-autotable')
      const doc = new jsPDF()

      const periodLabel = `${fmtDate(report.period.startDate)} – ${fmtDate(report.period.endDate)}`

      // ─── Cover ────────────────────────────────────────────────────
      doc.setFillColor(22, 163, 74) // emerald-600
      doc.rect(0, 0, 210, 50, 'F')
      doc.setTextColor(255)
      doc.setFontSize(22)
      doc.text(storeName, 14, 22)
      doc.setFontSize(13)
      doc.text('Finance Report', 14, 32)
      doc.setFontSize(10)
      doc.text(`Period: ${periodLabel}`, 14, 40)
      doc.text(`Generated: ${new Date().toLocaleString('en-GB')}`, 14, 46)

      // ─── Summary cards (text) ────────────────────────────────────
      doc.setTextColor(0)
      doc.setFontSize(14)
      doc.text('Summary', 14, 62)

      const s = report.summary
      doc.setFontSize(10)
      const summaryRows: [string, string][] = [
        ['Total Revenue', fmt(s.totalRevenue)],
        ['Total Expenses', fmt(s.totalExpenses)],
        ['Net Profit', fmt(s.profit)],
        ['Profit Margin', `${s.profitMargin}%`],
        ['VAT Collected', fmt(s.totalVat)],
        ['Delivery Fees', fmt(s.totalDeliveryFees)],
        ['Subtotal (ex-VAT)', fmt(s.totalSubtotal)],
        ['Orders', `${s.orderCount} (${s.paidOrdersCount} paid)`],
        ['Expenses Logged', `${s.expenseCount}`],
      ]
      summaryRows.forEach(([label, value], i) => {
        const y = 70 + i * 6
        doc.setTextColor(100)
        doc.text(label, 14, y)
        doc.setTextColor(0)
        doc.text(value, 80, y)
      })

      // ─── Daily revenue vs expenses table ─────────────────────────
      autoTable(doc, {
        startY: 130,
        head: [['Date', 'Revenue', 'Expenses', 'Net']],
        body: report.dailyChart.map((d) => [
          fmtDate(d.date),
          fmt(d.revenue),
          fmt(d.expenses),
          fmt(d.revenue - d.expenses),
        ]),
        styles: { fontSize: 9 },
        headStyles: { fillColor: [22, 163, 74] },
        didDrawPage: (data) => {
          doc.setFontSize(12)
          doc.setTextColor(0)
          doc.text('Daily Revenue & Expenses', 14, data.settings.startY - 6)
        },
      })

      // ─── Expense breakdown by category ───────────────────────────
      const afterDailyY = (doc as any).lastAutoTable?.finalY || 200
      autoTable(doc, {
        startY: afterDailyY + 14,
        head: [['Category', 'Amount', '% of Total']],
        body: report.expenseBreakdown.map((e) => [
          e.category,
          fmt(e.amount),
          `${e.percentage}%`,
        ]),
        styles: { fontSize: 9 },
        headStyles: { fillColor: [220, 38, 38] },
        didDrawPage: (data) => {
          doc.setFontSize(12)
          doc.setTextColor(0)
          doc.text('Expense Breakdown by Category', 14, data.settings.startY - 6)
        },
      })

      // ─── Top orders + expenses on a new page ─────────────────────
      doc.addPage()
      doc.setFontSize(14)
      doc.setTextColor(0)
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
        headStyles: { fillColor: [22, 163, 74] },
      })

      const afterOrdersY = (doc as any).lastAutoTable?.finalY || 80
      doc.setFontSize(14)
      doc.setTextColor(0)
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
        headStyles: { fillColor: [220, 38, 38] },
      })

      // ─── Footer on every page ────────────────────────────────────
      const pageCount = doc.getNumberOfPages()
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i)
        doc.setFontSize(8)
        doc.setTextColor(150)
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
      const res = await fetch('/api/admin/finance/email-report', {
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
      toast.error(err.message || 'Failed to send email')
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
