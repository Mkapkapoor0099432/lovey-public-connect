// Same order as the category list in src/strings.phase1.json
export const CATEGORY_SLUGS = ["drug_addiction","theft_robbery","roads","street_lights","garbage_sanitation","sewerage_drainage","drinking_water","electricity","public_safety","women_safety","traffic_parking","govt_school","govt_hospital","public_parks","encroachment","corruption","stray_animals","other"] as const;
export type CategorySlug = (typeof CATEGORY_SLUGS)[number];
// TODO(Manik): verify against the official Ludhiana MC ward list, or limit to pilot wards.
export const WARDS: string[] = Array.from({ length: 95 }, (_, i) => String(i + 1));
export const WARD_UNKNOWN = "unknown";
export const LIMITS = { name: [2, 80], area: [2, 80], subject: [3, 120], description: [10, 3000] } as const;
export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const PHOTO_TYPES = ["image/jpeg", "image/png"];
export const DOC_TYPES = ["application/pdf"];
export const MOBILE_RE = /^[6-9]\d{9}$/;
