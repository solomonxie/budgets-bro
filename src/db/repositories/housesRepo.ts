import type { SQLiteDatabase } from '../../db/driver';
import type { HouseRow } from '../schema';

export type HouseStatus =
  | 'watching'
  | 'viewed'
  | 'shortlisted'
  | 'offered'
  | 'rejected';

export const HOUSE_STATUSES: HouseStatus[] = [
  'watching',
  'viewed',
  'shortlisted',
  'offered',
  'rejected',
];

export interface House {
  id: number;
  name: string;
  address: string | null;
  city: string | null;
  community: string | null;
  listingUrl: string | null;
  status: HouseStatus;
  rating: number | null;
  viewedOn: string | null;
  askingPriceCents: number | null;
  assessedValueCents: number | null;
  strataFeeCents: number | null;
  propertyTaxAnnualCents: number | null;
  propertyType: string | null;
  beds: number | null;
  baths: number | null;
  floorAreaSqft: number | null;
  lotSqft: number | null;
  levels: number | null;
  yearBuilt: number | null;
  parking: string | null;
  orientation: string | null;
  roofAgeYears: number | null;
  furnaceAgeYears: number | null;
  waterTankAgeYears: number | null;
  windows: string | null;
  renovations: string | null;
  issues: string | null;
  schoolCatchment: string | null;
  commuteMinutes: number | null;
  transit: string | null;
  noise: string | null;
  neighbourhood: string | null;
  pros: string | null;
  cons: string | null;
  notes: string | null;
}

export type HouseInput = Omit<House, 'id'>;

function mapRow(row: HouseRow): House {
  return {
    id: row.id,
    name: row.name,
    address: row.address,
    city: row.city,
    community: row.community,
    listingUrl: row.listing_url,
    status: (row.status as HouseStatus) ?? 'watching',
    rating: row.rating,
    viewedOn: row.viewed_on,
    askingPriceCents: row.asking_price_cents,
    assessedValueCents: row.assessed_value_cents,
    strataFeeCents: row.strata_fee_cents,
    propertyTaxAnnualCents: row.property_tax_annual_cents,
    propertyType: row.property_type,
    beds: row.beds,
    baths: row.baths,
    floorAreaSqft: row.floor_area_sqft,
    lotSqft: row.lot_sqft,
    levels: row.levels,
    yearBuilt: row.year_built,
    parking: row.parking,
    orientation: row.orientation,
    roofAgeYears: row.roof_age_years,
    furnaceAgeYears: row.furnace_age_years,
    waterTankAgeYears: row.water_tank_age_years,
    windows: row.windows,
    renovations: row.renovations,
    issues: row.issues,
    schoolCatchment: row.school_catchment,
    commuteMinutes: row.commute_minutes,
    transit: row.transit,
    noise: row.noise,
    neighbourhood: row.neighbourhood,
    pros: row.pros,
    cons: row.cons,
    notes: row.notes,
  };
}

// Column order is shared by insert and update so the two can't drift apart —
// the one bug a table this wide invites.
const COLUMNS = [
  'name',
  'address',
  'city',
  'community',
  'listing_url',
  'status',
  'rating',
  'viewed_on',
  'asking_price_cents',
  'assessed_value_cents',
  'strata_fee_cents',
  'property_tax_annual_cents',
  'property_type',
  'beds',
  'baths',
  'floor_area_sqft',
  'lot_sqft',
  'levels',
  'year_built',
  'parking',
  'orientation',
  'roof_age_years',
  'furnace_age_years',
  'water_tank_age_years',
  'windows',
  'renovations',
  'issues',
  'school_catchment',
  'commute_minutes',
  'transit',
  'noise',
  'neighbourhood',
  'pros',
  'cons',
  'notes',
] as const;

function values(input: HouseInput): unknown[] {
  return [
    input.name,
    input.address,
    input.city,
    input.community,
    input.listingUrl,
    input.status,
    input.rating,
    input.viewedOn,
    input.askingPriceCents,
    input.assessedValueCents,
    input.strataFeeCents,
    input.propertyTaxAnnualCents,
    input.propertyType,
    input.beds,
    input.baths,
    input.floorAreaSqft,
    input.lotSqft,
    input.levels,
    input.yearBuilt,
    input.parking,
    input.orientation,
    input.roofAgeYears,
    input.furnaceAgeYears,
    input.waterTankAgeYears,
    input.windows,
    input.renovations,
    input.issues,
    input.schoolCatchment,
    input.commuteMinutes,
    input.transit,
    input.noise,
    input.neighbourhood,
    input.pros,
    input.cons,
    input.notes,
  ];
}

export function emptyHouse(): HouseInput {
  return {
    name: '',
    address: null,
    city: null,
    community: null,
    listingUrl: null,
    status: 'watching',
    rating: null,
    viewedOn: null,
    askingPriceCents: null,
    assessedValueCents: null,
    strataFeeCents: null,
    propertyTaxAnnualCents: null,
    propertyType: null,
    beds: null,
    baths: null,
    floorAreaSqft: null,
    lotSqft: null,
    levels: null,
    yearBuilt: null,
    parking: null,
    orientation: null,
    roofAgeYears: null,
    furnaceAgeYears: null,
    waterTankAgeYears: null,
    windows: null,
    renovations: null,
    issues: null,
    schoolCatchment: null,
    commuteMinutes: null,
    transit: null,
    noise: null,
    neighbourhood: null,
    pros: null,
    cons: null,
    notes: null,
  };
}

export async function listHouses(
  db: SQLiteDatabase,
  boardId: number,
): Promise<House[]> {
  const rows = await db.getAllAsync<HouseRow>(
    `SELECT * FROM houses WHERE board_id = ?
     ORDER BY CASE status
       WHEN 'offered' THEN 0
       WHEN 'shortlisted' THEN 1
       WHEN 'viewed' THEN 2
       WHEN 'watching' THEN 3
       ELSE 4 END,
       COALESCE(rating, 0) DESC, name`,
    boardId,
  );
  return rows.map(mapRow);
}

export async function getHouse(
  db: SQLiteDatabase,
  id: number,
): Promise<House | null> {
  const row = await db.getFirstAsync<HouseRow>(
    'SELECT * FROM houses WHERE id = ?',
    id,
  );
  return row ? mapRow(row) : null;
}

export async function createHouse(
  db: SQLiteDatabase,
  boardId: number,
  input: HouseInput,
): Promise<number> {
  const placeholders = COLUMNS.map(() => '?').join(', ');
  const result = await db.runAsync(
    `INSERT INTO houses (board_id, ${COLUMNS.join(', ')})
     VALUES (?, ${placeholders})`,
    boardId,
    ...(values(input) as (string | number | null)[]),
  );
  return result.lastInsertRowId;
}

export async function updateHouse(
  db: SQLiteDatabase,
  id: number,
  input: HouseInput,
): Promise<void> {
  const assignments = COLUMNS.map((c) => `${c} = ?`).join(', ');
  await db.runAsync(
    `UPDATE houses SET ${assignments}, updated_at = datetime('now') WHERE id = ?`,
    ...(values(input) as (string | number | null)[]),
    id,
  );
}

export async function deleteHouse(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync('DELETE FROM houses WHERE id = ?', id);
}
