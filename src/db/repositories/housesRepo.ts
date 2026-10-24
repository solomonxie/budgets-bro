import type { SQLiteDatabase } from '../../db/driver';
import type { HousePriceRow, HouseRow } from '../schema';

export type HouseStatus =
  | 'watching'
  | 'viewed'
  | 'shortlisted'
  | 'offered'
  | 'bought'
  | 'sold'
  | 'rejected';

export const HOUSE_STATUSES: HouseStatus[] = [
  'watching',
  'viewed',
  'shortlisted',
  'offered',
  'bought',
  'sold',
  'rejected',
];

/** Done with: sold to someone else, or ruled out. Folded on the list. */
export const ARCHIVED_STATUSES: HouseStatus[] = ['sold', 'rejected'];

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
  listedOn: string | null;
  offerPriceCents: number | null;
  depositCents: number | null;
  subjectRemovalDate: string | null;
  completionDate: string | null;
  /** `item=ok|concern` pairs; see domain/houseChecklist. */
  checklist: string | null;
  maintenanceMonthlyCents: number | null;
  busDistanceM: number | null;
  trainDistanceM: number | null;
  schoolDistanceM: number | null;
  groceryDistanceM: number | null;
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
    listedOn: row.listed_on,
    offerPriceCents: row.offer_price_cents,
    depositCents: row.deposit_cents,
    subjectRemovalDate: row.subject_removal_date,
    completionDate: row.completion_date,
    checklist: row.checklist,
    maintenanceMonthlyCents: row.maintenance_monthly_cents,
    busDistanceM: row.bus_distance_m,
    trainDistanceM: row.train_distance_m,
    schoolDistanceM: row.school_distance_m,
    groceryDistanceM: row.grocery_distance_m,
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
  'listed_on',
  'offer_price_cents',
  'deposit_cents',
  'subject_removal_date',
  'completion_date',
  'checklist',
  'maintenance_monthly_cents',
  'bus_distance_m',
  'train_distance_m',
  'school_distance_m',
  'grocery_distance_m',
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
    input.listedOn,
    input.offerPriceCents,
    input.depositCents,
    input.subjectRemovalDate,
    input.completionDate,
    input.checklist,
    input.maintenanceMonthlyCents,
    input.busDistanceM,
    input.trainDistanceM,
    input.schoolDistanceM,
    input.groceryDistanceM,
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
    listedOn: null,
    offerPriceCents: null,
    depositCents: null,
    subjectRemovalDate: null,
    completionDate: null,
    checklist: null,
    maintenanceMonthlyCents: null,
    busDistanceM: null,
    trainDistanceM: null,
    schoolDistanceM: null,
    groceryDistanceM: null,
  };
}

export async function listHouses(
  db: SQLiteDatabase,
  boardId: number,
): Promise<House[]> {
  const rows = await db.getAllAsync<HouseRow>(
    `SELECT * FROM houses WHERE board_id = ?
     ORDER BY CASE status
       WHEN 'bought' THEN 0
       WHEN 'offered' THEN 1
       WHEN 'shortlisted' THEN 2
       WHEN 'viewed' THEN 3
       WHEN 'watching' THEN 4
       ELSE 5 END,
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

export async function deleteHouse(
  db: SQLiteDatabase,
  id: number,
): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM house_prices WHERE house_id = ?', id);
    await db.runAsync('DELETE FROM houses WHERE id = ?', id);
  });
}

export interface HousePrice {
  id: number;
  houseId: number;
  date: string;
  priceCents: number;
}

/** Every asking price on file for the board's houses, oldest first. */
export async function listHousePrices(
  db: SQLiteDatabase,
  boardId: number,
): Promise<HousePrice[]> {
  const rows = await db.getAllAsync<HousePriceRow>(
    `SELECT p.* FROM house_prices p JOIN houses h ON h.id = p.house_id
     WHERE h.board_id = ? ORDER BY p.house_id, p.date, p.id`,
    boardId,
  );
  return rows.map((r) => ({
    id: r.id,
    houseId: r.house_id,
    date: r.date,
    priceCents: r.price_cents,
  }));
}

// A new asking price is logged once per day: a correction typed the same
// day replaces that day's entry rather than reading as a price change.
export async function logHousePrice(
  db: SQLiteDatabase,
  houseId: number,
  date: string,
  priceCents: number,
): Promise<void> {
  const last = await db.getFirstAsync<HousePriceRow>(
    'SELECT * FROM house_prices WHERE house_id = ? ORDER BY date DESC, id DESC LIMIT 1',
    houseId,
  );
  if (last?.price_cents === priceCents) return;
  if (last?.date === date)
    await db.runAsync(
      'UPDATE house_prices SET price_cents = ? WHERE id = ?',
      priceCents,
      last.id,
    );
  else
    await db.runAsync(
      'INSERT INTO house_prices (house_id, date, price_cents) VALUES (?, ?, ?)',
      houseId,
      date,
      priceCents,
    );
}

export async function deleteHousePrice(
  db: SQLiteDatabase,
  id: number,
): Promise<void> {
  await db.runAsync('DELETE FROM house_prices WHERE id = ?', id);
}
