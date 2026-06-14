/**
 * Mock data has been intentionally removed.
 * All customer-facing pages now use real data from the database only.
 * If the database is unreachable, pages will show empty states instead of fake data.
 */

import type { Store, Category, ProductWithCategory } from '@/types'

export const mockData: {
  store: Store | null
  categories: Category[]
  products: ProductWithCategory[]
} = {
  store: null,
  categories: [],
  products: [],
}
