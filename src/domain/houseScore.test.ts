import { emptyHouse } from '../db/repositories/housesRepo';
import type { House } from '../db/repositories/housesRepo';
import { houseMetrics } from './houseMetrics';
import { scoreHouses } from './houseScore';
import { checklistConcerns, cycleMark } from './houseChecklist';

const house = (id: number, o: Partial<House>): House => ({
  id,
  ...emptyHouse(),
  ...o,
});
const entry = (h: House) => ({
  house: h,
  metrics: houseMetrics(h, { todayIso: '2026-10-22' }),
});

describe('scoreHouses', () => {
  it('ranks by the weighted criteria, best 100, worst 0', () => {
    const cheapSmall = house(1, {
      askingPriceCents: 80_000_000,
      floorAreaSqft: 1000,
    });
    const dearBig = house(2, {
      askingPriceCents: 100_000_000,
      floorAreaSqft: 2000,
    });
    const byPrice = scoreHouses([entry(cheapSmall), entry(dearBig)], {
      price: 1,
    });
    expect(byPrice.get(1)).toBe(100);
    expect(byPrice.get(2)).toBe(0);
    const bySpace = scoreHouses([entry(cheapSmall), entry(dearBig)], {
      price: 1,
      space: 3,
    });
    expect(bySpace.get(2)).toBe(75);
  });

  it('leaves a house out of a criterion it says nothing about', () => {
    const scores = scoreHouses(
      [entry(house(1, {})), entry(house(2, { rating: 4 }))],
      { rating: 1 },
    );
    expect(scores.get(1)).toBeNull();
    expect(scores.get(2)).toBe(100);
  });
});

describe('checklist', () => {
  it('cycles unchecked, fine, concern', () => {
    let s = cycleMark(null, 'roof');
    expect(s).toBe('roof=ok');
    s = cycleMark(s, 'roof');
    expect(checklistConcerns(s)).toBe(1);
    expect(cycleMark(s, 'roof')).toBeNull();
  });
});
