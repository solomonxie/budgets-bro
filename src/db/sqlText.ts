// Splits a multi-statement SQL script into single statements.
//
// The driver underneath executes one statement per call, while migrations are
// written as one script each (see databases/migrations). Splitting on ";"
// alone would cut a trigger in half: its body is a BEGIN...END block full of
// them (migration 030 logs every table change that way), and semicolons also
// live inside string literals and comments.
export function splitStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = '';
  let blockDepth = 0; // BEGIN ... END nesting inside a trigger body

  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    const rest = sql.slice(i);

    if (ch === "'" || ch === '"' || ch === '`') {
      const end = endOfQuoted(sql, i, ch);
      current += sql.slice(i, end);
      i = end - 1;
      continue;
    }
    if (rest.startsWith('--')) {
      const end = sql.indexOf('\n', i);
      i = end === -1 ? sql.length : end;
      current += '\n';
      continue;
    }
    if (rest.startsWith('/*')) {
      const end = sql.indexOf('*/', i + 2);
      i = end === -1 ? sql.length : end + 1;
      current += ' ';
      continue;
    }

    const keyword = isWordChar(sql[i - 1]) ? null : wordAt(rest);
    if (keyword === 'BEGIN' && /\bTRIGGER\b/i.test(current)) blockDepth++;
    else if (keyword === 'END' && blockDepth > 0) blockDepth--;

    if (ch === ';' && blockDepth === 0) {
      push(statements, current);
      current = '';
      continue;
    }
    current += ch;
  }
  push(statements, current);
  return statements;
}

function push(statements: string[], statement: string): void {
  const trimmed = statement.trim();
  if (trimmed) statements.push(trimmed);
}

// Index just past the closing quote. A doubled quote ('' or "") is an escaped
// one, not the end.
function endOfQuoted(sql: string, start: number, quote: string): number {
  for (let i = start + 1; i < sql.length; i++) {
    if (sql[i] !== quote) continue;
    if (sql[i + 1] === quote) {
      i++;
      continue;
    }
    return i + 1;
  }
  return sql.length;
}

// The uppercased word at the cursor. Only read at a word start (the caller
// checks what precedes) and matched to its end, so neither "SUSPEND" nor
// "ENDING" is mistaken for "END".
function wordAt(rest: string): string | null {
  const match = /^[A-Za-z]+\b/.exec(rest);
  return match ? match[0].toUpperCase() : null;
}

function isWordChar(ch: string | undefined): boolean {
  return ch != null && /[A-Za-z0-9_]/.test(ch);
}
