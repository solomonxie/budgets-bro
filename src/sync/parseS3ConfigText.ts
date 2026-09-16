export interface ParsedS3Config {
  bucket?: string;
  keyPrefix?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
}

// Typing a 40-character secret on a phone keyboard is miserable and
// error-prone, so the config sheet takes a pasted block instead. People paste
// from wherever they keep it — a password manager note, a .env file, the
// output of `aws configure get` — so the shapes vary more than any one format
// worth insisting on:
//
//   bucket: my-bucket          AWS_ACCESS_KEY_ID=AKIA...
//   prefix: budget/            export AWS_SECRET_ACCESS_KEY="wJal..."
//
// Unknown keys are ignored rather than rejected, `region` among them — it's
// auto-detected by testS3Connection, which is more reliable than whatever is
// in the note.
const ALIASES: Record<string, keyof ParsedS3Config> = {
  bucket: 'bucket',
  bucketname: 'bucket',
  s3bucket: 'bucket',
  awsbucket: 'bucket',
  awss3bucket: 'bucket',

  prefix: 'keyPrefix',
  keyprefix: 'keyPrefix',
  s3prefix: 'keyPrefix',
  path: 'keyPrefix',
  folder: 'keyPrefix',

  accesskeyid: 'accessKeyId',
  accesskey: 'accessKeyId',
  awsaccesskeyid: 'accessKeyId',
  keyid: 'accessKeyId',

  secretaccesskey: 'secretAccessKey',
  secretkey: 'secretAccessKey',
  secret: 'secretAccessKey',
  awssecretaccesskey: 'secretAccessKey',
};

function normalizeKey(raw: string): string {
  return raw.replace(/^export\s+/i, '').replace(/[^a-z0-9]/gi, '').toLowerCase();
}

function cleanValue(raw: string): string {
  return raw
    .trim()
    .replace(/,$/, '')
    .replace(/^["']|["']$/g, '')
    .trim();
}

export function parseS3ConfigText(text: string): ParsedS3Config {
  const parsed: ParsedS3Config = {};
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('//')) continue;
    // First separator only — a secret can legitimately contain ':' or '='.
    const match = trimmed.match(/^([^:=]+)[:=]([\s\S]*)$/);
    if (!match) continue;
    const field = ALIASES[normalizeKey(match[1])];
    if (!field) continue;
    const value = cleanValue(match[2]);
    if (value) parsed[field] = value;
  }
  return parsed;
}

export function parsedFieldCount(parsed: ParsedS3Config): number {
  return Object.values(parsed).filter(Boolean).length;
}
