import { newestFirst, openCount, parseFeedback, withAdded, withRemoved, withStatus } from './feedbackLog';

jest.mock('../files/fileStore', () => ({ documentDir: '/docs', joinPath: (...p: string[]) => p.join('/') }));

describe('feedbackLog', () => {
  it('treats a missing file as empty', () => {
    expect(parseFeedback(null)).toEqual({ version: 1, items: [] });
  });

  it('preserves unknown fields through edits', () => {
    const file = parseFeedback(
      JSON.stringify({
        version: 1,
        extra: 'keep',
        items: [{ id: 'a', text: 't', status: 'open', createdAt: 'x', updatedAt: 'x', note: 'n', tag: 7 }],
      }),
    );
    const next = withStatus(file, 'a', 'done', new Date('2026-01-01T00:00:00Z'));
    expect(next.extra).toBe('keep');
    expect(next.items[0]).toMatchObject({ status: 'done', note: 'n', tag: 7, updatedAt: '2026-01-01T00:00:00.000Z' });
  });

  it('adds, counts, orders and removes', () => {
    let file = withAdded(parseFeedback(null), 'first', new Date('2026-01-01T00:00:00Z'));
    file = withAdded(file, 'second', new Date('2026-01-02T00:00:00Z'));
    expect(openCount(file.items)).toBe(2);
    expect(newestFirst(file.items).map((i) => i.text)).toEqual(['second', 'first']);
    expect(withRemoved(file, file.items[0].id).items.map((i) => i.text)).toEqual(['second']);
  });
});
