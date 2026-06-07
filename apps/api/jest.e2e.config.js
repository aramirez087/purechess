/** @type {import('jest').Config} */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testMatch: ['**/test/e2e/**/*.e2e-spec.ts'],
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  testEnvironment: 'node',
  testTimeout: 30000,
  moduleNameMapper: {
    '^@purechess/shared$': '<rootDir>/../../packages/shared/src/index.ts',
    '^(\\.\\.\\.?/.*)\\.js$': '$1',
  },
};
