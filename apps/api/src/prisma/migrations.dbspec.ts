import { ExecFileSyncOptionsWithStringEncoding, execFileSync } from 'child_process';
import { readdirSync } from 'fs';
import { join } from 'path';
import { PrismaClient } from '@prisma/client';

/**
 * The migration harness. This file exists so that the League -> Room +
 * Challenge migration can be tested before it touches production; on its own
 * it already earns its keep by proving two things nothing else checks.
 *
 * 1. Every migration in the repo applies cleanly to an empty database, in
 *    order. That is the exact operation `railway.toml` runs on every deploy
 *    (`npx prisma migrate deploy && node dist/main.js`) — before the process
 *    boots, with `restartPolicyMaxRetries = 3`. A migration that fails there
 *    does not roll back and retry quietly: it takes the API down.
 *
 * 2. `schema.prisma` and the `migrations/` folder agree. Prisma will happily
 *    let someone edit the schema without generating a migration; the app then
 *    typechecks, the unit suite passes, and production breaks at runtime on a
 *    column the client expects and the database does not have. `prisma migrate
 *    diff` is the only thing that catches that, and it needs a real Postgres.
 *
 * Requires DATABASE_URL and SHADOW_DATABASE_URL pointing at two *disposable*
 * databases. See the `migrations` job in .github/workflows/ci.yml.
 */

const API_DIR = join(__dirname, '..', '..');
const SCHEMA = join(API_DIR, 'prisma', 'schema.prisma');
const MIGRATIONS_DIR = join(API_DIR, 'prisma', 'migrations');

const DATABASE_URL = process.env.DATABASE_URL;
const SHADOW_DATABASE_URL = process.env.SHADOW_DATABASE_URL;

/**
 * A DB-backed suite that skips itself when the database is missing is a green
 * check that proves nothing. Skipping is fine on a laptop; in CI it is a bug.
 */
const isCI = process.env.CI === 'true' || process.env.CI === '1';
const hasDb = Boolean(DATABASE_URL && SHADOW_DATABASE_URL);

if (isCI && !hasDb) {
  throw new Error(
    'DATABASE_URL and SHADOW_DATABASE_URL must be set in CI. Refusing to ' +
      'skip: a silently skipped migration suite reports green while proving ' +
      'nothing. See the `migrations` job in .github/workflows/ci.yml.',
  );
}

function prisma(args: string[], env: Record<string, string> = {}): string {
  const options: ExecFileSyncOptionsWithStringEncoding = {
    cwd: API_DIR,
    encoding: 'utf8',
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  };

  try {
    return execFileSync('npx', ['prisma', ...args], options);
  } catch (error) {
    // execFileSync's default message hides the output that explains a Prisma
    // failure. Preserve it so a drift check names the tables/columns that
    // disagree instead of leaving CI with only "Command failed".
    const failed = error as Error & {
      stdout?: string | Buffer;
      stderr?: string | Buffer;
    };
    const stdout = failed.stdout?.toString().trim();
    const stderr = failed.stderr?.toString().trim();
    const diagnostics = [stdout, stderr].filter(Boolean).join('\n');

    // Rethrowing the same error (rather than wrapping it) keeps the original
    // stack and exit code intact for anything that inspects them.
    if (diagnostics) {
      failed.message = `${failed.message}\n${diagnostics}`;
    }
    throw failed;
  }
}

// `describe.skip` keeps the file loadable (and typechecked) without a database.
const suite = hasDb ? describe : describe.skip;

