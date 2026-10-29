/**
 * Loader for the committed DC geography corpus under data/geography/. The
 * generator runs offline on these files only — no network at dataset-
 * generation time. Corpus files are curated from DC GIS Open Data sources
 * (see the fetch-corpus script and docs/data-synthetic.md for provenance and
 * the CC BY 4.0 attribution block).
 */
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import type { Quadrant } from "@dc-reentry/shared";
import { QUADRANTS } from "@dc-reentry/shared";
import { polygonGeometry, type PolygonGeometry } from "./geometry.ts";

const GEOGRAPHY_DIR = fileURLToPath(new URL("../../../data/geography/", import.meta.url));

export type Ring = [number, number][];

interface WardJson {
  id: number;
  rings: Ring[];
}
interface ZipJson {
  code: string;
  rings: Ring[];
}
interface PieceJson {
  w: number;
  poly: Ring;
}
interface StreetJson {
  name: string;
  quadrant: string;
  pieces: PieceJson[];
}
interface CorpusJson {
  format: string;
  wards: WardJson[];
  zips: ZipJson[];
  streets: StreetJson[];
}

export interface ZipIndex {
  code: string;
  geometry: PolygonGeometry;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface StreetPiece {
  ward: number;
  poly: Ring;
}

export interface Street {
  name: string;
  quadrant: Quadrant;
  pieces: StreetPiece[];
}

export type WardShape = { id: number; geometry: PolygonGeometry };

export interface Corpus {
  format: string;
  wards: WardShape[];
  zips: ZipIndex[];
  streets: Street[];
}

function assertRing(raw: unknown, label: string): Ring {
  if (!Array.isArray(raw) || raw.length < 3) {
    throw new Error(`${label}: degenerate ring`);
  }
  return assertLine(raw, label);
}

/** Street pieces are open polylines (≥ 2 points), not closed rings. */
function assertLine(raw: unknown, label: string): Ring {
  if (!Array.isArray(raw) || raw.length < 2) {
    throw new Error(`${label}: degenerate line`);
  }
  for (const point of raw) {
    if (
      !Array.isArray(point) ||
      point.length !== 2 ||
      typeof point[0] !== "number" ||
      typeof point[1] !== "number"
    ) {
      throw new Error(`${label}: malformed point`);
    }
  }
  return raw as Ring;
}

function assertPolygonRings(raw: unknown, label: string): Ring[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new Error(`${label}: polygon rings missing`);
  }
  return raw.map((ring) => assertRing(ring, label));
}

function bboxOf(rings: Ring[]): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const ring of rings) {
    for (const [x, y] of ring) {
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  return { minX, minY, maxX, maxY };
}

function toQuadrant(value: string, label: string): Quadrant {
  if (!(QUADRANTS as readonly string[]).includes(value)) {
    throw new Error(`${label}: unknown quadrant ${value}`);
  }
  return value as Quadrant;
}

let cached: Corpus | null = null;

/** Memoized corpus singleton shared by the CLI and the test suite. */
export async function getCorpus(): Promise<Corpus> {
  if (!cached) {
    cached = await loadCorpusFiles();
  }
  return cached;
}

async function loadCorpusFiles(): Promise<Corpus> {
  const corpus = JSON.parse(
    await readFile(path.join(GEOGRAPHY_DIR, "wards.json"), "utf8"),
  ) as CorpusJson;
  const zips = JSON.parse(
    await readFile(path.join(GEOGRAPHY_DIR, "zips.json"), "utf8"),
  ) as CorpusJson;
  const streets = JSON.parse(
    await readFile(path.join(GEOGRAPHY_DIR, "streets.json"), "utf8"),
  ) as CorpusJson;
  if (
    corpus.format !== "dc-geography-corpus-1" ||
    zips.format !== "dc-geography-corpus-1" ||
    streets.format !== "dc-geography-corpus-1"
  ) {
    throw new Error("corpus files carry an unexpected format");
  }

  const wards: WardShape[] = [];
  for (const ward of corpus.wards) {
    if (typeof ward.id !== "number" || ward.id < 1 || ward.id > 8) {
      throw new Error(`ward with invalid id: ${String(ward.id)}`);
    }
    const rings = assertPolygonRings(ward.rings, `ward ${ward.id}`);
    wards.push({ id: ward.id, geometry: polygonGeometry(rings) });
  }
  if (wards.length !== 8) {
    throw new Error(`corpus must carry all 8 wards, found ${wards.length}`);
  }

  const zipIndex: ZipIndex[] = [];
  for (const zip of zips.zips) {
    if (!/^\d{5}$/.test(zip.code)) {
      throw new Error(`malformed ZIP code: ${zip.code}`);
    }
    const rings = assertPolygonRings(zip.rings, `zip ${zip.code}`);
    const box = bboxOf(rings);
    zipIndex.push({ code: zip.code, geometry: polygonGeometry(rings), ...box });
  }

  const streetEntries: Street[] = [];
  for (const street of streets.streets) {
    if (!street.name || !street.quadrant) {
      throw new Error("street entry missing name or quadrant");
    }
    const pieces: StreetPiece[] = [];
    for (const piece of street.pieces) {
      if (typeof piece.w !== "number" || piece.w < 1 || piece.w > 8) {
        throw new Error(`street ${street.name}: piece ward out of range`);
      }
      pieces.push({ ward: piece.w, poly: assertLine(piece.poly, `street ${street.name}`) });
    }
    streetEntries.push({
      name: street.name,
      quadrant: toQuadrant(street.quadrant, street.name),
      pieces,
    });
  }

  return { format: corpus.format, wards, zips: zipIndex, streets: streetEntries };
}
