#!/usr/bin/env node
/**
 * Fetches and curates the DC geography corpus that the deterministic dataset
 * generator consumes, writing the JSON files under data/geography/. Network is
 * used ONLY here, at corpus-build time — the generator itself runs offline on
 * the committed corpus.
 *
 * Datasets (all DC GIS Open Data, CC BY 4.0):
 * - Wards from 2022: https://opendata.dc.gov/datasets/c5cd8b40fb784548a6680aead5f919ed
 * - Roadway Block (DDOT): https://opendata.dc.gov/datasets/6fcba8618ae744949630da3ea12d90eb
 * - Zip Codes: https://maps2.dcgis.dc.gov/dcgis/rest/services/DCGIS_DATA/Location_WebMercator/MapServer/4
 *
 * Provenance allowlist honored while curating: street geometry, street names,
 * street-type words, quadrant codes and road-type codes from the Roadway
 * Block layer, plus ward and ZIP boundary polygons. Address-range fields
 * (ADDRESS_RANGE_*), BLOCK_NAME and MAR_ID are never read from the source —
 * building numbers in the generated dataset are sampled from plausible
 * per-street ranges instead. Road-type codes inform only the curation
 * filter; they are not carried into the corpus.
 *
 * Ring handling: polygon membership uses the even-odd rule over the flat
 * rings list (see ringContainsPoint over all rings), which is independent of
 * ring order, orientation, holes and multipolygon parts — the ArcGIS source
 * mixes those without a documented convention.
 *
 * Usage: node tools/datagen/scripts/fetch-corpus.mjs
 */

import { rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const WARDS_URL =
  "https://opendata.dc.gov/api/download/v1/items/c5cd8b40fb784548a6680aead5f919ed/geojson?layers=53";
const STREETS_LAYER =
  "https://maps2.dcgis.dc.gov/dcgis/rest/services/DCGIS_DATA/Transportation_WebMercator/MapServer/163";
const ZIPS_LAYER =
  "https://maps2.dcgis.dc.gov/dcgis/rest/services/DCGIS_DATA/Location_WebMercator/MapServer/4";

const PAGE_SIZE = 2000;
/** Hard cap on pages per query — a malfunctioning upstream must fail loudly
 * instead of looping forever. */
const MAX_PAGES = 50;
/** Hard cap per fetched response body (64 MiB). */
const MAX_RESPONSE_BYTES = 64 * 1024 * 1024;
/** Street sampling step while clipping blocks against ward interiors (meters). */
const SAMPLE_STEP_METERS = 25;
/** Minimum piece length kept in the corpus (meters) — must hold plausible buildings. */
const MIN_PIECE_METERS = 80;
/** Quantization: 5 decimal places ≈ 1.1 m. Keeps the corpus byte-stable and small. */
const POINT_DECIMALS = 5;
/** Douglas–Peucker tolerances in degrees. */
const WARD_SIMPLIFY_EPSILON = 1e-5;
const ZIP_SIMPLIFY_EPSILON = 2e-5;

const dataDir = fileURLToPath(new URL("../../../data/", import.meta.url));
const geographyDir = path.join(dataDir, "geography");

const QUADRANT_BY_CODE = { 1: "NW", 2: "NE", 3: "SE", 4: "SW" };

/** Code-point comparison — locale-independent, stable across engines. */
function compareCodePoint(a, b) {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function log(message) {
  console.log(`[fetch-corpus] ${message}`);
}

const REQUEST_TIMEOUT_MS = 60_000;

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: { "User-Agent": "dc-reentry-unlocked corpus build (offline dataset generator)" },
    // Application-level timeout: a hung upstream fails the build instead of
    // stalling the script forever.
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }
  const declaredLength = Number(response.headers.get("content-length") ?? "");
  if (Number.isFinite(declaredLength) && declaredLength > MAX_RESPONSE_BYTES) {
    throw new Error(
      `response from ${url} declares ${declaredLength} bytes, above the ${MAX_RESPONSE_BYTES} cap`,
    );
  }
  // Enforce the size cap DURING streaming: accumulate chunks with a running
  // byte count and abort past the cap, instead of buffering an unlimited
  // body before checking.
  const parts = [];
  let received = 0;
  for await (const chunk of response.body) {
    received += chunk.length;
    if (received > MAX_RESPONSE_BYTES) {
      throw new Error(
        `response from ${url} streamed past the ${MAX_RESPONSE_BYTES} byte cap; aborted`,
      );
    }
    parts.push(chunk);
  }
  return JSON.parse(
    new TextDecoder("utf8").decode(Buffer.concat(parts.map((chunk) => Buffer.from(chunk)))),
  );
}

