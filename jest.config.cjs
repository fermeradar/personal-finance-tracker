/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  transform: {},
  testTimeout: 10000, // Reduce global timeout
  setupFilesAfterEnv: ['./jest.setup.mjs'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1'
  },
  testMatch: ['**/__tests__/**/*.js', '**/?(*.)+(spec|test).js', '**/?(*.)+(spec|test).mjs'],
  verbose: true,
  forceExit: true, // Force Jest to exit after all tests complete
  detectOpenHandles: true, // Help identify open handles
  maxConcurrency: 1 // Run tests serially
};