suite('prisma migrations', () => {
  let client: PrismaClient;

  beforeAll(async () => {
    // A clean slate every run: the point is to prove the chain applies from
    // zero, which is what a fresh production database — or a restored
    // backup — actually goes through.
    prisma(['migrate', 'reset', '--force', '--skip-generate', '--skip-seed']);

    client = new PrismaClient({ datasources: { db: { url: DATABASE_URL } } });
    await client.$connect();
  });

  afterAll(async () => {
    await client?.$disconnect();
  });

  it('applies every migration to an empty database', async () => {
    // `migrate reset` in beforeAll already replayed the chain; asserting on
    // the bookkeeping table proves it got to the end rather than stopping
    // early on a migration Prisma considered already applied.
    const applied = await client.$queryRawUnsafe<
      { migration_name: string; finished_at: Date | null }[]
    >(
      `SELECT migration_name, finished_at FROM "_prisma_migrations" ORDER BY started_at`,
    );

    const onDisk = readdirSync(MIGRATIONS_DIR).filter(
      (entry) => !entry.endsWith('.toml'),
    );

    expect(applied.map((row) => row.migration_name).sort()).toEqual(
      onDisk.sort(),
    );
    // A row with a null `finished_at` is a migration that started and died —
    // the "failed halfway" state that takes the Railway deploy down with it.
    expect(applied.every((row) => row.finished_at !== null)).toBe(true);
  });

  it('has no drift between schema.prisma and the migrations folder', () => {
    // --exit-code makes `migrate diff` exit 2 when the two disagree, which
    // execFileSync surfaces as a throw. Any diff at all is a failure: it means
    // someone edited the schema without generating the matching migration.
    expect(() =>
      prisma(
        [
          'migrate',
          'diff',
          '--from-migrations',
          MIGRATIONS_DIR,
          '--to-schema-datamodel',
          SCHEMA,
          '--shadow-database-url',
          SHADOW_DATABASE_URL!,
          '--exit-code',
        ],
        { DATABASE_URL: DATABASE_URL! },
      ),
    ).not.toThrow();
  });

  it('created the tables the leagues domain is about to be migrated off of', async () => {
    const tables = await client.$queryRawUnsafe<{ tablename: string }[]>(
      `SELECT tablename FROM pg_tables WHERE schemaname = current_schema()`,
    );
    const names = new Set(tables.map((t) => t.tablename));

    // The League -> Room + Challenge migration has to carry all of these
    // forward. Naming them here means a future migration that drops one
    // without a replacement fails this test instead of production.
    for (const table of [
      'leagues',
      'league_members',
      'feed_posts',
      'feed_reactions',
      'feed_comments',
      'chat_messages',
      'study_sessions',
    ]) {
      expect(names).toContain(table);
    }
  });

  it('keeps the cascade that makes a careless DROP TABLE leagues destructive', async () => {
    // Not a wish — a fact worth pinning. `league_members`, `feed_posts` and
    // `chat_messages` all cascade from `leagues`, so a migration that drops
    // and recreates the leagues table takes the entire feed and chat history
    // with it, silently. The Room + Challenge migration must rename/repoint,
    // never drop-and-recreate. This test makes that constraint visible in the
    // suite instead of living only in a review comment.
    const cascades = await client.$queryRawUnsafe<
      { table_name: string; delete_rule: string }[]
    >(`
      SELECT tc.table_name, rc.delete_rule
      FROM information_schema.table_constraints tc
      JOIN information_schema.referential_constraints rc
        ON tc.constraint_name = rc.constraint_name
      JOIN information_schema.constraint_column_usage ccu
        ON tc.constraint_name = ccu.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY' AND ccu.table_name = 'leagues'
    `);

    const byTable = new Map(cascades.map((r) => [r.table_name, r.delete_rule]));

    expect(byTable.get('league_members')).toBe('CASCADE');
    expect(byTable.get('feed_posts')).toBe('CASCADE');
    expect(byTable.get('chat_messages')).toBe('CASCADE');
    // study_sessions is the odd one out and that is deliberate: SET NULL means
    // deleting a league silently orphans its sessions' league_id rather than
    // deleting the study history. It also means that link is already lost for
    // every league ever deleted — which is why the challenge scoreboard cannot
    // be recomputed from sessions. See the 31/07 audit, item 1.1.
    expect(byTable.get('study_sessions')).toBe('SET NULL');
  });
});
