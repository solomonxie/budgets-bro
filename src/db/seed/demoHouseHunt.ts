import type { HouseInput } from '../repositories/housesRepo';
import type { CommunityPriceInput } from '../repositories/communityPricesRepo';

const cents = (dollars: number) => Math.round(dollars * 100);

// Upsizing from Maple Street: a shortlist across three communities.
export function houseListings(months: string[]): Partial<HouseInput>[] {
  const recent = (back: number, d: number) => `${months[months.length - 1 - back]}-${String(d).padStart(2, '0')}`;
  return [
    {
      name: 'Craftsman on Napier St',
      address: '2148 Napier St',
      city: 'Burnaby',
      community: 'Burnaby Heights',
      status: 'offered',
      rating: 5,
      viewedOn: recent(1, 12),
      askingPriceCents: cents(1489000),
      assessedValueCents: cents(1412000),
      propertyTaxAnnualCents: cents(5120),
      propertyType: 'Detached',
      beds: 4,
      baths: 3,
      floorAreaSqft: 2180,
      lotSqft: 4026,
      levels: 2,
      yearBuilt: 1948,
      parking: 'Detached garage + lane',
      orientation: 'South-facing yard',
      roofAgeYears: 6,
      furnaceAgeYears: 11,
      waterTankAgeYears: 4,
      windows: 'Double-glazed vinyl',
      renovations: 'Kitchen 2019, main bath 2021',
      issues: 'Original drain tile — scope it',
      schoolCatchment: 'Alpha Secondary',
      commuteMinutes: 28,
      transit: 'R5 RapidBus, 4 min walk',
      noise: 'Quiet side street',
      neighbourhood: 'Hastings village shops and cafés',
      pros: 'Big yard, walkable, garage',
      cons: 'Older foundation',
      notes: 'Offer in at $1.46M subject to inspection.',
    },
    {
      name: 'Townhouse at The Grove',
      address: '37-7488 Southwynde Ave',
      city: 'Burnaby',
      community: 'Edmonds',
      status: 'shortlisted',
      rating: 4,
      viewedOn: recent(2, 6),
      askingPriceCents: cents(1149000),
      assessedValueCents: cents(1098000),
      strataFeeCents: cents(468),
      propertyTaxAnnualCents: cents(3380),
      propertyType: 'Townhouse',
      beds: 3,
      baths: 2.5,
      floorAreaSqft: 1640,
      levels: 3,
      yearBuilt: 2016,
      parking: '2 side-by-side',
      orientation: 'East',
      roofAgeYears: 9,
      furnaceAgeYears: 9,
      waterTankAgeYears: 9,
      schoolCatchment: 'Byrne Creek Secondary',
      commuteMinutes: 35,
      transit: 'Edmonds SkyTrain, 8 min walk',
      pros: 'Newer build, low maintenance',
      cons: 'Strata fee, small yard',
    },
    {
      name: 'Split-level near Como Lake',
      address: '1021 Gatensbury St',
      city: 'Coquitlam',
      community: 'Central Coquitlam',
      status: 'viewed',
      rating: 3,
      viewedOn: recent(3, 20),
      askingPriceCents: cents(1398000),
      assessedValueCents: cents(1364000),
      propertyTaxAnnualCents: cents(4610),
      propertyType: 'Detached',
      beds: 5,
      baths: 3,
      floorAreaSqft: 2650,
      lotSqft: 7200,
      levels: 2,
      yearBuilt: 1972,
      roofAgeYears: 18,
      furnaceAgeYears: 22,
      issues: 'Roof and furnace near end of life',
      commuteMinutes: 45,
      pros: 'Huge lot, suite potential',
      cons: 'Long commute, needs updates',
    },
    {
      name: 'Condo at Gilmore Place',
      city: 'Burnaby',
      community: 'Brentwood',
      status: 'watching',
      askingPriceCents: cents(989000),
      strataFeeCents: cents(612),
      propertyType: 'Apartment',
      beds: 3,
      baths: 2,
      floorAreaSqft: 1120,
      yearBuilt: 2023,
    },
    {
      name: 'Bungalow on Sperling Ave',
      city: 'Burnaby',
      community: 'Burnaby Heights',
      status: 'rejected',
      rating: 2,
      viewedOn: recent(4, 15),
      askingPriceCents: cents(1325000),
      propertyType: 'Detached',
      beds: 3,
      baths: 1,
      floorAreaSqft: 1450,
      yearBuilt: 1955,
      cons: 'On a busy arterial, one bathroom',
    },
  ];
}

// Quarterly MLS-style benchmarks, two years back.
export function communityBenchmarks(months: string[]): CommunityPriceInput[] {
  const series: [string, string, string, number, number[]][] = [
    ['Burnaby', 'Burnaby Heights', 'Detached', 1880000, [0, 1.2, 2.1, 0.4, -0.8, 0.6, 1.5, 0.9]],
    ['Burnaby', 'Edmonds', 'Townhouse', 1080000, [0, 0.8, 1.6, 0.2, -1.1, 0.3, 1.0, 0.7]],
    ['Coquitlam', 'Central Coquitlam', 'Detached', 1610000, [0, 1.0, 1.4, -0.3, -1.5, -0.2, 0.8, 0.5]],
  ];
  const out: CommunityPriceInput[] = [];
  for (const [city, community, propertyType, start, changes] of series) {
    let price = start;
    changes.forEach((pct, q) => {
      price *= 1 + pct / 100;
      out.push({
        city,
        community,
        propertyType,
        asOfMonth: months[Math.min(months.length - 1, q * 3 + 2)],
        benchmarkPriceCents: cents(Math.round(price / 100) * 100),
        note: null,
      });
    });
  }
  return out;
}
