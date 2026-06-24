// Smoke-test the email + ETA flow as the owner:
//  1. Place a test order via the checkout API (skipped — use existing order if any)
//  2. Manually create an order in the DB and PATCH its status through the admin
//     endpoint, observing whether the email-dispatch code path executes without
//     throwing (it should silently no-op because SMTP creds are bogus).
//  3. Confirm an ETA can be set via PATCH and is persisted.
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient({ datasources: { db: { url: 'file:/home/z/my-project/db/custom.db' } } })
const STORE_ID = 'store-fresh-mart-001'

async function main() {
  // Find or create a test customer
  let customer = await prisma.user.findUnique({ where: { email: 'test-customer@freshmart.local' } })
  if (!customer) {
    const hash = await bcrypt.hash('Test@2026', 12)
    customer = await prisma.user.create({
      data: {
        email: 'test-customer@freshmart.local',
        name: 'Test Customer',
        passwordHash: hash,
        role: 'CUSTOMER',
        isActive: true,
      },
    })
    console.log('Created test customer:', customer.id)
  } else {
    console.log('Using existing test customer:', customer.id)
  }

  // Find or create an address
  let address = await prisma.address.findFirst({ where: { userId: customer.id } })
  if (!address) {
    address = await prisma.address.create({
      data: {
        userId: customer.id,
        addressLine1: '10 Test Street',
        city: 'London',
        postcode: 'SE1 1AA',
        isDefault: true,
      },
    })
    console.log('Created test address:', address.id)
  }

  // Create a fresh order in 'placed' status
  const order = await prisma.order.create({
    data: {
      storeId: STORE_ID,
      customerId: customer.id,
      addressId: address.id,
      status: 'placed',
      subtotal: 20.00,
      vatAmount: 4.00,
      deliveryFee: 3.50,
      total: 27.50,
      paymentStatus: 'paid',
      paymentMethod: 'cash',
    },
  })
  console.log(`\nCreated test order: ${order.id} (status=placed)`)

  // Sanity: confirm ETA is null
  const fresh = await prisma.order.findUnique({ where: { id: order.id }, select: { estimatedDeliveryAt: true, status: true } })
  console.log('Initial ETA:', fresh?.estimatedDeliveryAt, 'status:', fresh?.status)

  await prisma.$disconnect()
  console.log('\nOrder ID for API testing:', order.id)
}

main().catch(err => { console.error(err); process.exit(1) })
