const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

// `buffer` is a Node builtin the S3 signer reaches for; Metro needs pointing
// at the userland polyfill since there is no Node runtime on the device.
module.exports = mergeConfig(getDefaultConfig(__dirname), {
  resolver: {
    extraNodeModules: { buffer: require.resolve('buffer') },
  },
});
