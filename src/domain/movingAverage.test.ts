import { trailingAverages } from './movingAverage';

describe('trailingAverages', () => {
  it('averages the 12 months ending with each point', () => {
    const points = Array.from({ length: 14 }, (_, i) => ({
      date: `${2025 + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`,
      value: i + 1,
    }));
    const avgs = trailingAverages(points);
    expect(avgs[0]).toBe(1);
    expect(avgs[11]).toBe(6.5);
    expect(avgs[13]).toBe(8.5);
  });

  it('windows by calendar month, not by count', () => {
    const avgs = trailingAverages([
      { date: '2024-01-05', value: 100 },
      { date: '2025-01-10', value: 10 },
      { date: '2025-01-20', value: 20 },
    ]);
    expect(avgs).toEqual([100, 10, 15]);
  });

  it('can leave the point itself out, and skips nulls', () => {
    const avgs = trailingAverages(
      [
        { date: '2025-01', value: 4 },
        { date: '2025-02', value: null },
        { date: '2025-03', value: 8 },
      ],
      { includeSelf: false },
    );
    expect(avgs).toEqual([null, 4, 4]);
  });
});
