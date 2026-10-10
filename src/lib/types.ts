/**
 * Domain types for the D.C. housing sample data.
 *
 * `House` is the single record shape shared by the map and the table views;
 * one derived filtered array feeds both so marker count always equals row count.
 */

export type HouseType = 'single-family' | 'townhouse' | 'condo'

export interface House {
  /** Stable unique identifier, e.g. `h-0001`. */
  id: string
  /** Synthetic street address including the city line, e.g. `…, Washington, DC`. */
  address: string
  /** Latitude in decimal degrees (WGS 84). */
  lat: number
  /** Longitude in decimal degrees (WGS 84). */
  lon: number
  /** Asking price in whole US dollars (positive integer). */
  price: number
  /** Bedroom count (non-negative integer). */
  bedrooms: number
  /** Bathroom count; half-baths allowed (positive multiple of 0.5). */
  bathrooms: number
  /** Living area in square feet (positive integer). */
  sqft: number
  /** Property category. */
  type: HouseType
}
