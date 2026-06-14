import { NextResponse } from 'next/server'
import { getPrisma } from '@/lib/auth/prisma'
import { requireAdmin } from '@/lib/admin-auth'

const STORE_ID = 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890'

// GET /api/admin/products/export — Export all products as CSV
export async function GET() {
  const { error } = await requireAdmin()
  if (error) return error

  try {
    const prisma = await getPrisma()

    const products = await prisma.product.findMany({
      where: { storeId: STORE_ID },
      include: { category: { select: { name: true } } },
      orderBy: { name: 'asc' },
    })

    const headers = [
      'name',
      'description',
      'price',
      'vatRate',
      'category',
      'barcode',
      'unit',
      'weightKg',
      'aisle',
      'minStockThreshold',
      'stockQuantity',
      'isHfss',
      'isAgeRestricted',
      'minimumAge',
      'isAvailable',
    ]

    const csvRows = [headers.join(',')]

    for (const p of products) {
      const row = [
        csvEscape(p.name),
        csvEscape(p.description || ''),
        String(p.price),
        String(p.vatRate),
        csvEscape(p.category?.name || ''),
        csvEscape(p.barcode || ''),
        csvEscape(p.unit),
        p.weightKg ? String(p.weightKg) : '',
        csvEscape(p.aisle || ''),
        String(p.minStockThreshold),
        String(p.stockQuantity),
        p.isHfss ? 'true' : 'false',
        p.isAgeRestricted ? 'true' : 'false',
        String(p.minimumAge || 0),
        p.isAvailable ? 'true' : 'false',
      ]
      csvRows.push(row.join(','))
    }

    const csv = csvRows.join('\n')

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="products-export.csv"',
      },
    })
  } catch (err) {
    console.error('[Products Export GET]', err)
    return NextResponse.json({ error: 'Failed to export products' }, { status: 500 })
  }
}

function csvEscape(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}
