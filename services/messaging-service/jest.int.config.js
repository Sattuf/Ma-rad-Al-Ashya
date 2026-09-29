// Integration tests: run against real Redis/Postgres (see docs/TESTING_STRATEGY.md).
// Local: DATABASE_URL=postgres://... REDIS_URL=redis://localhost:6379 npm run test:int
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: 'test/integration/.*\\.int-spec\\.ts$',
  transform: { '^.+\\.(t|j)s$': 'ts-jest' },
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/jest.setup-env.js'],
  testTimeout: 30000,
};
