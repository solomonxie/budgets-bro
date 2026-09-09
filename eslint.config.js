const expoConfig = require('eslint-config-expo/flat');

module.exports = [
  ...expoConfig,
  {
    ignores: ['dist/*'],
  },
  {
    // Our data hooks intentionally fetch-on-mount/dependency-change from
    // SQLite (see docs/yama-mvp.md's tech stack: plain hooks over
    // expo-sqlite, no React Query/Redux) — the exact pattern this rule
    // flags. Not adopting a data-fetching library for this.
    rules: {
      'react-hooks/set-state-in-effect': 'off',
    },
  },
];
