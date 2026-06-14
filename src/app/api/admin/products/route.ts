import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/admin-auth'

const STORE_ID = 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890'

// GET /api/admin/products — list products with filters
export async function GET(request: NextRequest) {
  const { error, user } = await requireAdmin()
  if (error) return error

  try {
    const supabase = getSupabaseAdmin()
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const search = searchParams.get('search')
    const sortBy = searchParams.get('sortBy') || 'name'
    const sortOrder = searchParams.get('sortOrder') === 'desc' ? false : true
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')

    // Build query for products with category join
    let query = supabase
      .from('products')
      .select('*, category:categories(id, name)', { count: 'exact' })
      .eq('store_id', STORE_ID)

    if (category) {
      query = query.eq('category_id', category)
    }
    if (search) {
      query = query.ilike('name', `%${search}%`)
    }

    // Map sortBy to snake_case column
    let sortCol = 'name'
    if (sortBy === 'price') sortCol = 'price'
    else if (sortBy === 'stock') sortCol = 'stock_quantity'

    query = query
      .order(sortCol, { ascending: sortOrder })
      .range((page - 1) * limit, (page - 1) * limit + limit - 1)

    const { data: products, error: dbError, count } = await query

    if (dbError) {
      console.error('[Admin Products GET]', dbError)
      return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 })
    }

    return NextResponse.json({ products, total: count, page, limit })
  } catch (err) {
    console.error('[Admin Products GET]', err)
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 })
  }
}

// POST /api/admin/products — create a product
export async function POST(request: NextRequest) {
  const { error, user } = await requireAdmin()
  if (error) return error

  try {
    const supabase = getSupabaseAdmin()
    const body = await request.json()

    const slug = body.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')

    const { data: product, error: dbError } = await supabase
      .from('products')
      .insert({
        store_id: STORE_ID,
        category_id: body.categoryId,
        name: body.name,
        slug,
        description: body.description || null,
        price: parseFloat(body.price),
        vat_rate: parseFloat(body.vatRate || '0'),
        is_hfss: body.isHfss || false,
        image_url: body.imageUrl || null,
        barcode: body.barcode || null,
        unit: body.unit || 'each',
        weight_kg: body.weightKg ? parseFloat(body.weightKg) : null,
        is_available: body.isAvailable !== false,
        stock_quantity: parseInt(body.stockQuantity || '0'),
        is_featured: body.isFeatured || false,
        sort_order: parseInt(body.sortOrder || '0'),
      })
      .select('*, category:categories(id, name)')
      .single()

    if (dbError) {
      console.error('[Admin Products POST]', dbError)
      if (dbError.code === '23505') {
        return NextResponse.json({ error: 'A product with this slug already exists' }, { status: 409 })
      }
      return NextResponse.json({ error: 'Failed to create product' }, { status: 500 })
    }

    return NextResponse.json({ product }, { status: 201 })
  } catch (err) {
    console.error('[Admin Products POST]', err)
    return NextResponse.json({ error: 'Failed to create product' }, { status: 500 })
  }
}
