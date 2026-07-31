/**
 * Jest config for the tests that need a real Postgres.
 *
 * Kept separate from the unit suite in package.json on purpose: `npm test`
 * must stay runnable on a laptop with no database, and a DB-backed test that
 * silently skips when it cannot connect is worse than no test at all — it
 * reports green while proving nothing. So these live behind their own config
 * and their own `test:db` script, and they hard-fail (never skip) when CI=true.
 *
 * The `.dbspec.ts` suffix does not match the unit suite's `.*\.spec\.ts$`
 * regex — the character before "spec" is a "b", not a dot — so these files
 * cannot be picked up by `npm test` by accident. package.json also lists them
 * in `testPathIgnorePatterns` so the separation is stated, not just implied.
 *
 * They stay under `src/` rather than a top-level `test/` dir so that
 * `npm run typecheck` (tsconfig `include: ["src/**\/*"]`) covers them.
 */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.dbspec\\.ts$',
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  testEnvironment: 'node',
  // Migrations are applied serially against one database; parallel workers
  // would race each other through `prisma migrate deploy`.
  maxWorkers: 1,
  // `migrate deploy` on a cold database is slower than the 5s default.
  testTimeout: 120_000,
};
