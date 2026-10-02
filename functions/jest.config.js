module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleNameMapper: { '^@rei/shared$': '<rootDir>/../packages/shared/src/index.ts' },
};
