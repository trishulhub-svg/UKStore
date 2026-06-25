// End-to-end test of the receipt generation flow.
// Run: npx tsx scripts/test-receipt-flow.ts

import { PrismaClient } from '@prisma/client'
import { generateAndSaveReceipt, buildReceiptHtml, generateReceiptNumber } from '../src/lib/receipt'

const prisma = new PrismaClient()

async function main() {
  console.log('--- Receipt flow test ---')

  // 1. Test receipt number generator
  const num = await generateReceiptNumber()
  console.log('Generated receipt number:', num)
  if (!/^FM-\d{4}-\d{6}$/.test(num)) {
    throw new Error(`Unexpected receipt number format: ${num}`)
  }

  // 2. Find an existing paid order to test with (or use the most recent)
  let order = await prisma.order.findFirst({
    where: { paymentStatus: 'paid' },
    orderBy: { createdAt: 'desc' },
    include: {
      customer: { select: { id: true, name: true, email: true, phone: true } },
      address: true,
      items: true,
      store: { select: { name: true, address: true, phone: true, email: true } },
    },
  })

  if (!order) {
    console.log('No paid order found — creating a test order...')
    // Find any store
    const store = await prisma.store.findFirst()
    if (!store) throw new Error('No store found in DB')

    // Find or create a test user
    let user = await prisma.user.findUnique({ where: { email: 'receipt-test@example.com' } })
    if (!user) {
      user = await prisma.user.create({
        data: {
          email: 'receipt-test@example.com',
          name: 'Receipt Test User',
          role: 'CUSTOMER',
        },
      })
    }

    // Find a real product to satisfy FK constraints
    let product = await prisma.product.findFirst()
    if (!product) {
      // Find or create a category for the test product
      let category = await prisma.category.findFirst({ where: { storeId: store.id } })
      if (!category) {
        category = await prisma.category.create({
          data: { storeId: store.id, name: 'Test Category', slug: `test-cat-${Date.now()}` },
        })
      }
      product = await prisma.product.create({
        data: {
          storeId: store.id,
          categoryId: category.id,
          name: 'Test Product',
          slug: `test-product-${Date.now()}`,
          price: 3.50,
          vatRate: 0.0,
          unit: 'each',
          stockQuantity: 100,
        },
      })
    }

    // Create address
    const addr = await prisma.address.create({
      data: {
        userId: user.id,
        addressLine1: '123 Test Street',
        city: 'London',
        postcode: 'SE1 1AA',
        isDefault: false,
      },
    })

    order = await prisma.order.create({
      data: {
        storeId: store.id,
        customerId: user.id,
        addressId: addr.id,
        status: 'placed',
        subtotal: 12.50,
        vatAmount: 2.08,
        deliveryFee: 3.50,
        total: 16.00,
        stripeSessionId: `test-${Date.now()}`,
        paymentStatus: 'paid',
        paymentMethod: 'stripe',
        items: {
          create: [
            {
              productId: product.id,
              productName: 'Test Apples',
              quantity: 2,
              unitPrice: 3.50,
              vatRate: 0.0,
              vatAmount: 0,
              subtotal: 7.00,
            },
            {
              productId: product.id,
              productName: 'Test Bread',
              quantity: 1,
              unitPrice: 5.50,
              vatRate: 0.2,
              vatAmount: 0.92,
              subtotal: 5.50,
            },
          ],
        },
      },
      include: {
        customer: { select: { id: true, name: true, email: true, phone: true } },
        address: true,
        items: true,
        store: { select: { name: true, address: true, phone: true, email: true } },
      },
    })
    console.log('Created test order:', order.id)
  } else {
    console.log('Using existing order:', order.id, '(receipt:', order.receiptNumber || 'none', ')')

    // Clear existing receipt to test fresh generation
    if (order.receiptNumber) {
      await prisma.order.update({
        where: { id: order.id },
        data: { receiptNumber: null, receiptHtml: null, receiptSentAt: null },
      })
      console.log('Cleared existing receipt for clean test')
    }
  }

  // 3. Test buildReceiptHtml directly
  const sampleReceiptNum = 'FM-2026-000001'
  const html = buildReceiptHtml(
    {
      id: order.id,
      subtotal: order.subtotal,
      vatAmount: order.vatAmount,
      deliveryFee: order.deliveryFee,
      discountAmount: order.discountAmount,
      total: order.total,
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
      createdAt: order.createdAt,
      estimatedDeliveryAt: order.estimatedDeliveryAt,
      deliverySlot: order.deliverySlot,
      notes: order.notes,
      customer: {
        name: order.customer.name,
        email: order.customer.email,
        phone: order.customer.phone,
      },
      address: order.address
        ? {
            addressLine1: order.address.addressLine1,
            addressLine2: order.address.addressLine2,
            city: order.address.city,
            postcode: order.address.postcode,
          }
        : null,
      items: order.items.map((it) => ({
        productName: it.productName,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        vatRate: it.vatRate,
        subtotal: it.subtotal,
      })),
    },
    {
      name: order.store.name,
      address: order.store.address,
      phone: order.store.phone,
      email: order.store.email,
    },
    sampleReceiptNum,
  )
  console.log(`Built HTML receipt: ${html.length} bytes`)
  if (!html.includes(sampleReceiptNum)) {
    throw new Error('Receipt HTML missing receipt number')
  }
  if (!html.includes(order.customer.email)) {
    throw new Error('Receipt HTML missing customer email')
  }
  console.log('HTML contains receipt number + customer email')

  // 4. Test generateAndSaveReceipt
  console.log('Generating + saving receipt via generateAndSaveReceipt()...')
  const result = await generateAndSaveReceipt(order.id)
  if (!result) {
    throw new Error('generateAndSaveReceipt returned null')
  }
  console.log('Receipt generated:')
  console.log('  receiptNumber:', result.receiptNumber)
  console.log('  receiptHtml length:', result.receiptHtml.length, 'bytes')
  console.log('  emailed:', result.emailed)
  if (result.emailError) console.log('  emailError:', result.emailError)

  // 5. Verify it was persisted
  const persisted = await prisma.order.findUnique({
    where: { id: order.id },
    select: { receiptNumber: true, receiptHtml: true, receiptSentAt: true },
  })
  if (!persisted?.receiptNumber || !persisted?.receiptHtml) {
    throw new Error('Receipt was NOT persisted to DB')
  }
  console.log('Receipt persisted to DB:', persisted.receiptNumber)

  // 6. Idempotency — calling again should return the existing receipt
  console.log('Calling generateAndSaveReceipt again (should be idempotent)...')
  const result2 = await generateAndSaveReceipt(order.id)
  if (result2?.receiptNumber !== result.receiptNumber) {
    throw new Error(`Idempotency broken: got ${result2?.receiptNumber}, expected ${result.receiptNumber}`)
  }
  console.log('Idempotency OK')

  // 7. Verify search by receipt number works
  const found = await prisma.order.findFirst({
    where: { receiptNumber: { contains: result.receiptNumber.slice(-6).toUpperCase() } },
  })
  if (!found) {
    throw new Error('Search by receipt number suffix failed')
  }
  console.log('Search by receipt number suffix OK')

  console.log('\n✅ All receipt flow tests passed')
}

main()
  .catch((err) => {
    console.error('❌ Test failed:', err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
