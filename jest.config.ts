import type { Config } from 'jest';

const config: Config = {
  preset:          'ts-jest',
  testEnvironment: 'node',
  rootDir:         '.',
  moduleNameMapper: {
    '^@shared/(.*)$':         '<rootDir>/src/shared/$1',
    '^@services/(.*)$':       '<rootDir>/src/services/$1',
    '^@infrastructure/(.*)$': '<rootDir>/src/infrastructure/$1',
  },
  setupFiles:   ['<rootDir>/tests/setup.ts'],
  testMatch:    ['<rootDir>/tests/**/*.test.ts'],
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/server.ts',
    '!src/infrastructure/grpc/**',
    '!src/infrastructure/swagger/**',
  ],
  testTimeout: 30_000,
  verbose:     true,
};

export default config;
