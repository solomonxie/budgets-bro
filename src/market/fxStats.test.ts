import { convertCents, downsample, fxStats, sliceRecent } from './fxStats';

const series = [
  { date: '2024-01-01', rate: 5.0 },
  { date: '2024-02-01', rate: 5.5 },
  { date: '2024-03-01', rate: 4.5 },
  { date: '2024-04-01', rate: 5.2 },
];

describe('fxStats', () => {
  it('reads the extremes, the average and the move across the window', () => {
    const stats = fxStats(series);
    expect(stats.latest?.rate).toBe(5.2);
    expect(stats.high?.date).toBe('2024-02-01');
    expect(stats.low?.date).toBe('2024-03-01');
    expect(stats.averageRate).toBeCloseTo(5.05, 5);
    expect(stats.changeFraction).toBeCloseTo(0.04, 5);
  });

  it('says nothing rather than zero for an empty series', () => {
    expect(fxStats([]).latest).toBeNull();
  });
});

describe('sliceRecent', () => {
  it('counts back from the last published date, not from today', () => {
    expect(sliceRecent(series, 45).map((p) => p.date)).toEqual([
      '2024-03-01',
      '2024-04-01',
    ]);
  });
});

describe('downsample', () => {
  it('keeps both ends and thins the middle', () => {
    const many = Array.from({ length: 1000 }, (_, i) => ({
      date: `d${i}`,
      rate: i,
    }));
    const thinned = downsample(many, 10);
    expect(thinned).toHaveLength(10);
    expect(thinned[0]).toEqual(many[0]);
    expect(thinned[9]).toEqual(many[999]);
  });

  it('leaves a short series alone', () => {
    expect(downsample(series, 100)).toHaveLength(4);
  });
});

describe('convertCents', () => {
  it('rounds to the cent of the target currency', () => {
    expect(convertCents(10_000, 5.123)).toBe(51_230);
  });
});
