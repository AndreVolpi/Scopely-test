module.exports = {
  setupFilesAfterEnv: ['<rootDir>/tests/globalSetup.ts'],
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.ts']
};
