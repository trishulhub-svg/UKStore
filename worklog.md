---
Task ID: 1
Agent: Main
Task: Implement location-based delivery zone detection with GPS and postcode geocoding

Work Log:
- Explored codebase: Prisma Store model already had deliveryRadiusKm, latitude, longitude, address, phone, email fields
- Admin StoreStatusManager already had UI for editing deliveryRadiusKm
- Admin StoreProfileEditor already had UI for editing address, lat/lng, phone, email
- Footer already showed dynamic address/phone/email from StoreInfoProvider
- Created DeliveryLocationProvider context (src/lib/delivery-location.tsx) with:
  - User location tracking (GPS, postcode, manual address)
  - Distance calculation from store using Haversine formula
  - Delivery zone validation (within radius or not)
  - Persistence to localStorage
  - Geocoding helpers (geocodePostcode via postcodes.io, geocodeAddress, requestBrowserLocation)
- Created /api/geocode route (src/app/api/geocode/route.ts) for server-side UK postcode geocoding
- Rewrote PostcodeGate component with:
  - "Use My Current Location" GPS button using navigator.geolocation
  - Postcode geocoding via postcodes.io
  - Delivery zone check after geocoding
  - "In Zone" success animation with distance display
  - "Outside Zone" error state with retry option
- Updated CartSidebar to use useDeliveryLocation() for real distance-based fee calculation
- Updated CartClient with real distance, delivery zone warnings, and zone-aware checkout button
- Replaced hardcoded distanceKm=2 in CheckoutClient with:
  - Real distance from DeliveryLocationProvider context
  - Address geocoding on "Continue" button click
  - Delivery zone validation blocking checkout if outside radius
  - Visual delivery zone info (green/red) showing distance and fee breakdown
- Updated Navbar location picker with:
  - GPS detection button ("Use My Current Location")
  - Postcode geocoding with delivery zone check
  - Zone status display (green for in-zone, red for outside)
  - Distance info in the top bar
- Added DeliveryLocationProvider to root layout alongside StoreInfoProvider
- Build succeeded, all APIs tested, pushed to main

Stage Summary:
- Customers can now use GPS or enter postcode to check delivery zone
- Owner can set/change delivery radius in admin settings (already existed)
- Real distance-based delivery fee calculation replaces hardcoded values
- Checkout blocked if delivery address is outside the delivery radius
- Manual address entry at checkout geocoded and validated against zone
- All changes pushed to main branch (commit b8039bd)
