import {
  Clock,
  beyondSegment,
  compare,
  format,
  offsetFromDate,
  parse,
  parseStamp,
  stamp,
  tick,
  tooFarAhead,
  zero,
} from './clock';

describe('hlc', () => {
  it('formats fixed width and round-trips', () => {
    const h = { wall: 1793414025123, counter: 3 };
    expect(format(h)).toBe('1793414025123-0003');
    expect(parse(format(h))).toEqual(h);
    expect(format({ wall: 5, counter: 0 })).toBe('0000000000005-0000');
  });

  it('string order matches compare', () => {
    const hs = [
      { wall: 2, counter: 0 },
      { wall: 1, counter: 12 },
      { wall: 1, counter: 2 },
      { wall: 10, counter: 0 },
    ];
    const byString = [...hs].sort((a, b) => (format(a) < format(b) ? -1 : 1));
    expect(byString).toEqual([...hs].sort(compare));
  });

  it('tick takes the wall when it moved forward, else bumps the counter', () => {
    expect(tick(zero, 100)).toEqual({ wall: 100, counter: 0 });
    expect(tick({ wall: 100, counter: 0 }, 100)).toEqual({ wall: 100, counter: 1 });
    expect(tick({ wall: 100, counter: 4 }, 50)).toEqual({ wall: 100, counter: 5 });
  });

  it('tick moves the wall on when the counter would overflow four digits', () => {
    expect(tick({ wall: 100, counter: 9999 }, 100)).toEqual({ wall: 101, counter: 0 });
  });

  it('stamps sort by hlc, then device', () => {
    const a = stamp({ wall: 1, counter: 0 }, 'b');
    const b = stamp('0000000000001-0000', 'c');
    expect(a < b).toBe(true);
    expect(parseStamp(a)).toEqual({ hlc: { wall: 1, counter: 0 }, device: 'b' });
  });

  it('bounds', () => {
    expect(beyondSegment({ wall: 3_600_001, counter: 0 }, 0)).toBe(true);
    expect(beyondSegment({ wall: 3_600_000, counter: 0 }, 0)).toBe(false);
    expect(tooFarAhead({ wall: 86_400_001, counter: 0 }, 0)).toBe(true);
    expect(tooFarAhead({ wall: 86_400_000, counter: 0 }, 0)).toBe(false);
  });

  it('offset from a Date header', () => {
    const local = Date.parse('Fri, 06 Nov 2026 10:00:00 GMT');
    expect(offsetFromDate('Fri, 06 Nov 2026 10:00:05 GMT', local)).toBe(5000);
    expect(offsetFromDate(null, local)).toBeNull();
    expect(offsetFromDate('garbage', local)).toBeNull();
  });
});

describe('Clock', () => {
  it('stamps in bucket time and stays ahead of what it saw', () => {
    let now = Date.parse('Fri, 06 Nov 2026 10:00:00 GMT');
    const clock = new Clock(zero, () => now);
    clock.observeDate('Fri, 06 Nov 2026 10:00:02 GMT');
    expect(clock.tick()).toEqual({ wall: now + 2000, counter: 0 });

    clock.receive({ wall: now + 9000, counter: 7 });
    expect(clock.tick()).toEqual({ wall: now + 9000, counter: 8 });

    now += 60_000;
    expect(clock.tick()).toEqual({ wall: now + 2000, counter: 0 });
  });

  it('keeps the last offset when a response has no Date', () => {
    const clock = new Clock(zero, () => 1000);
    clock.observeDate(new Date(4000).toUTCString());
    clock.observeDate(null);
    expect(clock.offset).toBe(3000);
  });
});
