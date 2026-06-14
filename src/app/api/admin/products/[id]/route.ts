import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/admin-auth'

const STORE_ID = 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890'

// GET /api/admin/products/[id]
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin()
  if (error) return error

  try {
    const supabase = getSupabaseAdmin()
    const { id } = await params

    const { data: product, error: dbError } = await supabase
      .from('products')
      .select('*, category:categories(id, name)')
      .eq('id', id)
      .eq('store_id', STORE_ID)
      .maybeSingle()

    if (dbError) {
      console.error('[Admin Product GET]', dbError)
      return NextResponse.json({ error: 'Failed to fetch product' }, { status: 500 })
    }

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    return NextResponse.json({ product })
  } catch (err) {
    console.error('[Admin Product GET]', err)
    return NextResponse.json({ error: 'Failed to fetch product' }, { status: 500 })
  }
}

// PATCH /api/admin/products/[id]
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
      .from('products')
      .select('id')
      .eq('id', id)
      .eq('store_id', STORE_ID)
      .maybeSingle()

    if (fetchError) {
      console.error('[Admin Product PATCH] fetch error:', fetchError)
      return NextResponse.json({ error: 'Failed to update product' }, { status: 500 })
    }
    if (!existing) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    const data: Record<string, unknown> = {}
    if (body.name !== undefined) {
      data.name = body.name
      data.slug = body.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    }
    if (body.categoryId !== undefined) data.category_id = body.categoryId
    if (body.description !== undefined) data.description = body.description || null
    if (body.price !== undefined) data.price = parseFloat(body.price)
    if (body.vatRate !== undefined) data.vat_rate = parseFloat(body.vatRate)
    if (body.isHfss !== undefined) data.is_hfss = body.isHfss
    if (body.imageUrl !== undefined) data.image_url = body.imageUrl || null
    if (body.barcode !== undefined) data.barcode = body.barcode || null
    if (body.unit !== undefined) data.unit = body.unit
    if (body.weightKg !== undefined) data.weight_kg = body.weightKg ? parseFloat(body.weightKg) : null
    if (body.isAvailable !== undefined) data.is_available = body.isAvailable
    if (body.stockQuantity !== undefined) data.stock_quantity = parseInt(body.stockQuantity)
    if (body.isFeatured !== undefined) data.is_featured = body.isFeatured
    if (body.sortOrder !== undefined) data.sort_order = parseInt(body.sortOrder)

    const { data: product, error: dbError } = await supabase
      .from('products')
      .update(data)
      .eq('id', id)
      .select('*, category:categories(id, name)')
      .single()

    if (dbError) {
      console.error('[Admin Product PATCH]', dbError)
      return NextResponse.json({ error: 'Failed to update product' }, { status: 500 })
    }

    return NextResponse.json({ product })
  } catch (err) {
    console.error('[Admin Product PATCH]', err)
    return NextResponse.json({ error: 'Failed to update product' }, { status: 500 })
  }
}

// DELETE /api/admin/products/[id]
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
      .from('products')
      .select('id')
      .eq('id', id)
      .eq('store_id', STORE_ID)
      .maybeSingle()

    if (fetchError) {
      console.error('[Admin Product DELETE] fetch error:', fetchError)
      return NextResponse.json({ error: 'Failed to delete product' }, { status: 500 })
    }
    if (!existing) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    // Check for linked order items
    const { count: orderItemCount, error: countError } = await supabase
      .from('order_items')
      .select('*', { count: 'exact', head: true })
      .eq('product_id', id)

    if (countError) {
      console.error('[Admin Product DELETE] count error:', countError)
      return NextResponse.json({ error: 'Failed to delete product' }, { status: 500 })
    }

    if (orderItemCount && orderItemCount > 0) {
      return NextResponse.json({
        error: `Cannot delete — product is referenced by ${orderItemCount} order item(s)`,
      }, { status: 409 })
    }

    const { error: deleteError } = await supabase
      .from('products')
      .delete()
      .eq('id', id)

    if (deleteError) {
      console.error('[Admin Product DELETE]', deleteError)
      return NextResponse.json({ error: 'Failed to delete product' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[Admin Product DELETE]', err)
    return NextResponse.json({ error: 'Failed to delete product' }, { status: 500 })
  }
}
