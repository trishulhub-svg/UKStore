'use client'

import { useState, useRef } from 'react'
import { Download, Upload, FileSpreadsheet, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { toast } from 'sonner'

interface ImportResult {
  created: number
  updated: number
  failed: number
  errors: string[]
}

interface CSVRow {
  name: string
  description: string
  price: string
  vatRate: string
  category: string
  barcode: string
  unit: string
  weightKg: string
  aisle: string
  minStockThreshold: string
  stockQuantity: string
  isHfss: string
  isAvailable: string
}

const REQUIRED_HEADERS = [
  'name', 'description', 'price', 'vatRate', 'category', 'barcode', 'unit',
  'weightKg', 'aisle', 'minStockThreshold', 'stockQuantity', 'isHfss', 'isAvailable',
]

export function CsvImportExport() {
  const [importing, setImporting] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [previewRows, setPreviewRows] = useState<CSVRow[]>([])
  const [allRows, setAllRows] = useState<CSVRow[]>([])
  const [previewOpen, setPreviewOpen] = useState(false)
  const [resultOpen, setResultOpen] = useState(false)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleExport = async () => {
    setExporting(true)
    try {
      const res = await fetch('/api/admin/products/export')
      if (!res.ok) throw new Error()
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'products-export.csv'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success('Products exported successfully')
    } catch {
      toast.error('Failed to export products')
    } finally {
      setExporting(false)
    }
  }

  const parseCSV = (text: string): CSVRow[] => {
    const lines = text.trim().split('\n')
    if (lines.length < 2) return []

    const headers = parseCSVLine(lines[0])
    const rows: CSVRow[] = []

    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i])
      if (values.length < headers.length) continue

      const row: any = {}
      REQUIRED_HEADERS.forEach((h, idx) => {
        row[h] = values[idx] || ''
      })
      rows.push(row as CSVRow)
    }

    return rows
  }

  const parseCSVLine = (line: string): string[] => {
    const result: string[] = []
    let current = ''
    let inQuotes = false

    for (let i = 0; i < line.length; i++) {
      const char = line[i]
      if (inQuotes) {
        if (char === '"' && line[i + 1] === '"') {
          current += '"'
          i++
        } else if (char === '"') {
          inQuotes = false
        } else {
          current += char
        }
      } else {
        if (char === '"') {
          inQuotes = true
        } else if (char === ',') {
          result.push(current.trim())
          current = ''
        } else {
          current += char
        }
      }
    }
    result.push(current.trim())
    return result
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.name.endsWith('.csv')) {
      toast.error('Please select a CSV file')
      return
    }

    const reader = new FileReader()
    reader.onload = (event) => {
      const text = event.target?.result as string
      const rows = parseCSV(text)
      if (rows.length === 0) {
        toast.error('No valid data rows found in CSV')
        return
      }
      setAllRows(rows)
      setPreviewRows(rows.slice(0, 5))
      setPreviewOpen(true)
    }
    reader.readAsText(file)

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleConfirmImport = async () => {
    setImporting(true)
    setPreviewOpen(false)
    try {
      const res = await fetch('/api/admin/products/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: allRows }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Import failed')
      }
      const result = await res.json()
      setImportResult(result)
      setResultOpen(true)
      toast.success(`Import complete: ${result.created} created, ${result.updated} updated`)
    } catch (err: any) {
      toast.error(err.message || 'Failed to import products')
    } finally {
      setImporting(false)
      setAllRows([])
      setPreviewRows([])
    }
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-gray-600" />
            CSV Import / Export
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              variant="outline"
              onClick={handleExport}
              disabled={exporting}
              className="flex-1 min-h-[44px]"
            >
              <Download className="h-4 w-4 mr-2" />
              {exporting ? 'Exporting...' : 'Export Products'}
            </Button>
            <div className="flex-1">
              <input
                type="file"
                accept=".csv"
                ref={fileInputRef}
                onChange={handleFileSelect}
                className="hidden"
                id="csv-upload"
              />
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={importing}
                className="w-full min-h-[44px]"
              >
                <Upload className="h-4 w-4 mr-2" />
                {importing ? 'Importing...' : 'Import Products'}
              </Button>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            CSV format: name, description, price, vatRate, category, barcode, unit, weightKg, aisle, minStockThreshold, stockQuantity, isHfss, isAvailable
          </p>
        </CardContent>
      </Card>

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Import Preview</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Showing first 5 of {allRows.length} rows. Review the data before confirming import.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border border-gray-200 rounded">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="py-2 px-2 text-left font-medium text-gray-500 border-b">Name</th>
                    <th className="py-2 px-2 text-left font-medium text-gray-500 border-b">Price</th>
                    <th className="py-2 px-2 text-left font-medium text-gray-500 border-b">Category</th>
                    <th className="py-2 px-2 text-left font-medium text-gray-500 border-b">Stock</th>
                    <th className="py-2 px-2 text-left font-medium text-gray-500 border-b">Unit</th>
                    <th className="py-2 px-2 text-left font-medium text-gray-500 border-b">Available</th>
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row, i) => (
                    <tr key={i} className="border-b border-gray-100">
                      <td className="py-2 px-2 font-medium">{row.name}</td>
                      <td className="py-2 px-2">{row.price}</td>
                      <td className="py-2 px-2">{row.category}</td>
                      <td className="py-2 px-2">{row.stockQuantity}</td>
                      <td className="py-2 px-2">{row.unit}</td>
                      <td className="py-2 px-2">
                        <Badge variant="secondary" className={`text-xs ${row.isAvailable !== 'false' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {row.isAvailable !== 'false' ? 'Yes' : 'No'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>Cancel</Button>
            <Button
              onClick={handleConfirmImport}
              className="bg-[#16a34a] hover:bg-[#15803d]"
            >
              <Upload className="h-4 w-4 mr-2" />
              Import {allRows.length} Products
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Results Dialog */}
      <Dialog open={resultOpen} onOpenChange={setResultOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Import Results</DialogTitle>
          </DialogHeader>
          {importResult && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <CheckCircle2 className="h-6 w-6 text-green-600 mx-auto mb-1" />
                  <p className="text-2xl font-bold text-green-700">{importResult.created}</p>
                  <p className="text-xs text-green-600">Created</p>
                </div>
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <CheckCircle2 className="h-6 w-6 text-blue-600 mx-auto mb-1" />
                  <p className="text-2xl font-bold text-blue-700">{importResult.updated}</p>
                  <p className="text-xs text-blue-600">Updated</p>
                </div>
                <div className="text-center p-4 bg-red-50 rounded-lg">
                  <XCircle className="h-6 w-6 text-red-600 mx-auto mb-1" />
                  <p className="text-2xl font-bold text-red-700">{importResult.failed}</p>
                  <p className="text-xs text-red-600">Failed</p>
                </div>
              </div>
              {importResult.errors.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-gray-700 flex items-center gap-1 mb-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    Errors ({importResult.errors.length})
                  </p>
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {importResult.errors.map((err, i) => (
                      <p key={i} className="text-xs text-red-600">{err}</p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setResultOpen(false)} className="bg-[#16a34a] hover:bg-[#15803d]">
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
