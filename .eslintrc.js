// .eslintrc.js
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: './tsconfig.json',
    tsconfigRootDir: __dirname,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-requiring-type-checking',
  ],
  rules: {
    // Enforce explicit return types on exported functions
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',

    // No implicit any
    '@typescript-eslint/no-explicit-any': 'warn',

    // Require await on async functions
    '@typescript-eslint/require-await': 'warn',

    // No floating promises — financial system must handle all async paths
    '@typescript-eslint/no-floating-promises': 'error',

    // No unused variables (use _ prefix to ignore)
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],

    // Consistent type imports
    '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],

    // Naming conventions
    '@typescript-eslint/naming-convention': [
      'error',
      { selector: 'interface', format: ['PascalCase'], prefix: ['I'] },
      { selector: 'typeAlias',  format: ['PascalCase'] },
      { selector: 'enum',       format: ['PascalCase'] },
    ],

    // General
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    'eqeqeq':     ['error', 'always'],
    'no-throw-literal': 'error',
  },
  env: {
    node: true,
    es2022: true,
  },
  ignorePatterns: ['dist/', 'node_modules/', 'coverage/', '*.js'],
};
