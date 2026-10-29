/**
 * Fictional provider and program name composition, plus fictional contact
 * details. Everything below is generated from generic name-part lists — no
 * real organization lists are copied. Phone numbers use the fictional
 * reserved 555 exchange; domains stay under the reserved example.org domain
 * so no fictional contact can ever resolve to a real endpoint.
 *
 * The collision test (see tests/generate-collision.test.ts) cross-checks the
 * generated names against a machine-local real-provider exclusion list when
 * that list is present.
 */
import type { Rng } from "./rng.ts";
import { chance, pick } from "./rng.ts";

/** DC fictional phone: area 202 + the reserved-for-fiction 555-01XX exchange. */
const PHONE_PREFIX = "(202) 555-";
const PHONE_POOL_START = 100;
const PHONE_POOL_SIZE = 100;

const ORGANIZATION_PREFIXES = [
  "Anchor",
  "Aspen",
  "Autumn",
  "Beacon",
  "Birch",
  "Bluebird",
  "Bridgefield",
  "Calder",
  "Cardinal",
  "Cedar",
  "Cobalt",
  "Copperlight",
  "Cove",
  "Crescent",
  "Dawnfield",
  "Elm",
  "Fernhill",
  "Foxglove",
  "Granite",
  "Heron",
  "Juniper",
  "Lantern",
  "Mallardview",
  "Meadowview",
  "Mossbank",
  "Nomad",
  "Orchard",
  "Osprey",
  "Poplar",
  "Quarry",
  "Ridgeline",
  "Rowan",
  "Saltbox",
  "Slaterock",
  "Spruce",
  "Summit",
  "Tidepool",
  "Windfern",
  "Maplecrest",
  "Oakfield",
] as const;

const ORGANIZATION_CORES = [
  "Housing Alliance",
  "Residences",
  "Community Housing",
  "Affordable Housing",
  "Housing Network",
  "Homes",
  "Housing Partnership",
  "Housing Collective",
  "Housing Initiative",
  "Home Foundation",
  "Housing Foundation",
  "Housing Services",
  "Housing Collaborative",
  "Housing Project",
  "Housing Trust",
  "Habitat Collective",
  "Housing Circle",
  "Homeport Group",
  "Housing Stewardship",
  "Housing Commons",
] as const;

const PROGRAM_TYPE_WORDS: Record<string, readonly string[]> = {
  "emergency-shelter": ["Emergency Shelter", "Overnight Shelter", "Nightly Shelter"],
  transitional: ["Transitional Housing", "Bridge Housing", "Transitional Residence"],
  "permanent-supportive-housing": [
    "Supportive Housing Residence",
    "Permanent Supportive Housing",
    "Supportive Housing",
  ],
  "subsidized-rental": [
    "Subsidized Rental Program",
    "Affordable Rental Program",
    "Subsidized Housing",
  ],
  "market-rate": ["Market-Rate Rental", "Private Rental Housing", "Rental Homes"],
};

const FALLBACK_PROGRAM_WORDS: readonly string[] = [
  "Housing Program",
  "Residency Program",
  "Housing Services",
];

const PROGRAM_PREFIXES = [
  "Northside",
  "Westgate",
  "Eastview",
  "Southbank",
  "Riverfront",
  "Hilltop",
  "Gateway",
  "Crosstown",
  "Station",
  "Fairmount",
] as const;

const APPLICATION_PROCESSES = [
  "Submit an application in person during intake hours.",
  "Call the intake line to schedule an application appointment.",
  "Complete a short referral form by phone, then visit for an interview.",
  "Ask the case manager to submit a referral by phone or email.",
] as const;

export function organizationName(rng: Rng): string {
  return `${pick(rng, ORGANIZATION_PREFIXES)} ${pick(rng, ORGANIZATION_CORES)}`;
}

export function organizationSlug(organization: string): string {
  return organization
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export interface ProviderContacts {
  phone?: string;
  email?: string;
  website?: string;
}

export function generateContacts(rng: Rng, organization: string): ProviderContacts {
  const slug = organizationSlug(organization);
  const contacts: ProviderContacts = {};
  if (chance(rng, 0.55)) {
    const digits = String(PHONE_POOL_START + Math.floor(rng() * PHONE_POOL_SIZE)).padStart(4, "0");
    contacts.phone = `${PHONE_PREFIX}${digits}`;
  }
  if (chance(rng, 0.6)) {
    contacts.website = `https://www.${slug}.example.org`;
  }
  if (chance(rng, 0.65)) {
    contacts.email = `contact@${slug}.example.org`;
  }
  return contacts;
}

export function programName(rng: Rng, housingType: string): string {
  const prefix = chance(rng, 0.5) ? `${pick(rng, PROGRAM_PREFIXES)} ` : "";
  const core = pick(rng, PROGRAM_TYPE_WORDS[housingType] ?? FALLBACK_PROGRAM_WORDS);
  return `${prefix}${core}`;
}

export function applicationProcess(rng: Rng): string {
  return pick(rng, APPLICATION_PROCESSES);
}
