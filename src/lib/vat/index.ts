// ============================================================
// VAT Calculation Utility
// UK VAT rates: 0%, 5%, 20%
// All calculations performed server-side to prevent manipulation
// ============================================================

import type { VatRate, Product, CartItem } from '@/types';

/**
 * UK VAT rate definitions
 * - 0%: Most food, books, children's clothing
 * - 5%: Energy, sanitary products, children's car seats
 * - 20%: Standard rate (most goods and services)
 */
export const VAT_RATES: Record<string, VatRate> = {
  ZERO: 0,
  REDUCED: 0.05,
  STANDARD: 0.2,
} as const;

/**
 * Calculate VAT amount for a given price and rate
 */
export function calculateVat(priceInclVat: number, vatRate: VatRate): number {
  if (vatRate === 0) return 0;
  // Price includes VAT, so extract the VAT portion
  // VAT = Price * (rate / (1 + rate))
  return priceInclVat * (vatRate / (1 + vatRate));
}

/**
 * Calculate net price (excluding VAT) from gross price (including VAT)
 */
export function netPrice(priceInclVat: number, vatRate: VatRate): number {
  return priceInclVat - calculateVat(priceInclVat, vatRate);
}

/**
 * Calculate total VAT for a list of cart items
 */
export function calculateCartVat(items: CartItem[]): number {
  return items.reduce((total, item) => {
    const itemVat = calculateVat(
      item.product.price * item.quantity,
      item.product.vat_rate
    );
    return total + itemVat;
  }, 0);
}

/**
 * Calculate total cart subtotal (all items including VAT)
 */
export function calculateCartSubtotal(items: CartItem[]): number {
  return items.reduce(
    (total, item) => total + item.product.price * item.quantity,
    0
  );
}

/**
 * Format price as GBP (£)
 */
export function formatPrice(amount: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Get VAT rate label
 */
export function getVatRateLabel(vatRate: VatRate): string {
  switch (vatRate) {
    case 0:
      return '0% VAT';
    case 0.05:
      return '5% VAT';
    case 0.2:
      return '20% VAT';
    default:
      return 'VAT';
  }
}

/**
 * Calculate order totals (server-side use)
 */
export function calculateOrderTotals(
  items: Array<{ price: number; quantity: number; vat_rate: VatRate }>,
  deliveryFee: number
) {
  const subtotal = items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );
  const vatAmount = items.reduce(
    (sum, item) =>
      sum + calculateVat(item.price * item.quantity, item.vat_rate),
    0
  );
  const total = subtotal + deliveryFee;

  return {
    subtotal: Math.round(subtotal * 100) / 100,
    vatAmount: Math.round(vatAmount * 100) / 100,
    deliveryFee: Math.round(deliveryFee * 100) / 100,
    total: Math.round(total * 100) / 100,
  };
}
