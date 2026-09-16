import { parseS3ConfigText, parsedFieldCount } from './parseS3ConfigText';

describe('parseS3ConfigText', () => {
  it('parses the documented block', () => {
    expect(
      parseS3ConfigText(`
bucket: my-budget-backups
prefix: budget/
access_key_id: AKIAIOSFODNN7EXAMPLE
secret_access_key: wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
`),
    ).toEqual({
      bucket: 'my-budget-backups',
      keyPrefix: 'budget/',
      accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
      secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
    });
  });

  it('parses a .env-style block with export and quotes', () => {
    expect(
      parseS3ConfigText(`
export AWS_ACCESS_KEY_ID="AKIAIOSFODNN7EXAMPLE"
export AWS_SECRET_ACCESS_KEY='wJalrXUtnFEMI/K7MDENG'
S3_BUCKET=my-bucket
`),
    ).toEqual({
      accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
      secretAccessKey: 'wJalrXUtnFEMI/K7MDENG',
      bucket: 'my-bucket',
    });
  });

  it('accepts the camelCase and spaced spellings people actually write', () => {
    expect(parseS3ConfigText('Bucket : my-bucket\nAccess Key ID: AKIA\nSecret Key: shh')).toEqual({
      bucket: 'my-bucket',
      accessKeyId: 'AKIA',
      secretAccessKey: 'shh',
    });
  });

  it('keeps separators inside a secret', () => {
    // Base64 secrets contain '/' and '+', and a pasted line can contain ':'.
    const parsed = parseS3ConfigText('secret_access_key: abc:def=ghi/jkl+mno');
    expect(parsed.secretAccessKey).toBe('abc:def=ghi/jkl+mno');
  });

  it('strips a trailing comma from a JSON-ish paste', () => {
    expect(parseS3ConfigText('"bucket": "my-bucket",').bucket).toBe('my-bucket');
  });

  it('ignores comments, blank lines and keys it does not know', () => {
    expect(
      parseS3ConfigText(`
# my backup bucket
region: us-east-1
// note to self
endpoint: https://s3.example.com

bucket: my-bucket
`),
    ).toEqual({ bucket: 'my-bucket' });
  });

  it('ignores a key with an empty value rather than blanking the field', () => {
    expect(parseS3ConfigText('bucket:\nprefix: budget/')).toEqual({ keyPrefix: 'budget/' });
  });

  it('returns nothing for text that is not a config', () => {
    expect(parseS3ConfigText('')).toEqual({});
    expect(parseS3ConfigText('just some words about nothing')).toEqual({});
  });

  it('takes the last value when a key repeats', () => {
    expect(parseS3ConfigText('bucket: first\nbucket: second').bucket).toBe('second');
  });
});

describe('parsedFieldCount', () => {
  it('counts only the fields that got a value', () => {
    expect(parsedFieldCount({ bucket: 'b', accessKeyId: 'a' })).toBe(2);
    expect(parsedFieldCount({})).toBe(0);
  });
});
