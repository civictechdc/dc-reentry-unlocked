import type {
  Gender,
  HousingType,
  LengthOfStay,
  PolicyState,
  Population,
} from "@dc-reentry/shared";
import { m } from "#lib/paraglide/messages.js";

/**
 * Flexible value labels for program taxonomy fields inside the detail
 * panel: unknown renders the honest "not publicly listed" message, the
 * other taxonomy values resolve through their own message keys. No display
 * string is hardcoded here.
 */
const taxonomyMessages: Record<string, string> = {
  "emergency-shelter": m.taxonomy_housing_emergency_shelter(),
  transitional: m.taxonomy_housing_transitional(),
  "permanent-supportive-housing": m.taxonomy_housing_permanent_supportive(),
  "subsidized-rental": m.taxonomy_housing_subsidized_rental(),
  "market-rate": m.taxonomy_housing_market_rate(),
  "emergency-nightly": m.taxonomy_length_emergency_nightly(),
  "short-term-up-to-90-days": m.taxonomy_length_short_term(),
  "transitional-up-to-24-months": m.taxonomy_length_transitional_24(),
  "permanent-open-ended": m.taxonomy_length_permanent(),
  individuals: m.taxonomy_population_individuals(),
  families: m.taxonomy_population_families(),
  both: m.taxonomy_population_both(),
  men: m.taxonomy_gender_men(),
  women: m.taxonomy_gender_women(),
  all: m.taxonomy_gender_all(),
};

const roomTypeMessages: Record<string, string> = {
  "private-room": m.card_room_type_private_room(),
  "shared-room": m.card_room_type_shared_room(),
  efficiency: m.card_room_type_efficiency(),
  apartment: m.card_room_type_apartment(),
};

/** Room type alongside square footage (detail "size" context); unknown stays honest. */
export function roomTypeDetailLabel(roomType: string): string {
  return roomTypeMessages[roomType] ?? m.detail_value_unknown();
}

/**
 * Bedrooms value vocabulary: two (bedrooms, room type) pairs present as
 * vocabulary instead of a number — a zero-bedroom efficiency presents as
 * "Studio" and a zero-bedroom shared-room presents as "Bed available";
 * every other pair keeps the surface's numeric bedroom count. Bedrooms
 * stay 0 in the data — this mapping is presentation only.
 */
function isStudioPresentation(bedrooms: number, roomType: string): boolean {
  return bedrooms === 0 && roomType === "efficiency";
}

function isBedAvailabilityPresentation(bedrooms: number, roomType: string): boolean {
  return bedrooms === 0 && roomType === "shared-room";
}

export function cardBedroomsValue(bedrooms: number, roomType: string): string {
  if (isStudioPresentation(bedrooms, roomType)) return m.bedrooms_value_studio();
  if (isBedAvailabilityPresentation(bedrooms, roomType)) return m.bedrooms_value_bed_available();
  return m.card_bedrooms({ bedrooms });
}

export function detailBedroomsValue(bedrooms: number, roomType: string): string {
  if (isStudioPresentation(bedrooms, roomType)) return m.bedrooms_value_studio();
  if (isBedAvailabilityPresentation(bedrooms, roomType)) return m.bedrooms_value_bed_available();
  return m.detail_bedrooms_value({ bedrooms });
}

export function detailValueLabel(
  value: PolicyState | HousingType | LengthOfStay | Population | Gender,
): string {
  if (value === "unknown") return m.detail_value_unknown();
  if (value === "yes") return m.detail_value_yes();
  if (value === "no") return m.detail_value_no();
  return taxonomyMessages[value] ?? m.detail_value_unknown();
}
