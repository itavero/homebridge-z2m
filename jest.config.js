module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  setupFilesAfterEnv: ['jest-chain'],
  coverageReporters: ['json', 'lcov', 'text', 'clover'],
  collectCoverageFrom : [
    'src/**/*.ts',
    '!src/docgen/*.ts',
  ],
};