import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/admin-auth'

const STORE_ID = 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890'

// GET /api/admin/categories/[id]
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin()
  if (error) return error

  try {
    const supabase = getSupabaseAdmin()
    const { id } = await params

    const { data: category, error: dbError } = await supabase
      .from('categories')
      .select('*, parent:categories!parent_id(id, name), children:categories!parent_id(id, name), products(id)')
      .eq('id', id)
      .eq('store_id', STORE_ID)
      .maybeSingle()

    if (dbError) {
      console.error('[Admin Category GET]', dbError)
      return NextResponse.json({ error: 'Failed to fetch category' }, { status: 500 })
    }

    if (!category) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 })
    }

    // Enrich with product count
    const enriched = {
      ...category,
      _count: { products: category.products?.length || 0 },
    }

    return NextResponse.json({ category: enriched })
  } catch (err) {
    console.error('[Admin Category GET]', err)
    return NextResponse.json({ error: 'Failed to fetch category' }, { status: 500 })
  }
}

// PATCH /api/admin/categories/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin()
  if (error) return error

  try {
    const supabase = getSupabaseAdmin()
    const { id } = await params
    const body = await request.json()

    // Check existence
    const { data: existing, error: fetchError } = await supabase
      .from('categories')
      .select('id')
      .eq('id', id)
      .eq('store_id', STORE_ID)
      .maybeSingle()

    if (fetchError) {
      console.error('[Admin Category PATCH] fetch error:', fetchError)
      return NextResponse.json({ error: 'Failed to update category' }, { status: 500 })
    }
    if (!existing) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 })
    }

    const data: Record<string, unknown> = {}
    if (body.name !== undefined) {
      data.name = body.name
      data.slug = body.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    }
    if (body.description !== undefined) data.description = body.description || null
    if (body.imageUrl !== undefined) data.image_url = body.imageUrl || null
    if (body.parentId !== undefined) data.parent_id = body.parentId || null
    if (body.sortOrder !== undefined) data.sort_order = parseInt(body.sortOrder)
    if (body.isActive !== undefined) data.is_active = body.isActive

    const { data: category, error: dbError } = await supabase
      .from('categories')
      .update(data)
      .eq('id', id)
      .select()
      .single()

    if (dbError) {
      console.error('[Admin Category PATCH]', dbError)
      return NextResponse.json({ error: 'Failed to update category' }, { status: 500 })
    }

    return NextResponse.json({ category })
  } catch (err) {
    console.error('[Admin Category PATCH]', err)
    return NextResponse.json({ error: 'Failed to update category' }, { status: 500 })
  }
}

// DELETE /api/admin/categories/[id]
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin()
  if (error) return error

  try {
    const supabase = getSupabaseAdmin()
    const { id } = await params

    // Check existence
    const { data: existing, error: fetchError } = await supabase
      .from('categories')
      .select('id')
      .eq('id', id)
      .eq('store_id', STORE_ID)
      .maybeSingle()

    if (fetchError) {
      console.error('[Admin Category DELETE] fetch error:', fetchError)
      return NextResponse.json({ error: 'Failed to delete category' }, { status: 500 })
    }
    if (!existing) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 })
    }

    // Check for linked products
    const { count: productCount, error: countError } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('category_id', id)

    if (countError) {
      console.error('[Admin Category DELETE] count error:', countError)
      return NextResponse.json({ error: 'Failed to delete category' }, { status: 500 })
    }

    if (productCount && productCount > 0) {
      return NextResponse.json({
        error: `Cannot delete — category has ${productCount} product(s). Move them first.`,
      }, { status: 409 })
    }

    const { error: deleteError } = await supabase
      .from('categories')
      .delete()
      .eq('id', id)

    if (deleteError) {
      console.error('[Admin Category DELETE]', deleteError)
      return NextResponse.json({ error: 'Failed to delete category' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[Admin Category DELETE]', err)
    return NextResponse.json({ error: 'Failed to delete category' }, { status: 500 })
  }
}
