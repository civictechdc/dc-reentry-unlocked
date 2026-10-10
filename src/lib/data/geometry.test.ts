import { describe, expect, it } from 'vitest'
import { DC_BOUNDARY, DC_RECTANGLE, inDCRectangle, pointInPolygon } from './geometry'

describe('inDCRectangle', () => {
  it('accepts an inside point and rejects points outside each edge', () => {
    expect(inDCRectangle(38.89, -77.01)).toBe(true)
    expect(inDCRectangle(38.96, -77.01)).toBe(false) // north
    expect(inDCRectangle(38.79, -77.01)).toBe(false) // south
    expect(inDCRectangle(38.89, -77.06)).toBe(false) // west
    expect(inDCRectangle(38.89, -76.89)).toBe(false) // east
  })

  it('treats edges and corners as inclusive', () => {
    const { latMin, latMax, lonMin, lonMax } = DC_RECTANGLE
    expect(inDCRectangle(latMin, lonMin)).toBe(true)
    expect(inDCRectangle(latMin, lonMax)).toBe(true)
    expect(inDCRectangle(latMax, lonMin)).toBe(true)
    expect(inDCRectangle(latMax, lonMax)).toBe(true)
  })
})

describe('pointInPolygon', () => {
  it('accepts a point inside the D.C. boundary (near the Capitol)', () => {
    expect(pointInPolygon(38.89, -77.01, DC_BOUNDARY)).toBe(true)
  })

  it('rejects a point far outside the boundary', () => {
    expect(pointInPolygon(39.5, -77.5, DC_BOUNDARY)).toBe(false)
  })

  it('rejects a point inside the rectangle but outside D.C. (east of Eastern Ave)', () => {
    expect(pointInPolygon(38.82, -76.92, DC_BOUNDARY)).toBe(false)
  })
})
