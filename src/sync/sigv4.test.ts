import { signS3Request } from './sigv4';

// Every expectation here was produced by AWS's own signer
// (@smithy/signature-v4 + @aws-crypto/sha256-js) signing the same request,
// before that dependency was removed — so this checks the hand-rolled chain
// against AWS's output rather than against itself. Regenerating them means
// reinstalling that package and diffing again, not editing the strings.
const CREDENTIALS = {
  accessKeyId: 'AKIDEXAMPLE',
  secretAccessKey: 'wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY',
  region: 'ap-southeast-2',
  bucket: 'budgets-bro-test',
};
const SIGNING_DATE = new Date('2026-09-19T01:58:00Z');

const CASES: {
  name: string;
  method: string;
  objectKey: string;
  query: Record<string, string>;
  body: number[] | null;
  authorization: string;
  contentSha: string;
  url: string;
}[] = [
    {
      "name": "GET bucket root",
      "method": "GET",
      "objectKey": "",
      "query": {
        "x-budgetsbro-nonce": "abc123"
      },
      "body": null,
      "authorization": "AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE/20260919/ap-southeast-2/s3/aws4_request, SignedHeaders=host;x-amz-content-sha256;x-amz-date, Signature=e8e8db5db4caf7171e635a42ceb1a61177c1a177964f733f0f2fe803e5b2ba45",
      "contentSha": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      "url": "https://budgets-bro-test.s3.ap-southeast-2.amazonaws.com/?x-budgetsbro-nonce=abc123"
    },
    {
      "name": "PUT object",
      "method": "PUT",
      "objectKey": "1/latest.zip",
      "query": {
        "x-budgetsbro-nonce": "zz9"
      },
      "body": [
        1,
        2,
        3,
        4,
        5
      ],
      "authorization": "AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE/20260919/ap-southeast-2/s3/aws4_request, SignedHeaders=host;x-amz-content-sha256;x-amz-date, Signature=82b660059954415d1a51f3b42fa5ddd1b4b4307e9b11f440ef05c20f973a447a",
      "contentSha": "74f81fe167d99b4cb41d6d0ccda82278caee9f3e2f25d5e5a3936ff3dcec60d0",
      "url": "https://budgets-bro-test.s3.ap-southeast-2.amazonaws.com/1/latest.zip?x-budgetsbro-nonce=zz9"
    },
    {
      "name": "DELETE object with spaces",
      "method": "DELETE",
      "objectKey": "my board/2026-09-19 backup.zip",
      "query": {
        "x-budgetsbro-nonce": "q1"
      },
      "body": null,
      "authorization": "AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE/20260919/ap-southeast-2/s3/aws4_request, SignedHeaders=host;x-amz-content-sha256;x-amz-date, Signature=dea5b92bf3272735c61c22cf200e5a279fc12f5b0b9e7db5b6ebc4c14c2530b0",
      "contentSha": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      "url": "https://budgets-bro-test.s3.ap-southeast-2.amazonaws.com/my board/2026-09-19 backup.zip?x-budgetsbro-nonce=q1"
    },
    {
      "name": "GET subresource",
      "method": "GET",
      "objectKey": "",
      "query": {
        "x-budgetsbro-nonce": "n2",
        "publicAccessBlock": ""
      },
      "body": null,
      "authorization": "AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE/20260919/ap-southeast-2/s3/aws4_request, SignedHeaders=host;x-amz-content-sha256;x-amz-date, Signature=73809606db32cdad73511a5b989ba5fc1b718114cf968d98f0dfc449e5dcae71",
      "contentSha": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      "url": "https://budgets-bro-test.s3.ap-southeast-2.amazonaws.com/?publicAccessBlock=&x-budgetsbro-nonce=n2"
    },
    {
      "name": "GET list with prefix",
      "method": "GET",
      "objectKey": "",
      "query": {
        "list-type": "2",
        "prefix": "boards/1/",
        "x-budgetsbro-nonce": "n3"
      },
      "body": null,
      "authorization": "AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE/20260919/ap-southeast-2/s3/aws4_request, SignedHeaders=host;x-amz-content-sha256;x-amz-date, Signature=4cd244b8d2784faea6d179d1317179f1d3efca65e24c9a5c476a39bb184579e8",
      "contentSha": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      "url": "https://budgets-bro-test.s3.ap-southeast-2.amazonaws.com/?list-type=2&prefix=boards%2F1%2F&x-budgetsbro-nonce=n3"
    },
    {
      "name": "HEAD object with unicode key",
      "method": "HEAD",
      "objectKey": "超市/receipt.zip",
      "query": {
        "x-budgetsbro-nonce": "n4"
      },
      "body": null,
      "authorization": "AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE/20260919/ap-southeast-2/s3/aws4_request, SignedHeaders=host;x-amz-content-sha256;x-amz-date, Signature=e1f4abbcf55e601af42b35a0ed405d80ddb35180467beb94ec54cf88ed044c41",
      "contentSha": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      "url": "https://budgets-bro-test.s3.ap-southeast-2.amazonaws.com/超市/receipt.zip?x-budgetsbro-nonce=n4"
    }
  ];

describe('signS3Request', () => {
  it.each(CASES)('matches the AWS signer: $name', (testCase) => {
    const hostname = `${CREDENTIALS.bucket}.s3.${CREDENTIALS.region}.amazonaws.com`;
    const signed = signS3Request({
      method: testCase.method,
      hostname,
      path: testCase.objectKey ? `/${testCase.objectKey}` : '/',
      query: testCase.query,
      body: testCase.body ? new Uint8Array(testCase.body) : null,
      accessKeyId: CREDENTIALS.accessKeyId,
      secretAccessKey: CREDENTIALS.secretAccessKey,
      region: CREDENTIALS.region,
      service: 's3',
      date: SIGNING_DATE,
    });

    expect(signed.headers.authorization).toBe(testCase.authorization);
    expect(signed.headers['x-amz-content-sha256']).toBe(testCase.contentSha);
    expect(signed.headers['x-amz-date']).toBe('20260919T015800Z');
    expect(signed.url).toBe(testCase.url);
  });

  it('signs a different body to a different signature', () => {
    const base = {
      method: 'PUT',
      hostname: 'b.s3.ap-southeast-2.amazonaws.com',
      path: '/1/latest.zip',
      query: {},
      accessKeyId: CREDENTIALS.accessKeyId,
      secretAccessKey: CREDENTIALS.secretAccessKey,
      region: CREDENTIALS.region,
      service: 's3',
      date: SIGNING_DATE,
    };
    const one = signS3Request({ ...base, body: new Uint8Array([1]) });
    const two = signS3Request({ ...base, body: new Uint8Array([2]) });
    expect(one.headers.authorization).not.toBe(two.headers.authorization);
    expect(one.headers['x-amz-content-sha256']).not.toBe(
      two.headers['x-amz-content-sha256'],
    );
  });

  it('hashes an empty body to the well-known empty SHA-256', () => {
    const signed = signS3Request({
      method: 'GET',
      hostname: 'b.s3.ap-southeast-2.amazonaws.com',
      path: '/',
      query: {},
      body: null,
      accessKeyId: CREDENTIALS.accessKeyId,
      secretAccessKey: CREDENTIALS.secretAccessKey,
      region: CREDENTIALS.region,
      service: 's3',
      date: SIGNING_DATE,
    });
    expect(signed.headers['x-amz-content-sha256']).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    );
  });
});
