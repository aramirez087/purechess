import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      // Disabled in apps/api: NestJS dependency-injection classes are
      // sometimes imported as values (for the @Injectable decorator side
      // effect) AND as types (for parameter types), and forcing all such
      // imports to `import type` would break the runtime resolution.
      '@typescript-eslint/consistent-type-imports': 'off',
    },
  },
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'coverage/**',
      'test/**',
      '**/*.spec.ts',
      '**/*.test.ts',
      'jest.e2e.config.js',
      'eslint.config.mjs',
    ],
  },
);
