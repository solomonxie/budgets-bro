const path = require('path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

const defaults = getDefaultConfig(__dirname);

module.exports = mergeConfig(defaults, {
  resolver: {
    // `buffer` is a Node builtin the S3 signer reaches for; Metro needs pointing
    // at the userland polyfill since there is no Node runtime on the device.
    extraNodeModules: { buffer: require.resolve('buffer') },
    // The Chrome extension is its own esbuild project with its own node_modules.
    blockList: [
      ...[defaults.resolver.blockList].flat(),
      new RegExp(`^${path.join(__dirname, 'extension').replace(/[/\\.]/g, '\\$&')}/.*`),
    ],
  },
});
