// ============================================================
// Stripe Client-Side Configuration
// For loading Stripe.js in the browser
// ============================================================

import { loadStripe } from '@stripe/stripe-js';

let stripePromise: Promise<any> | null = null;

export function getStripe() {
  if (!stripePromise) {
    stripePromise = loadStripe(
      process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!
    );
  }
  return stripePromise;
}
