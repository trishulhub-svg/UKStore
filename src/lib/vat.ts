// ============================================================
// UK Grocery Store - VAT & Price Utilities
// ============================================================

/**
 * Format a number as GBP currency string
 * e.g., 1.49 => "£1.49", 3 => "£3.00"
 */
export function formatPrice(amount: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

/**
 * Get a human-readable VAT rate label
 */
export function getVatRateLabel(vatRate: number): string {
  const percentage = Math.round(vatRate * 100)
  if (percentage === 0) return 'Zero-rated'
  if (percentage === 5) return '5% VAT'
  if (percentage === 20) return '20% VAT'
  return `${percentage}% VAT`
}

/**
 * Calculate VAT amount from gross price
 * gross = net * (1 + vatRate)
 * vat = gross - (gross / (1 + vatRate))
 */
export function calculateVatFromGross(grossPrice: number, vatRate: number): number {
  if (vatRate === 0) return 0
  return Number((grossPrice - grossPrice / (1 + vatRate)).toFixed(2))
}

/**
 * Calculate net price from gross
 */
export function calculateNetFromGross(grossPrice: number, vatRate: number): number {
  if (vatRate === 0) return grossPrice
  return Number((grossPrice / (1 + vatRate)).toFixed(2))
}

/**
 * Calculate unit price for UK Trading Standards compliance
 * e.g., price=2.49, weightKg=0.5, unit="kg" → "£4.98 per kg"
 * e.g., price=1.50, weightKg=0.3, unit="g" → "£0.50 per 100g"
 * e.g., price=1.10, volumeLitres=1, unit="l" → "£1.10 per litre"
 */
export function formatUnitPrice(
  price: number,
  weightKg?: number | null,
  volumeLitres?: number | null,
  unit?: string
): string | null {
  if (volumeLitres && volumeLitres > 0) {
    const perLitre = price / volumeLitres
    return `${formatPrice(perLitre)} per litre`
  }
  if (weightKg && weightKg > 0) {
    if (unit === 'g' || unit === 'grams') {
      const per100g = (price / (weightKg * 1000)) * 100
      return `${formatPrice(per100g)} per 100g`
    }
    if (unit === 'ml' || unit === 'millilitres') {
      const per100ml = (price / (weightKg * 1000)) * 100
      return `${formatPrice(per100ml)} per 100ml`
    }
    // Default: per kg
    const perKg = price / weightKg
    return `${formatPrice(perKg)} per kg`
  }
  return null // Cannot calculate unit price
}
