import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/admin-auth'

const STORE_ID = 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890'

// GET /api/admin/categories
export async function GET() {
  const { error } = await requireAdmin()
  if (error) return error

  try {
    const supabase = getSupabaseAdmin()

    // Fetch categories with parent info
    const { data: categories, error: dbError } = await supabase
      .from('categories')
      .select('*, parent:categories!parent_id(id, name), products(id)')
      .eq('store_id', STORE_ID)
      .order('sort_order', { ascending: true })

    if (dbError) {
      console.error('[Admin Categories GET]', dbError)
      return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 })
    }

    // Enrich with product counts (mimic Prisma _count)
    const enriched = (categories || []).map((cat: any) => ({
      ...cat,
      _count: { products: cat.products?.length || 0 },
    }))

    return NextResponse.json({ categories: enriched })
  } catch (err) {
    console.error('[Admin Categories GET]', err)
    return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 })
  }
}

// POST /api/admin/categories
export async function POST(request: NextRequest) {
  const { error } = await requireAdmin()
  if (error) return error

  try {
    const supabase = getSupabaseAdmin()
    const body = await request.json()

    const slug = body.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')

    const { data: category, error: dbError } = await supabase
      .from('categories')
      .insert({
        store_id: STORE_ID,
        name: body.name,
        slug,
        description: body.description || null,
        image_url: body.imageUrl || null,
        parent_id: body.parentId || null,
        sort_order: parseInt(body.sortOrder || '0'),
        is_active: body.isActive !== false,
      })
      .select()
      .single()

    if (dbError) {
      console.error('[Admin Categories POST]', dbError)
      if (dbError.code === '23505') {
        return NextResponse.json({ error: 'A category with this slug already exists' }, { status: 409 })
      }
      return NextResponse.json({ error: 'Failed to create category' }, { status: 500 })
    }

    return NextResponse.json({ category }, { status: 201 })
  } catch (err) {
    console.error('[Admin Categories POST]', err)
    return NextResponse.json({ error: 'Failed to create category' }, { status: 500 })
  }
}
