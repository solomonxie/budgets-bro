import { splitStatements } from './sqlText';

describe('splitStatements', () => {
  it('splits plain statements and drops the blank tail', () => {
    expect(splitStatements('CREATE TABLE a (id INT);\nCREATE INDEX i ON a (id);\n')).toEqual([
      'CREATE TABLE a (id INT)',
      'CREATE INDEX i ON a (id)',
    ]);
  });

  it('keeps a trigger body whole — its BEGIN...END is full of semicolons', () => {
    const sql = `
      CREATE TRIGGER trg_log AFTER INSERT ON accounts BEGIN
        INSERT INTO change_log (t) VALUES ('accounts');
        UPDATE meta SET dirty = 1;
      END;
      CREATE INDEX idx ON accounts (id);
    `;
    const out = splitStatements(sql);
    expect(out).toHaveLength(2);
    expect(out[0]).toContain('INSERT INTO change_log');
    expect(out[0]).toContain('UPDATE meta SET dirty = 1');
    expect(out[0].endsWith('END')).toBe(true);
    expect(out[1]).toBe('CREATE INDEX idx ON accounts (id)');
  });

  it('ignores semicolons inside string literals, including escaped quotes', () => {
    const out = splitStatements("INSERT INTO t (s) VALUES ('a;b'';c'); SELECT 1;");
    expect(out).toEqual(["INSERT INTO t (s) VALUES ('a;b'';c')", 'SELECT 1']);
  });

  it('ignores semicolons in line and block comments', () => {
    const out = splitStatements('SELECT 1; -- trailing; note\n/* block; note */ SELECT 2;');
    expect(out).toEqual(['SELECT 1', 'SELECT 2']);
  });

  it('does not read END out of a longer word', () => {
    const out = splitStatements(
      'CREATE TRIGGER t AFTER UPDATE ON a BEGIN UPDATE b SET suspend = 1; END; SELECT 1;',
    );
    expect(out).toHaveLength(2);
    expect(out[0]).toContain('suspend = 1');
  });

  it('returns nothing for an empty or comment-only script', () => {
    expect(splitStatements('   \n -- nothing\n')).toEqual([]);
  });
});
