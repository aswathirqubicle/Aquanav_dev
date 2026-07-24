/**
 * Integration test config — DESTRUCTIVE. Real database, unfiltered DELETEs.
 *
 * Never runs as part of `npm test`. Invoke deliberately:
 *   ALLOW_DESTRUCTIVE_TESTS=1 npm run test:integration
 *
 * The globalSetup gate aborts the run unless that flag is set AND
 * DATABASE_URL points at a local host. See jest.integration.setup.cjs.
 */
const base = require('./jest.config.cjs');

module.exports = {
  ...base,

  // The two suites that open a real connection and truncate tables.
  testMatch: [
    '<rootDir>/server/storage.payroll.integration.test.ts',
    '<rootDir>/server/storage.goods_receipt.test.ts',
  ],

  globalSetup: '<rootDir>/jest.integration.setup.cjs',

  // Truncation between tests makes parallel workers race on the same tables.
  maxWorkers: 1,

  collectCoverage: false,
};
