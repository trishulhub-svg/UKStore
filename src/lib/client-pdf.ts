/**
 * Client-side PDF export utilities.
 *
 * Uses jsPDF + jspdf-autotable, lazy-loaded so they don't bloat the initial bundle.
 * Each function takes a title, optional metadata, columns spec, and rows.
 */

interface ExportOptions {
  title: string
  subtitle?: string
  filename: string
  columns: string[]
  rows: (string | number)[][]
  /** Optional hex colour [r, g, b] for the table header. Defaults to green. */
  headerColor?: [number, number, number]
  /** Optional footer summary line, rendered below the table */
  footer?: string
}

/**
 * Export a tabular dataset to a PDF using jsPDF + jspdf-autotable.
 * Safe to call from the browser; the libraries are dynamically imported.
 */
export async function exportTableToPdf(opts: ExportOptions): Promise<void> {
  const { jsPDF } = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')

  const doc = new jsPDF()
  const headerColor = opts.headerColor ?? [22, 163, 74] // emerald-600

  // Title
  doc.setFontSize(16)
  doc.setTextColor(0)
  doc.text(opts.title, 14, 18)

  // Subtitle / metadata
  doc.setFontSize(10)
  doc.setTextColor(100)
  let y = 26
  if (opts.subtitle) {
    doc.text(opts.subtitle, 14, y)
    y += 6
  }
  doc.text(`Generated: ${new Date().toLocaleString('en-GB')}`, 14, y)
  y += 6
  doc.text(`Rows: ${opts.rows.length}`, 14, y)

  // Table
  autoTable(doc, {
    startY: y + 8,
    head: [opts.columns],
    body: opts.rows.map((row) => row.map((c) => String(c))),
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: headerColor, textColor: 255 },
    alternateRowStyles: { fillColor: [245, 245, 245] },
  })

  // Footer
  if (opts.footer) {
    const finalY = (doc as any).lastAutoTable?.finalY || y + 20
    doc.setFontSize(11)
    doc.setTextColor(0)
    doc.text(opts.footer, 14, finalY + 10)
  }

  doc.save(opts.filename)
}
