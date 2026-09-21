import type { SQLiteDatabase } from '../../src/db/driver';

// House hunting: a shortlist of places being considered, and a hand-kept
// benchmark price per community to judge them against.
//
// Wide and mostly nullable on purpose. A listing is looked at once, from a
// phone, and whatever is known at that moment gets typed — a note that
// demands every field before it saves is a note nobody writes. Every
// qualitative column is free text for the same reason: "roof looks new,
// seller says 2019" is worth more than a number that pretends to be certain.
//
// Board-scoped like everything else, so a demo board or a second household
// keeps its own shortlist.
export async function up(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS houses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      board_id INTEGER NOT NULL REFERENCES boards(id),
      name TEXT NOT NULL,
      address TEXT,
      city TEXT,
      community TEXT,
      listing_url TEXT,
      status TEXT NOT NULL DEFAULT 'watching',
      rating INTEGER,
      viewed_on TEXT,

      asking_price_cents INTEGER,
      assessed_value_cents INTEGER,
      strata_fee_cents INTEGER,
      property_tax_annual_cents INTEGER,

      property_type TEXT,
      beds REAL,
      baths REAL,
      floor_area_sqft INTEGER,
      lot_sqft INTEGER,
      levels INTEGER,
      year_built INTEGER,
      parking TEXT,
      orientation TEXT,

      roof_age_years INTEGER,
      furnace_age_years INTEGER,
      water_tank_age_years INTEGER,
      windows TEXT,
      renovations TEXT,
      issues TEXT,

      school_catchment TEXT,
      commute_minutes INTEGER,
      transit TEXT,
      noise TEXT,
      neighbourhood TEXT,

      pros TEXT,
      cons TEXT,
      notes TEXT,

      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_houses_board ON houses(board_id, status);

    CREATE TABLE IF NOT EXISTS community_prices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      board_id INTEGER NOT NULL REFERENCES boards(id),
      city TEXT NOT NULL,
      community TEXT NOT NULL,
      property_type TEXT,
      as_of_month TEXT NOT NULL,
      benchmark_price_cents INTEGER NOT NULL,
      note TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_community_prices_board
      ON community_prices(board_id, city, community, as_of_month);
  `);
}