/** Paginates an ArcGIS query endpoint honoring the 2000-record cap. */
async function fetchPaginated(layerUrl, where, outFields) {
  const features = [];
  let offset = 0;
  let page = 0;
  for (;;) {
    page++;
    if (page > MAX_PAGES) {
      throw new Error(
        `pagination exceeded the ${MAX_PAGES}-page cap for ${layerUrl}; aborting instead of looping`,
      );
    }
    const query = new URLSearchParams({
      where,
      outFields,
      outSR: "4326",
      f: "json",
      resultOffset: String(offset),
      resultRecordCount: String(PAGE_SIZE),
    });
    const json = await fetchJson(`${layerUrl}/query?${query}`);
    if (json.error) {
      throw new Error(`ArcGIS query error: ${JSON.stringify(json.error)}`);
    }
    const pageFeatures = json.features ?? [];
    features.push(...pageFeatures);
    log(`fetched ${pageFeatures.length} features (offset ${offset})`);
    if (!json.exceededTransferLimit || pageFeatures.length === 0) break;
    offset += pageFeatures.length;
  }
  return features;
}

/* ------------------------------------------------------------------ */
/* Geometry helpers (degree space; the corpus spans a small area, so   */
/* planar math on degrees is adequate for the ~meter-level tolerances  */
/* below).                                                            */
/* ------------------------------------------------------------------ */

/** Douglas–Peucker polyline simplification, iterative, epsilon in degrees. */
function simplify(points, epsilon) {
  if (points.length <= 2) return [...points];
  const keep = Array.from({ length: points.length }, () => false);
  keep[0] = true;
  keep[points.length - 1] = true;
  const stack = [[0, points.length - 1]];
  while (stack.length > 0) {
    const [start, end] = stack.pop();
    const [ax, ay] = points[start];
    const [bx, by] = points[end];
    let index = -1;
    let maxDistance = -1;
    for (let i = start + 1; i < end; i++) {
      const [px, py] = points[i];
      const dx = bx - ax;
      const dy = by - ay;
      const norm2 = dx * dx + dy * dy;
      let distance;
      if (norm2 === 0) {
        distance = Math.sqrt((px - ax) * (px - ax) + (py - ay) * (py - ay));
      } else {
        // Perpendicular distance from point to segment AB.
        const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / norm2));
        const dxp = px - (ax + t * dx);
        const dyp = py - (ay + t * dy);
        distance = Math.sqrt(dxp * dxp + dyp * dyp);
      }
      if (distance > maxDistance) {
        maxDistance = distance;
        index = i;
      }
    }
    if (maxDistance > epsilon) {
      keep[index] = true;
      stack.push([start, index], [index, end]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

/**
 * Even-odd polygon membership over a flat rings list: a point is inside when
 * an odd number of rings contains it. Independent of ring order, orientation,
 * holes and multipolygon parts.
 */
function pointInRings(rings, x, y) {
  let parity = false;
  for (const ring of rings) {
    if (ringContainsPoint(ring, x, y)) parity = !parity;
  }
  return parity;
}

function ringContainsPoint(ring, x, y) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const crosses = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (crosses) inside = !inside;
  }
  return inside;
}

