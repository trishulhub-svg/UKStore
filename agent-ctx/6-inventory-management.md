# Task 6 - Inventory Management Features

## Summary
Implemented 5 inventory management features for the UKStore Next.js grocery delivery app.

## Work Done

### Feature 1: Low-Stock Alert Flags
- **API**: Created `/src/app/api/admin/products/low-stock/route.ts` - GET endpoint returning products where stockQuantity <= minStockThreshold, filtered in JS since SQLite doesn't support cross-column comparison
- **Component**: Created `/src/components/admin/low-stock-alerts.tsx` with:
  - Color-coded list: red for out of stock (0), amber for low stock
  - Inline stock update input field with "Set" button
  - "Restock" button opening a modal to add stock quantity
  - Desktop table + mobile card layouts
- **Dashboard**: Modified `/src/components/admin/admin-dashboard-client.tsx` to fetch low-stock count and show amber alert card when products are below threshold

### Feature 2: Wastage & Expiry Logger
- **API**: Created `/src/app/api/admin/wastage/route.ts` with:
  - GET: List wastage logs with reason/date filters + summary stats (weekly/monthly cost)
  - POST: Create wastage log + decrement product stockQuantity in a transaction
- **Page**: Created `/src/app/admin/wastage/page.tsx` with admin auth check
- **Component**: Created `/src/components/admin/wastage-client.tsx` with:
  - Summary cards: weekly cost, monthly cost, total logs, avg per week
  - Form to log wastage: searchable product dropdown (grouped by category), quantity, reason (expired/damaged/spoiled/other), notes
  - Table of wastage logs with product, quantity, cost, reason, date
  - Filter by reason and date range
  - Desktop table + mobile card layouts
- **Sidebar**: Added "Wastage" link to admin sidebar in `/src/components/admin/admin-shell.tsx`

### Feature 3: Pre-Approved Substitutes
- **Admin Product Edit**: Modified `/src/app/admin/products/page.tsx`:
  - Added `substituteProductId` and `minStockThreshold` to Product interface and form
  - Added "Substitute Product" dropdown in edit mode, filtered to same category products
  - Added aisle and minStockThreshold input fields
- **API**: Modified `/src/app/api/admin/products/[id]/route.ts` to handle `substituteProductId`, `minStockThreshold`, and `aisle` fields in PATCH
- **API**: Modified `/src/app/api/admin/products/route.ts` to include `aisle`, `minStockThreshold`, `substituteProductId` in POST
- **Customer-Facing**: Modified `/src/components/customer/product-detail-client.tsx`:
  - Fetches substitute product from `/api/products/[id]/substitute`
  - Shows "Recommended Alternative" card when product is out of stock and substitute exists
  - "Add Instead" button adds substitute to cart
  - Link to view substitute product details
- **API**: Created `/src/app/api/products/[id]/substitute/route.ts` - public endpoint returning the substitute product if available and in stock

### Feature 4: Bulk CSV Import/Export
- **Export API**: Created `/src/app/api/admin/products/export/route.ts` - GET endpoint that generates CSV with proper escaping
- **Import API**: Created `/src/app/api/admin/products/import/route.ts` - POST endpoint that:
  - Accepts array of row objects
  - Maps category names to category IDs
  - Creates or updates products (upsert by slug)
  - Returns count of created/updated/failed
- **Component**: Created `/src/components/admin/csv-import-export.tsx` with:
  - "Export Products" button that downloads CSV file
  - "Import Products" with file upload input
  - CSV parser with proper quote handling
  - Import preview dialog showing first 5 rows
  - Import results dialog showing created/updated/failed counts with error details
- **Products Page**: Added CsvImportExport component to admin products page

### Feature 5: Product Image Upload + Driver Document Upload
- **Upload Utility**: Created `/src/lib/upload.ts` with:
  - `fileToDataUrl()` - converts File to base64 data URL
  - `validateImageFile()` - validates image type (jpg/png/webp) and size (max 2MB)
  - `validateDocumentFile()` - validates document type (jpg/png/webp/pdf) and size (max 5MB)
  - `isDataUrl()` and `getDataUrlMimeType()` helpers
- **Product Image Upload**: Modified admin product form in `/src/app/admin/products/page.tsx`:
  - Added image preview for data URLs
  - Added file upload input with validation
  - Stores as data URL in imageUrl field
- **Driver Document Upload**: Modified `/src/components/driver/driver-profile-client.tsx`:
  - Replaced fake URL uploads with real file upload via base64 encoding
  - Added file input for Right to Work and Driving License documents
  - Added image previews for uploaded documents
  - Added "View" button and full-screen preview modal for documents
  - Loading states during upload
  - Toast notifications for success/failure

## Files Created (9 new)
1. `/src/app/api/admin/products/low-stock/route.ts`
2. `/src/app/api/admin/wastage/route.ts`
3. `/src/app/api/admin/products/export/route.ts`
4. `/src/app/api/admin/products/import/route.ts`
5. `/src/app/api/products/[id]/substitute/route.ts`
6. `/src/app/admin/wastage/page.tsx`
7. `/src/components/admin/low-stock-alerts.tsx`
8. `/src/components/admin/wastage-client.tsx`
9. `/src/components/admin/csv-import-export.tsx`
10. `/src/lib/upload.ts`

## Files Modified (7)
1. `/src/components/admin/admin-dashboard-client.tsx` - Added low-stock alert card
2. `/src/components/admin/admin-shell.tsx` - Added Wastage sidebar link
3. `/src/app/admin/products/page.tsx` - Added substitute, aisle, minStockThreshold, image upload, CSV component
4. `/src/app/api/admin/products/route.ts` - Added aisle, minStockThreshold, substituteProductId to POST
5. `/src/app/api/admin/products/[id]/route.ts` - Added aisle, minStockThreshold, substituteProductId to PATCH
6. `/src/components/customer/product-detail-client.tsx` - Added substitute product display
7. `/src/components/driver/driver-profile-client.tsx` - Added real file upload for documents

## Quality
- All new/modified files pass ESLint (0 errors)
- No new TypeScript errors introduced
- All components are responsive (mobile-first with desktop table + mobile card patterns)
- Uses shadcn/ui components throughout
- Production-quality TypeScript with strict typing
