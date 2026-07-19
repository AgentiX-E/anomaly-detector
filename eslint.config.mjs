import js from '@eslint/js'
import ts from 'typescript-eslint'

export default [
  { ignores: ['**/dist/**', '**/node_modules/**', '**/coverage/**'] },

  js.configs.recommended,
  ...ts.configs.recommendedTypeChecked,

  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      'no-console': ['warn', { allow: ['error', 'warn'] }],
      'no-debugger': 'error',
    },
  },

  // Packages needing non-null assertions (noUncheckedIndexedAccess)
  {
    files: [
      'packages/anomaly-detector-core/src/**/*.ts',
      'packages/anomaly-detector-node/src/**/*.ts',
      'packages/anomaly-detector-web/src/**/*.ts',
    ],
    rules: { '@typescript-eslint/no-non-null-assertion': 'off' },
  },

  // Adapter files needing relaxed rules for third-party APIs
  {
    files: [
      'packages/anomaly-detector-core/src/forecast/anofox-adapter.ts',
      'packages/anomaly-detector-core/src/forecast/browser-adapter.ts',
      'packages/anomaly-detector-node/src/adapter.ts',
      'packages/anomaly-detector-web/src/adapter.ts',
      'packages/anomaly-detector-core/src/engine.ts',
      'packages/anomaly-detector-core/src/detect/trcf-detector.ts',
      'packages/anomaly-detector-node/src/index.ts',
      'packages/anomaly-detector-web/src/index.ts',
      'packages/anomaly-detector-core/src/visualize/index.ts',
    ],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      'no-useless-assignment': 'off',
      'preserve-caught-error': 'off',
    },
  },

  // Test files
  {
    files: ['packages/*/test/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      'no-console': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
]
