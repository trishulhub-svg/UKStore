import type { Store, Category, ProductWithCategory } from '@/types'

const STORE_ID = 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890'

export const mockData: {
  store: Store
  categories: Category[]
  products: ProductWithCategory[]
} = {
  store: {
    id: STORE_ID,
    name: 'Fresh Mart London',
    slug: 'fresh-mart-london',
    address: '123 High Street, Lewisham, London, SE13 6LG',
    latitude: 51.4612,
    longitude: -0.0117,
    phone: '+44 20 1234 5678',
    email: 'hello@freshmartlondon.co.uk',
    base_delivery_fee: 3.5,
    per_km_charge: 0.5,
    free_delivery_threshold: 20.0,
    delivery_radius_km: 5.0,
    is_active: true,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
  },

  categories: [
    { id: 'b1a10000-0000-4a00-b000-000000000001', store_id: STORE_ID, name: 'Fruits & Vegetables', slug: 'fruits-vegetables', description: 'Fresh produce delivered daily', image_url: null, parent_id: null, sort_order: 1, is_active: true, created_at: '2025-01-01T00:00:00Z' },
    { id: 'b1a10000-0000-4a00-b000-000000000002', store_id: STORE_ID, name: 'Dairy & Eggs', slug: 'dairy-eggs', description: 'Milk, cheese, butter and eggs', image_url: null, parent_id: null, sort_order: 2, is_active: true, created_at: '2025-01-01T00:00:00Z' },
    { id: 'b1a10000-0000-4a00-b000-000000000003', store_id: STORE_ID, name: 'Meat & Fish', slug: 'meat-fish', description: 'Fresh meat and fish counter', image_url: null, parent_id: null, sort_order: 3, is_active: true, created_at: '2025-01-01T00:00:00Z' },
    { id: 'b1a10000-0000-4a00-b000-000000000004', store_id: STORE_ID, name: 'Bakery', slug: 'bakery', description: 'Freshly baked bread and pastries', image_url: null, parent_id: null, sort_order: 4, is_active: true, created_at: '2025-01-01T00:00:00Z' },
    { id: 'b1a10000-0000-4a00-b000-000000000005', store_id: STORE_ID, name: 'Pantry', slug: 'pantry', description: 'Rice, pasta, sauces and more', image_url: null, parent_id: null, sort_order: 5, is_active: true, created_at: '2025-01-01T00:00:00Z' },
    { id: 'b1a10000-0000-4a00-b000-000000000006', store_id: STORE_ID, name: 'Drinks', slug: 'drinks', description: 'Juices, water, soft drinks and tea', image_url: null, parent_id: null, sort_order: 6, is_active: true, created_at: '2025-01-01T00:00:00Z' },
    { id: 'b1a10000-0000-4a00-b000-000000000007', store_id: STORE_ID, name: 'Frozen', slug: 'frozen', description: 'Frozen meals, ice cream and more', image_url: null, parent_id: null, sort_order: 7, is_active: true, created_at: '2025-01-01T00:00:00Z' },
    { id: 'b1a10000-0000-4a00-b000-000000000008', store_id: STORE_ID, name: 'Snacks & Sweets', slug: 'snacks-sweets', description: 'Crisps, biscuits, chocolate and more', image_url: null, parent_id: null, sort_order: 8, is_active: true, created_at: '2025-01-01T00:00:00Z' },
  ],

  products: [
    // Fruits & Vegetables
    {
      id: 'a1000000-0000-4a00-b000-000000000001', store_id: STORE_ID, category_id: 'b1a10000-0000-4a00-b000-000000000001',
      name: 'Organic Bananas', slug: 'organic-bananas', description: 'Fairtrade organic bananas, pack of 6',
      price: 1.49, vat_rate: 0.0, is_hfss: false, image_url: null, barcode: null,
      unit: 'each', weight_kg: null, is_available: true, stock_quantity: 150, is_featured: true,
      sort_order: 0, created_at: '2025-01-01T00:00:00Z', updated_at: '2025-01-01T00:00:00Z',
      category: { id: 'b1a10000-0000-4a00-b000-000000000001', store_id: STORE_ID, name: 'Fruits & Vegetables', slug: 'fruits-vegetables', description: 'Fresh produce delivered daily', image_url: null, parent_id: null, sort_order: 1, is_active: true, created_at: '2025-01-01T00:00:00Z' },
    },
    {
      id: 'a1000000-0000-4a00-b000-000000000002', store_id: STORE_ID, category_id: 'b1a10000-0000-4a00-b000-000000000001',
      name: 'Baby Spinach', slug: 'baby-spinach', description: 'Fresh baby spinach leaves, 200g bag',
      price: 1.89, vat_rate: 0.0, is_hfss: false, image_url: null, barcode: null,
      unit: 'each', weight_kg: null, is_available: true, stock_quantity: 80, is_featured: false,
      sort_order: 0, created_at: '2025-01-01T00:00:00Z', updated_at: '2025-01-01T00:00:00Z',
      category: { id: 'b1a10000-0000-4a00-b000-000000000001', store_id: STORE_ID, name: 'Fruits & Vegetables', slug: 'fruits-vegetables', description: 'Fresh produce delivered daily', image_url: null, parent_id: null, sort_order: 1, is_active: true, created_at: '2025-01-01T00:00:00Z' },
    },
    {
      id: 'a1000000-0000-4a00-b000-000000000003', store_id: STORE_ID, category_id: 'b1a10000-0000-4a00-b000-000000000001',
      name: 'British Strawberries', slug: 'british-strawberries', description: 'Sweet British strawberries, 400g',
      price: 3.49, vat_rate: 0.0, is_hfss: false, image_url: null, barcode: null,
      unit: 'each', weight_kg: null, is_available: true, stock_quantity: 45, is_featured: true,
      sort_order: 0, created_at: '2025-01-01T00:00:00Z', updated_at: '2025-01-01T00:00:00Z',
      category: { id: 'b1a10000-0000-4a00-b000-000000000001', store_id: STORE_ID, name: 'Fruits & Vegetables', slug: 'fruits-vegetables', description: 'Fresh produce delivered daily', image_url: null, parent_id: null, sort_order: 1, is_active: true, created_at: '2025-01-01T00:00:00Z' },
    },

    // Dairy & Eggs
    {
      id: 'a1000000-0000-4a00-b000-000000000004', store_id: STORE_ID, category_id: 'b1a10000-0000-4a00-b000-000000000002',
      name: 'Free Range Eggs', slug: 'free-range-eggs', description: 'Free range large eggs, pack of 12',
      price: 2.79, vat_rate: 0.0, is_hfss: false, image_url: null, barcode: null,
      unit: 'each', weight_kg: null, is_available: true, stock_quantity: 100, is_featured: true,
      sort_order: 0, created_at: '2025-01-01T00:00:00Z', updated_at: '2025-01-01T00:00:00Z',
      category: { id: 'b1a10000-0000-4a00-b000-000000000002', store_id: STORE_ID, name: 'Dairy & Eggs', slug: 'dairy-eggs', description: 'Milk, cheese, butter and eggs', image_url: null, parent_id: null, sort_order: 2, is_active: true, created_at: '2025-01-01T00:00:00Z' },
    },
    {
      id: 'a1000000-0000-4a00-b000-000000000005', store_id: STORE_ID, category_id: 'b1a10000-0000-4a00-b000-000000000002',
      name: 'Semi-Skimmed Milk', slug: 'semi-skimmed-milk', description: 'British semi-skimmed milk, 2 litres',
      price: 1.65, vat_rate: 0.0, is_hfss: false, image_url: null, barcode: null,
      unit: 'each', weight_kg: null, is_available: true, stock_quantity: 200, is_featured: false,
      sort_order: 0, created_at: '2025-01-01T00:00:00Z', updated_at: '2025-01-01T00:00:00Z',
      category: { id: 'b1a10000-0000-4a00-b000-000000000002', store_id: STORE_ID, name: 'Dairy & Eggs', slug: 'dairy-eggs', description: 'Milk, cheese, butter and eggs', image_url: null, parent_id: null, sort_order: 2, is_active: true, created_at: '2025-01-01T00:00:00Z' },
    },
    {
      id: 'a1000000-0000-4a00-b000-000000000006', store_id: STORE_ID, category_id: 'b1a10000-0000-4a00-b000-000000000002',
      name: 'Mature Cheddar', slug: 'mature-cheddar', description: 'Strong mature cheddar cheese, 400g',
      price: 3.29, vat_rate: 0.0, is_hfss: false, image_url: null, barcode: null,
      unit: 'each', weight_kg: null, is_available: true, stock_quantity: 60, is_featured: false,
      sort_order: 0, created_at: '2025-01-01T00:00:00Z', updated_at: '2025-01-01T00:00:00Z',
      category: { id: 'b1a10000-0000-4a00-b000-000000000002', store_id: STORE_ID, name: 'Dairy & Eggs', slug: 'dairy-eggs', description: 'Milk, cheese, butter and eggs', image_url: null, parent_id: null, sort_order: 2, is_active: true, created_at: '2025-01-01T00:00:00Z' },
    },

    // Meat & Fish
    {
      id: 'a1000000-0000-4a00-b000-000000000007', store_id: STORE_ID, category_id: 'b1a10000-0000-4a00-b000-000000000003',
      name: 'Chicken Breast', slug: 'chicken-breast', description: 'Free range chicken breast fillets, 500g',
      price: 5.99, vat_rate: 0.0, is_hfss: false, image_url: null, barcode: null,
      unit: 'kg', weight_kg: 0.5, is_available: true, stock_quantity: 40, is_featured: true,
      sort_order: 0, created_at: '2025-01-01T00:00:00Z', updated_at: '2025-01-01T00:00:00Z',
      category: { id: 'b1a10000-0000-4a00-b000-000000000003', store_id: STORE_ID, name: 'Meat & Fish', slug: 'meat-fish', description: 'Fresh meat and fish counter', image_url: null, parent_id: null, sort_order: 3, is_active: true, created_at: '2025-01-01T00:00:00Z' },
    },
    {
      id: 'a1000000-0000-4a00-b000-000000000008', store_id: STORE_ID, category_id: 'b1a10000-0000-4a00-b000-000000000003',
      name: 'Scottish Salmon Fillet', slug: 'scottish-salmon-fillet', description: 'Fresh Scottish salmon fillet, 200g',
      price: 6.49, vat_rate: 0.0, is_hfss: false, image_url: null, barcode: null,
      unit: 'each', weight_kg: 0.2, is_available: true, stock_quantity: 25, is_featured: false,
      sort_order: 0, created_at: '2025-01-01T00:00:00Z', updated_at: '2025-01-01T00:00:00Z',
      category: { id: 'b1a10000-0000-4a00-b000-000000000003', store_id: STORE_ID, name: 'Meat & Fish', slug: 'meat-fish', description: 'Fresh meat and fish counter', image_url: null, parent_id: null, sort_order: 3, is_active: true, created_at: '2025-01-01T00:00:00Z' },
    },

    // Bakery
    {
      id: 'a1000000-0000-4a00-b000-000000000009', store_id: STORE_ID, category_id: 'b1a10000-0000-4a00-b000-000000000004',
      name: 'Sourdough Loaf', slug: 'sourdough-loaf', description: 'Artisan sourdough bread, freshly baked',
      price: 3.49, vat_rate: 0.0, is_hfss: false, image_url: null, barcode: null,
      unit: 'each', weight_kg: null, is_available: true, stock_quantity: 30, is_featured: true,
      sort_order: 0, created_at: '2025-01-01T00:00:00Z', updated_at: '2025-01-01T00:00:00Z',
      category: { id: 'b1a10000-0000-4a00-b000-000000000004', store_id: STORE_ID, name: 'Bakery', slug: 'bakery', description: 'Freshly baked bread and pastries', image_url: null, parent_id: null, sort_order: 4, is_active: true, created_at: '2025-01-01T00:00:00Z' },
    },
    {
      id: 'a1000000-0000-4a00-b000-000000000010', store_id: STORE_ID, category_id: 'b1a10000-0000-4a00-b000-000000000004',
      name: 'Croissants', slug: 'croissants', description: 'Butter croissants, pack of 4',
      price: 2.29, vat_rate: 0.0, is_hfss: false, image_url: null, barcode: null,
      unit: 'each', weight_kg: null, is_available: true, stock_quantity: 50, is_featured: false,
      sort_order: 0, created_at: '2025-01-01T00:00:00Z', updated_at: '2025-01-01T00:00:00Z',
      category: { id: 'b1a10000-0000-4a00-b000-000000000004', store_id: STORE_ID, name: 'Bakery', slug: 'bakery', description: 'Freshly baked bread and pastries', image_url: null, parent_id: null, sort_order: 4, is_active: true, created_at: '2025-01-01T00:00:00Z' },
    },

    // Pantry
    {
      id: 'a1000000-0000-4a00-b000-000000000011', store_id: STORE_ID, category_id: 'b1a10000-0000-4a00-b000-000000000005',
      name: 'Basmati Rice', slug: 'basmati-rice', description: 'Premium basmati rice, 1kg',
      price: 2.99, vat_rate: 0.0, is_hfss: false, image_url: null, barcode: null,
      unit: 'each', weight_kg: 1.0, is_available: true, stock_quantity: 90, is_featured: false,
      sort_order: 0, created_at: '2025-01-01T00:00:00Z', updated_at: '2025-01-01T00:00:00Z',
      category: { id: 'b1a10000-0000-4a00-b000-000000000005', store_id: STORE_ID, name: 'Pantry', slug: 'pantry', description: 'Rice, pasta, sauces and more', image_url: null, parent_id: null, sort_order: 5, is_active: true, created_at: '2025-01-01T00:00:00Z' },
    },
    {
      id: 'a1000000-0000-4a00-b000-000000000012', store_id: STORE_ID, category_id: 'b1a10000-0000-4a00-b000-000000000005',
      name: 'Penne Pasta', slug: 'penne-pasta', description: 'Italian penne pasta, 500g',
      price: 1.29, vat_rate: 0.0, is_hfss: false, image_url: null, barcode: null,
      unit: 'each', weight_kg: 0.5, is_available: true, stock_quantity: 120, is_featured: false,
      sort_order: 0, created_at: '2025-01-01T00:00:00Z', updated_at: '2025-01-01T00:00:00Z',
      category: { id: 'b1a10000-0000-4a00-b000-000000000005', store_id: STORE_ID, name: 'Pantry', slug: 'pantry', description: 'Rice, pasta, sauces and more', image_url: null, parent_id: null, sort_order: 5, is_active: true, created_at: '2025-01-01T00:00:00Z' },
    },

    // Drinks
    {
      id: 'a1000000-0000-4a00-b000-000000000013', store_id: STORE_ID, category_id: 'b1a10000-0000-4a00-b000-000000000006',
      name: 'Orange Juice', slug: 'orange-juice', description: 'Freshly squeezed orange juice, 1L',
      price: 2.49, vat_rate: 0.0, is_hfss: false, image_url: null, barcode: null,
      unit: 'each', weight_kg: null, is_available: true, stock_quantity: 75, is_featured: true,
      sort_order: 0, created_at: '2025-01-01T00:00:00Z', updated_at: '2025-01-01T00:00:00Z',
      category: { id: 'b1a10000-0000-4a00-b000-000000000006', store_id: STORE_ID, name: 'Drinks', slug: 'drinks', description: 'Juices, water, soft drinks and tea', image_url: null, parent_id: null, sort_order: 6, is_active: true, created_at: '2025-01-01T00:00:00Z' },
    },
    {
      id: 'a1000000-0000-4a00-b000-000000000014', store_id: STORE_ID, category_id: 'b1a10000-0000-4a00-b000-000000000006',
      name: 'Coca-Cola', slug: 'coca-cola', description: 'Classic Coca-Cola, 1.5L bottle',
      price: 1.99, vat_rate: 0.2, is_hfss: true, image_url: null, barcode: null,
      unit: 'each', weight_kg: null, is_available: true, stock_quantity: 100, is_featured: false,
      sort_order: 0, created_at: '2025-01-01T00:00:00Z', updated_at: '2025-01-01T00:00:00Z',
      category: { id: 'b1a10000-0000-4a00-b000-000000000006', store_id: STORE_ID, name: 'Drinks', slug: 'drinks', description: 'Juices, water, soft drinks and tea', image_url: null, parent_id: null, sort_order: 6, is_active: true, created_at: '2025-01-01T00:00:00Z' },
    },

    // Frozen
    {
      id: 'a1000000-0000-4a00-b000-000000000015', store_id: STORE_ID, category_id: 'b1a10000-0000-4a00-b000-000000000007',
      name: 'Frozen Pizza', slug: 'frozen-pizza', description: 'Stone baked margherita pizza',
      price: 3.49, vat_rate: 0.0, is_hfss: true, image_url: null, barcode: null,
      unit: 'each', weight_kg: null, is_available: true, stock_quantity: 55, is_featured: false,
      sort_order: 0, created_at: '2025-01-01T00:00:00Z', updated_at: '2025-01-01T00:00:00Z',
      category: { id: 'b1a10000-0000-4a00-b000-000000000007', store_id: STORE_ID, name: 'Frozen', slug: 'frozen', description: 'Frozen meals, ice cream and more', image_url: null, parent_id: null, sort_order: 7, is_active: true, created_at: '2025-01-01T00:00:00Z' },
    },

    // Snacks & Sweets
    {
      id: 'a1000000-0000-4a00-b000-000000000016', store_id: STORE_ID, category_id: 'b1a10000-0000-4a00-b000-000000000008',
      name: 'Salt & Vinegar Crisps', slug: 'salt-vinegar-crisps', description: 'Classic salt and vinegar crisps, 150g',
      price: 1.59, vat_rate: 0.2, is_hfss: true, image_url: null, barcode: null,
      unit: 'each', weight_kg: null, is_available: true, stock_quantity: 80, is_featured: false,
      sort_order: 0, created_at: '2025-01-01T00:00:00Z', updated_at: '2025-01-01T00:00:00Z',
      category: { id: 'b1a10000-0000-4a00-b000-000000000008', store_id: STORE_ID, name: 'Snacks & Sweets', slug: 'snacks-sweets', description: 'Crisps, biscuits, chocolate and more', image_url: null, parent_id: null, sort_order: 8, is_active: true, created_at: '2025-01-01T00:00:00Z' },
    },
    {
      id: 'a1000000-0000-4a00-b000-000000000017', store_id: STORE_ID, category_id: 'b1a10000-0000-4a00-b000-000000000008',
      name: 'Dark Chocolate Bar', slug: 'dark-chocolate-bar', description: '70% cocoa dark chocolate, 100g',
      price: 1.89, vat_rate: 0.0, is_hfss: true, image_url: null, barcode: null,
      unit: 'each', weight_kg: null, is_available: true, stock_quantity: 60, is_featured: false,
      sort_order: 0, created_at: '2025-01-01T00:00:00Z', updated_at: '2025-01-01T00:00:00Z',
      category: { id: 'b1a10000-0000-4a00-b000-000000000008', store_id: STORE_ID, name: 'Snacks & Sweets', slug: 'snacks-sweets', description: 'Crisps, biscuits, chocolate and more', image_url: null, parent_id: null, sort_order: 8, is_active: true, created_at: '2025-01-01T00:00:00Z' },
    },
    {
      id: 'a1000000-0000-4a00-b000-000000000018', store_id: STORE_ID, category_id: 'b1a10000-0000-4a00-b000-000000000008',
      name: 'Mixed Nuts', slug: 'mixed-nuts', description: 'Roasted and salted mixed nuts, 200g',
      price: 3.29, vat_rate: 0.0, is_hfss: false, image_url: null, barcode: null,
      unit: 'each', weight_kg: null, is_available: true, stock_quantity: 40, is_featured: false,
      sort_order: 0, created_at: '2025-01-01T00:00:00Z', updated_at: '2025-01-01T00:00:00Z',
      category: { id: 'b1a10000-0000-4a00-b000-000000000008', store_id: STORE_ID, name: 'Snacks & Sweets', slug: 'snacks-sweets', description: 'Crisps, biscuits, chocolate and more', image_url: null, parent_id: null, sort_order: 8, is_active: true, created_at: '2025-01-01T00:00:00Z' },
    },

    // More featured items
    {
      id: 'a1000000-0000-4a00-b000-000000000019', store_id: STORE_ID, category_id: 'b1a10000-0000-4a00-b000-000000000002',
      name: 'Greek Yogurt', slug: 'greek-yogurt', description: 'Thick and creamy Greek yogurt, 500g',
      price: 2.49, vat_rate: 0.0, is_hfss: false, image_url: null, barcode: null,
      unit: 'each', weight_kg: null, is_available: true, stock_quantity: 70, is_featured: true,
      sort_order: 0, created_at: '2025-01-01T00:00:00Z', updated_at: '2025-01-01T00:00:00Z',
      category: { id: 'b1a10000-0000-4a00-b000-000000000002', store_id: STORE_ID, name: 'Dairy & Eggs', slug: 'dairy-eggs', description: 'Milk, cheese, butter and eggs', image_url: null, parent_id: null, sort_order: 2, is_active: true, created_at: '2025-01-01T00:00:00Z' },
    },
    {
      id: 'a1000000-0000-4a00-b000-000000000020', store_id: STORE_ID, category_id: 'b1a10000-0000-4a00-b000-000000000005',
      name: 'Extra Virgin Olive Oil', slug: 'extra-virgin-olive-oil', description: 'Italian extra virgin olive oil, 500ml',
      price: 5.99, vat_rate: 0.0, is_hfss: false, image_url: null, barcode: null,
      unit: 'each', weight_kg: null, is_available: true, stock_quantity: 35, is_featured: true,
      sort_order: 0, created_at: '2025-01-01T00:00:00Z', updated_at: '2025-01-01T00:00:00Z',
      category: { id: 'b1a10000-0000-4a00-b000-000000000005', store_id: STORE_ID, name: 'Pantry', slug: 'pantry', description: 'Rice, pasta, sauces and more', image_url: null, parent_id: null, sort_order: 5, is_active: true, created_at: '2025-01-01T00:00:00Z' },
    },
  ],
}
