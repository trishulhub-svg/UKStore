// ============================================================
// Delivery Pricing Engine
// Dynamic threshold model per TRD Section 2.5 & PRD Section 1.4
// Base fee + per-km charge + free delivery threshold
// ============================================================

import type { DeliveryPricing } from '@/types';

/**
 * Calculate delivery fee based on distance and store pricing config
 */
export function calculateDeliveryFee(params: {
  base_delivery_fee: number;
  per_km_charge: number;
  free_delivery_threshold: number;
  delivery_radius_km: number;
  order_subtotal: number;
  distance_km: number;
}): DeliveryPricing {
  const {
    base_delivery_fee,
    per_km_charge,
    free_delivery_threshold,
    delivery_radius_km,
    order_subtotal,
    distance_km,
  } = params;

  // Check if outside delivery radius
  if (distance_km > delivery_radius_km) {
    return {
      base_fee: base_delivery_fee,
      per_km_charge: per_km_charge,
      free_delivery_threshold: free_delivery_threshold,
      distance_km,
      delivery_fee: 0,
      is_free_delivery: false,
    };
  }

  // Check if order qualifies for free delivery
  if (order_subtotal >= free_delivery_threshold) {
    return {
      base_fee: base_delivery_fee,
      per_km_charge: per_km_charge,
      free_delivery_threshold: free_delivery_threshold,
      distance_km,
      delivery_fee: 0,
      is_free_delivery: true,
    };
  }

  // Calculate fee: base + (per_km * distance)
  const deliveryFee = base_delivery_fee + per_km_charge * distance_km;

  return {
    base_fee: base_delivery_fee,
    per_km_charge: per_km_charge,
    free_delivery_threshold: free_delivery_threshold,
    distance_km,
    delivery_fee: Math.round(deliveryFee * 100) / 100,
    is_free_delivery: false,
  };
}

/**
 * Calculate distance between two coordinates using Haversine formula
 * Returns distance in kilometers
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

/**
 * Check if a delivery address is within the store's delivery zone
 */
export function isWithinDeliveryZone(
  storeLat: number,
  storeLon: number,
  addressLat: number,
  addressLon: number,
  maxRadiusKm: number
): boolean {
  const distance = calculateDistance(storeLat, storeLon, addressLat, addressLon);
  return distance <= maxRadiusKm;
}
