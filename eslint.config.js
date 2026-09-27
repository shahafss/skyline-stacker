// @ts-check
import { defineConfig } from 'eslint/config';
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier';

const forbiddenMathProperties = [
  'random',
  'sin',
  'cos',
  'tan',
  'atan2',
  'pow',
  'exp',
  'log',
  'sqrt',
  'asin',
  'acos',
  'atan',
  'cbrt',
  'hypot',
  'fround',
  'log2',
  'log10',
  'log1p',
  'expm1',
  'sinh',
  'cosh',
  'tanh',
].map((property) => ({
  object: 'Math',
  property,
  message: `Math.${property} is forbidden in packages/sim (Principle I). Use the sim's integer helpers instead.`,
}));

/**
 * Numeric literals only: raw text starting with a digit (or a leading dot) followed by a decimal
 * point or an exponent. String/template literals never start this way, so relative import
 * specifiers like './tuning' or version strings like '1.0.0' are never matched.
 */
const nonIntegerLiteralRules = [
  {
    selector: 'Literal[raw=/^[0-9][0-9_]*\\.[0-9]/]',
    message: 'Non-integer numeric literals are forbidden in packages/sim (Principle I).',
  },
  {
    selector: 'Literal[raw=/^[0-9][0-9_]*[eE][+-]?[0-9]/]',
    message: 'Non-integer numeric literals are forbidden in packages/sim (Principle I).',
  },
  {
    selector: 'Literal[raw=/^\\.[0-9]/]',
    message: 'Non-integer numeric literals are forbidden in packages/sim (Principle I).',
  },
];

const forbiddenGlobals = [
  'Date',
  'performance',
  'setTimeout',
  'setInterval',
  'setImmediate',
  'queueMicrotask',
  'requestAnimationFrame',
  'crypto',
  'window',
  'document',
  'globalThis',
  'process',
].map((name) => ({
  name,
  message: `${name} is forbidden in packages/sim (Principle I): it is not deterministic.`,
}));

export default defineConfig(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/coverage/**',
      '**/playwright-report/**',
      '**/test-results/**',
      'packages/sim/src/sinLut.ts',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: ['packages/sim/src/__probe__.ts'],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { varsIgnorePattern: '^_', argsIgnorePattern: '^_' },
      ],
    },
  },
  {
    files: ['packages/sim/src/**/*.ts'],
    rules: {
      'no-restricted-properties': ['error', ...forbiddenMathProperties],
      'no-restricted-globals': ['error', ...forbiddenGlobals],
      'no-restricted-syntax': [
        'error',
        {
          selector: "BinaryExpression[operator='**']",
          message: 'The ** operator is forbidden in packages/sim (Principle I).',
        },
        {
          selector: "AssignmentExpression[operator='**=']",
          message: 'The **= operator is forbidden in packages/sim (Principle I).',
        },
        {
          selector: "BinaryExpression[operator='/']",
          message:
            'The / operator is forbidden in packages/sim (Principle I). Use div() from fixed.ts.',
        },
        {
          selector: "AssignmentExpression[operator='/=']",
          message:
            'The /= operator is forbidden in packages/sim (Principle I). Use div() from fixed.ts.',
        },
        ...nonIntegerLiteralRules,
      ],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '^(?!\\.)',
              message:
                'Only relative imports are allowed in packages/sim (Principle I): zero runtime dependencies.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['packages/sim/src/fixed.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "BinaryExpression[operator='**']",
          message: 'The ** operator is forbidden in packages/sim (Principle I).',
        },
        {
          selector: "AssignmentExpression[operator='**=']",
          message: 'The **= operator is forbidden in packages/sim (Principle I).',
        },
        ...nonIntegerLiteralRules,
      ],
    },
  },
  eslintConfigPrettier,
);
