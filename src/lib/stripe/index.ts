// ============================================================
// Stripe Configuration
// Server-side only - uses secret key
// ============================================================

import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  typescript: true,
});

/**
 * Create a Stripe Checkout Session for an order
 */
export async function createCheckoutSession(params: {
  orderId: string;
  items: Array<{
    name: string;
    unitPrice: number;  // Price including VAT
    quantity: number;
    vatRate: number;
  }>;
  deliveryFee: number;
  customerId: string;
  customerEmail: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<string> {
  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
    ...params.items.map((item) => ({
      price_data: {
        currency: 'gbp',
        unit_amount: Math.round(item.unitPrice * 100), // Stripe expects pence
        product_data: {
          name: item.name,
          metadata: {
            vat_rate: item.vatRate.toString(),
          },
        },
      },
      quantity: item.quantity,
    })),
    // Delivery fee as a line item
    {
      price_data: {
        currency: 'gbp',
        unit_amount: Math.round(params.deliveryFee * 100),
        product_data: {
          name: 'Delivery Fee',
          metadata: {
            type: 'delivery_fee',
          },
        },
      },
      quantity: 1,
    },
  ];

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    mode: 'payment',
    line_items: lineItems,
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    customer_email: params.customerEmail,
    metadata: {
      orderId: params.orderId,
      customerId: params.customerId,
    },
    payment_intent_data: {
      metadata: {
        orderId: params.orderId,
      },
    },
    // Enable 3D Secure for SCA compliance (UK requirement)
    payment_method_options: {
      card: {
        request_three_d_secure: 'any',
      },
    },
  });

  return session.url!;
}
