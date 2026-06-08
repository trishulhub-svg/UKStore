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