/** Minimum distance from a point to a ring's boundary (degrees). */
function distanceToRing(ring, x, y) {
  let min = Infinity;
  for (let i = 1; i < ring.length; i++) {
    const [ax, ay] = ring[i - 1];
    const [bx, by] = ring[i];
    const dx = bx - ax;
    const dy = by - ay;
    const norm2 = dx * dx + dy * dy;
    let d;
    if (norm2 === 0) {
      const dxx = x - ax;
      const dyy = y - ay;
      d = Math.sqrt(dxx * dxx + dyy * dyy);
    } else {
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / norm2));
      const dxx = x - (ax + t * dx);
      const dyy = y - (ay + t * dy);
      d = Math.sqrt(dxx * dxx + dyy * dyy);
    }
    if (d < min) min = d;
  }
  return min;
}

const BASE_SHAFT_M = 110540; // meters per degree latitude

// Math.cos here feeds only the meter/foot conversion that drives resampling
// granularity and the building-number pitch: the corpus is later resampled at
// 25 m steps and quantized to ~1 m, so any sub-1e-9-m libm drift across
// engines (1 ulp of double) lands far inside the quantization dead band.
function metersPerLon(lat) {
  return Math.max(1, Math.cos((lat * Math.PI) / 180) * BASE_SHAFT_M);
}

function polylineLengthMeters(points) {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const [ax, ay] = points[i - 1];
    const [bx, by] = points[i];
    const dx = (bx - ax) * metersPerLon(ay);
    const dy = (by - ay) * BASE_SHAFT_M;
    total += Math.sqrt(dx * dx + dy * dy);
  }
  return total;
}

/** Resamples a polyline into waypoints at most SAMPLE_STEP_METERS apart. */
function resample(points, stepMeters) {
  if (points.length === 0) return [];
  const out = [[...points[0]]];
  let carry = [...points[0]];
  for (let i = 1; i < points.length; i++) {
    let [ax, ay] = carry;
    const [bx, by] = points[i];
    for (;;) {
      const dx = (bx - ax) * metersPerLon(ay);
      const dy = (by - ay) * BASE_SHAFT_M;
      const length = Math.sqrt(dx * dx + dy * dy);
      if (length < stepMeters) break;
      const t = stepMeters / length;
      const nx = ax + (bx - ax) * t;
      const ny = ay + (by - ay) * t;
      out.push([nx, ny]);
      ax = nx;
      ay = ny;
    }
    carry = [bx, by];
  }
  const [lastX, lastY] = out[out.length - 1];
  if (carry[0] !== lastX || carry[1] !== lastY) {
    out.push(carry);
  }
  return out;
}

function quantize(points) {
  const factor = 10 ** POINT_DECIMALS;
  return points.map(([x, y]) => [Math.round(x * factor) / factor, Math.round(y * factor) / factor]);
}

/** True when the point is inside all rings with distance-to-boundary > margin. */
function strictlyInside(polygon, x, y, margin) {
  if (!pointInRings(polygon.rings, x, y)) return false;
  for (const ring of polygon.rings) {
    if (distanceToRing(ring, x, y) <= margin) return false;
  }
  return true;
}

/**
 * Flattens any accepted geometry type into a flat rings list. Flattening
 * multipolygon parts is safe because membership is resolved with the
 * even-odd rule (see pointInRings), which needs no outer/hole ordering.
 */
function ringsFromGeometry(geometry) {
  if (geometry.type === "Polygon") return geometry.coordinates;
  if (geometry.type === "MultiPolygon") {
    return geometry.coordinates.flatMap((polygon) => polygon);
  }
  // esri JSON delivers polygon rings already (parts merged, convention-free).
  return geometry.rings;
}

/* ------------------------------------------------------------------ */
/* Corpus build                                                       */
/* ------------------------------------------------------------------ */

/**
 * Provenance constants — creator and publisher are recorded separately so
 * the CC BY 4.0 attribution names the right agents for each dataset.
 */
