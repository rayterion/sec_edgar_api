import js from '@eslint/js';
import tseslint from 'typescript-eslint';
export default [
  { ignores: ['**/dist/**', '**/node_modules/**', '**/build/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { languageOptions: { globals: { console: 'readonly', process: 'readonly', Response: 'readonly', AbortController: 'readonly', fetch: 'readonly', setTimeout: 'readonly', clearTimeout: 'readonly', URL: 'readonly', TextDecoder: 'readonly' } } }
];
