import type { SQLiteDatabase } from '../../src/db/driver';

// Homes: what tells one house from another beyond its price — upkeep, and
// how far it is to the bus, the train, a school and groceries — plus the
// offer stage and its deadlines, a viewing checklist, when a listing went
// up, and each asking-price change, so a price drop and days on market can
// be read rather than remembered. Distances are metres.
//
// The checklist is one TEXT column of `item=ok|concern` pairs, like
// purchase_items: only ever read whole, with the row.
export async function up(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    ALTER TABLE houses ADD COLUMN listed_on TEXT;
    ALTER TABLE houses ADD COLUMN offer_price_cents INTEGER;
    ALTER TABLE houses ADD COLUMN deposit_cents INTEGER;
    ALTER TABLE houses ADD COLUMN subject_removal_date TEXT;
    ALTER TABLE houses ADD COLUMN completion_date TEXT;
    ALTER TABLE houses ADD COLUMN checklist TEXT;
    ALTER TABLE houses ADD COLUMN maintenance_monthly_cents INTEGER;
    ALTER TABLE houses ADD COLUMN bus_distance_m INTEGER;
    ALTER TABLE houses ADD COLUMN train_distance_m INTEGER;
    ALTER TABLE houses ADD COLUMN school_distance_m INTEGER;
    ALTER TABLE houses ADD COLUMN grocery_distance_m INTEGER;

    CREATE TABLE IF NOT EXISTS house_prices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      house_id INTEGER NOT NULL REFERENCES houses(id),
      date TEXT NOT NULL,
      price_cents INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_house_prices_house
      ON house_prices(house_id, date);

    INSERT INTO house_prices (house_id, date, price_cents)
      SELECT id, substr(created_at, 1, 10), asking_price_cents
      FROM houses WHERE asking_price_cents IS NOT NULL;
  `);
}
