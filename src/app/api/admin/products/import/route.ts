import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/auth/prisma'
import { requireAdmin } from '@/lib/admin-auth'

const STORE_ID = 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890'

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
  isAgeRestricted: string
  minimumAge: string
  isAvailable: string
}

// POST /api/admin/products/import — Import products from CSV
export async function POST(request: NextRequest) {
  const { error } = await requireAdmin()
  if (error) return error

  try {
    const prisma = await getPrisma()
    const body = await request.json()
    const { rows } = body as { rows: CSVRow[] }

    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: 'No data rows provided' }, { status: 400 })
    }

    // Get all categories for lookup
    const categories = await prisma.category.findMany({
      where: { storeId: STORE_ID },
    })
    const categoryMap = new Map(categories.map((c) => [c.name.toLowerCase(), c.id]))

    let created = 0
    let updated = 0
    let failed = 0
    const errors: string[] = []

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      try {
        if (!row.name || !row.price) {
          errors.push(`Row ${i + 1}: Missing name or price`)
          failed++
          continue
        }

        const categoryId = row.category ? categoryMap.get(row.category.toLowerCase()) : null
        if (row.category && !categoryId) {
          errors.push(`Row ${i + 1}: Category "${row.category}" not found`)
          failed++
          continue
        }

        const slug = row.name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '')

        // Check if product with same slug exists
        const existing = await prisma.product.findFirst({
          where: { storeId: STORE_ID, slug },
        })

        const productData: any = {
          name: row.name,
          slug,
          description: row.description || null,
          price: parseFloat(row.price) || 0,
          vatRate: parseFloat(row.vatRate || '0'),
          isHfss: row.isHfss === 'true',
          isAgeRestricted: row.isAgeRestricted === 'true',
          minimumAge: parseInt(row.minimumAge || '0'),
          barcode: row.barcode || null,
          unit: row.unit || 'each',
          weightKg: row.weightKg ? parseFloat(row.weightKg) : null,
          aisle: row.aisle || null,
          minStockThreshold: parseInt(row.minStockThreshold || '5'),
          stockQuantity: parseInt(row.stockQuantity || '0'),
          isAvailable: row.isAvailable !== 'false',
        }

        if (categoryId) productData.categoryId = categoryId

        if (existing) {
          await prisma.product.update({
            where: { id: existing.id },
            data: productData,
          })
          updated++
        } else {
          await prisma.product.create({
            data: {
              storeId: STORE_ID,
              categoryId: categoryId || categories[0]?.id,
              ...productData,
            },
          })
          created++
        }
      } catch (err: any) {
        errors.push(`Row ${i + 1}: ${err.message || 'Unknown error'}`)
        failed++
      }
    }

    return NextResponse.json({
      created,
      updated,
      failed,
      errors: errors.slice(0, 20), // Limit error messages
    })
  } catch (err) {
    console.error('[Products Import POST]', err)
    return NextResponse.json({ error: 'Failed to import products' }, { status: 500 })
  }
}