const PROVENANCE = {
  wards: {
    dataset: "Wards from 2022 (Washington DC GIS Open Data)",
    creator: "Government of the District of Columbia, Office of Planning",
    publisher:
      "Government of the District of Columbia, Office of the Chief Technology Officer (OCTO)",
    sourceUrl: WARDS_URL,
    license: "CC BY 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
    modification:
      "Geometry filtered and simplified (Douglas–Peucker deletion of vertices); coordinates kept at full source precision.",
  },
  streets: {
    dataset: "Roadway Block (Washington DC GIS Open Data, DDOT)",
    creator: "Government of the District of Columbia, District Department of Transportation (DDOT)",
    publisher:
      "Government of the District of Columbia, Office of the Chief Technology Officer (OCTO)",
    sourceUrl: STREETS_LAYER,
    license: "CC BY 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
    modification:
      "Geometry filtered (road-type Street, known quadrant), clipped to ward interiors, resampled at ≤25 m steps and quantized to 5 decimal places (~1 m); only street names, street-type words, quadrant code and geometry are carried — the road-type code is used only to filter the source and is not itself carried.",
  },
  zips: {
    dataset: "Zip Codes (Washington DC GIS Open Data)",
    creator:
      "U.S. Postal Service (credited source of ZIP boundaries); curated and published as Open Data by the Government of the District of Columbia, Office of the Chief Technology Officer (OCTO)",
    publisher:
      "Government of the District of Columbia, Office of the Chief Technology Officer (OCTO)",
    sourceUrl: ZIPS_LAYER,
    license: "CC BY 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
    modification:
      "Geometry filtered (ZIP-code features kept) and simplified (Douglas–Peucker deletion of vertices); coordinates kept at full source precision.",
  },
};

const WARD_MARGIN_DEG = 3e-5; // ≈ 3.3 m strict-interior margin (pre-quantization)

async function buildWardPolygons() {
  const geojson = await fetchJson(WARDS_URL);
  const wards = geojson.features.map((feature) => ({
    id: feature.properties.WARD,
    rings: simplifyAll(ringsFromGeometry(feature.geometry), WARD_SIMPLIFY_EPSILON),
  }));
  wards.sort((a, b) => a.id - b.id);
  for (const ward of wards) {
    log(
      `ward ${ward.id}: rings=${ward.rings.length} vertices=${ward.rings.reduce((n, r) => n + r.length, 0)}`,
    );
  }
  return {
    format: "dc-geography-corpus-1",
    provenance: { ...PROVENANCE.wards },
    wards,
  };
}

function simplifyAll(rings, epsilon) {
  return rings.map((ring) => simplify(ring, epsilon)).filter((ring) => ring.length >= 4);
}

async function buildZipPolygons() {
  const features = await fetchPaginated(ZIPS_LAYER, "1=1", "ZIPCODE");
  const seen = new Map();
  for (const feature of features) {
    const zip = String(feature.attributes.ZIPCODE ?? "").trim();
    if (!/^\d{5}$/.test(zip)) continue;
    const rings = ringsFromGeometry(feature.geometry);
    if (!rings || rings.length === 0) continue;
    const simplified = simplifyAll(rings, ZIP_SIMPLIFY_EPSILON);
    if (simplified.length === 0) continue;
    // First authoritatively shaped feature per ZIP wins; later ones are
    // duplicates that appear on the layer for cartographic variants.
    if (!seen.has(zip)) seen.set(zip, { code: zip, rings: simplified });
  }
  const zips = [...seen.values()].sort((a, b) => compareCodePoint(a.code, b.code));
  log(`zip codes kept: ${zips.length}`);
  return {
    format: "dc-geography-corpus-1",
    provenance: { ...PROVENANCE.zips },
    zips,
  };
}

/**
 * Clips street blocks (filtered to ROADTYPE=1 "Street", quadrant 1–4)
 * into sub-polyline pieces running strictly inside a single ward, using the
 * simplified ward polygons the generator will see.
 */
