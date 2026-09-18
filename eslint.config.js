const js = require('@eslint/js');
const tseslint = require('typescript-eslint');
const reactHooks = require('eslint-plugin-react-hooks');
const globals = require('globals');

// Assembled by hand rather than taken from a framework preset: React
// Native's own config is written for Flow and pulls in a plugin that
// doesn't run on ESLint 9 at all.
module.exports = [
  { ignores: ['dist/*', 'ios/*', 'coverage/*'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  reactHooks.configs.flat['recommended-latest'],
  {
    // Metro, Babel and this file itself are CommonJS config read by Node,
    // not bundled app code.
    files: ['*.config.js'],
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
  {
    languageOptions: {
      globals: { ...globals.node, ...globals.browser, __DEV__: 'readonly' },
    },
    rules: {
      // Our data hooks intentionally fetch-on-mount/dependency-change from
      // SQLite (see docs/DESIGN.md's tech stack: plain hooks over the
      // SQLite driver, no React Query/Redux) — the exact pattern this rule
      // flags. Not adopting a data-fetching library for this.
      'react-hooks/set-state-in-effect': 'off',
      // A leading underscore marks a binding kept for shape (an unused
      // destructured field, a positional callback arg) on purpose.
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
];
