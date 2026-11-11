import type { Gzip } from '../../../sync-core/types';

const pipe = async (bytes: Uint8Array, stream: CompressionStream | DecompressionStream) =>
  new Uint8Array(await new Response(new Blob([bytes as Uint8Array<ArrayBuffer>]).stream().pipeThrough(stream)).arrayBuffer());

// The browser's own gzip: no library in the bundle.
export const streamGzip: Gzip = {
  deflate: (bytes) => pipe(bytes, new CompressionStream('gzip')),
  inflate: (bytes) => pipe(bytes, new DecompressionStream('gzip')),
};
