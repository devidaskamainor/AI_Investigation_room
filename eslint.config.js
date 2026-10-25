import js from '@eslint/js';
import globals from 'globals';
import hooks from 'eslint-plugin-react-hooks';
import react from 'eslint-plugin-react';
export default [
  {
    ignores: [
      'node_modules/**',
      'client/dist/**',
      'coverage/**',
      'playwright-report/**',
      'test-results/**',
      '.runtime/**',
    ],
  },
  js.configs.recommended,
  {
    files: ['**/*.{js,mjs,jsx}'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: { ...globals.node, ...globals.browser },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['client/src/**/*.{js,jsx}'],
    plugins: { 'react-hooks': hooks, react },
    rules: {
      ...hooks.configs.recommended.rules,
      'react/jsx-uses-vars': 'error',
      'react/jsx-no-undef': 'error',
    },
  },
];