async function buildStreetPieces(wards) {
  const features = await fetchPaginated(
    STREETS_LAYER,
    "ROADTYPE = '1' AND QUADRANT IN (1, 2, 3, 4)",
    "STREETNAME,STREETTYPE,QUADRANT",
  );
  log(`street blocks fetched: ${features.length}`);
  const byStreet = new Map();
  let piecesTotal = 0;
  let sampleCount = 0;
  for (const feature of features) {
    const { STREETNAME, STREETTYPE, QUADRANT } = feature.attributes;
    const quadrant = QUADRANT_BY_CODE[QUADRANT];
    if (!quadrant) continue;
    const name = `${STREETNAME} ${STREETTYPE ?? ""}`.trim();
    if (!name) continue;
    const paths = feature.geometry?.paths ?? [];
    for (const path of paths) {
      const waypoints = resample(path, SAMPLE_STEP_METERS);
      let run = [];
      let runWard = null;
      const flush = () => {
        if (run.length < 2 || runWard === null) {
          run = [];
          runWard = null;
          return;
        }
        const piece = {
          w: runWard,
          poly: quantize(run),
        };
        if (polylineLengthMeters(piece.poly) >= MIN_PIECE_METERS) {
          const key = `${name}|${quadrant}`;
          if (!byStreet.has(key)) {
            byStreet.set(key, { name, quadrant, pieces: [] });
          }
          byStreet.get(key).pieces.push(piece);
          piecesTotal++;
          sampleCount += piece.poly.length;
        }
        run = [];
        runWard = null;
      };
      for (const [x, y] of waypoints) {
        const hits = wards.filter((ward) => strictlyInside(ward, x, y, WARD_MARGIN_DEG));
        const ward = hits.length === 1 ? hits[0].id : null;
        if (ward !== runWard) {
          flush();
          if (ward !== null) {
            run.push([x, y]);
            runWard = ward;
          }
        } else if (ward !== null) {
          run.push([x, y]);
        } else {
          flush();
        }
      }
      flush();
    }
  }
  const streets = [...byStreet.values()].sort(
    (a, b) => compareCodePoint(a.name, b.name) || compareCodePoint(a.quadrant, b.quadrant),
  );
  for (const street of streets) {
    street.pieces.sort((a, b) => a.w - b.w);
  }
  const perWard = {};
  for (const street of streets) {
    for (const piece of street.pieces) {
      perWard[piece.w] = (perWard[piece.w] ?? 0) + 1;
    }
  }
  log(
    `streets kept: ${streets.length} distinct name+quadrant; pieces per ward: ${JSON.stringify(perWard)}`,
  );
  log(`corpus street pieces total: ${piecesTotal}, waypoints: ${sampleCount}`);
  return {
    format: "dc-geography-corpus-1",
    provenance: { ...PROVENANCE.streets },
    streets,
  };
}

/** Writes byte-stable atomically: temp file in the same directory, then rename. */
/**
 * Publishes all three corpus files: every temp file is written first
 * (unique per-process name — concurrent builders must not race on shared
 * temp names), then the three renames run back-to-back. Full multi-file
 * atomicity is impossible across independent files; a rebuild interrupted
 * between renames can land a mixed generation — an accepted residual for
 * developer-only tooling.
 */
async function publishCorpusFiles() {
  const files = [
    {
      file: path.join(geographyDir, "wards.json"),
      contents: JSON.stringify(wards, null, 1) + "\n",
    },
    { file: path.join(geographyDir, "zips.json"), contents: JSON.stringify(zips, null, 1) + "\n" },
    {
      file: path.join(geographyDir, "streets.json"),
      contents: JSON.stringify(streets, null, 1) + "\n",
    },
  ];
  const temps = [];
  try {
    for (const { file, contents } of files) {
      const temp = `${file}.${process.pid}.tmp`;
      await writeFile(temp, contents, "utf8");
      temps.push({ temp, file });
    }
    // All temps staged before the first rename; the publication window is
    // only the three back-to-back renames.
    for (const { temp, file } of temps) {
      await rename(temp, file);
    }
  } catch (error) {
    // Best-effort cleanup of unconsumed temps (already-renamed temps are
    // gone; their unlink failures are swallowed).
    for (const { temp } of temps) {
      await unlink(temp).catch(() => {});
    }
    throw error;
  }
}

const wards = await buildWardPolygons();
log("wards built");
const zips = await buildZipPolygons();
log("zips built");
const streets = await buildStreetPieces(wards.wards);
log("streets built");

await publishCorpusFiles();
log(`corpus written to ${geographyDir}`);
