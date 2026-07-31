/**
 * SQLite → PostgreSQL data migration (zero extra deps)
 * Reads from prisma/dev.db (node:sqlite), inserts into AWS RDS (pg).
 * Converts SQLite INTEGER epoch-ms datetimes to ISO strings for Postgres.
 *
 * Usage: node scripts/migrate-sqlite-to-postgres.mjs
 */
import { DatabaseSync } from 'node:sqlite';
import pg from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, '..', 'prisma', 'dev.db');
const sqlite = new DatabaseSync(dbPath, { readOnly: true });

const pgClient = new pg.Client({
  host: '3.147.3.100',
  port: 5432,
  user: 'command_center',
  password: '4hgTGeE74xtsHs6',
  database: 'command_center',
  ssl: { rejectUnauthorized: false },
});

// Column names that Prisma stores as DateTime (INTEGER epoch-ms in SQLite)
const DATE_COLUMNS = new Set([
  'createdAt', 'updatedAt', 'date', 'startedAt', 'endedAt',
  'dueDate', 'repeatEndDate', 'triggerAt', 'expires',
]);

function toPgValue(v, column) {
  if (v === undefined || v === null) return null;
  if (Buffer.isBuffer(v)) return v.toString('utf8');
  // Convert epoch-ms integers in date columns to ISO 8601
  if (DATE_COLUMNS.has(column) && typeof v === 'number' && v > 100000000000) {
    return new Date(v).toISOString();
  }
  return v;
}

async function main() {
  await pgClient.connect();
  console.log('Connected to PostgreSQL\n');

  // Disable FK checks during load (table order independent)
  await pgClient.query('SET session_replication_role = replica');

  const tables = sqlite
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name != '_prisma_migrations'")
    .all()
    .map((r) => r.name);

  let total = 0;

  for (const table of tables) {
    const rows = sqlite.prepare(`SELECT * FROM "${table}"`).all();
    if (rows.length === 0) continue;

    const columns = Object.keys(rows[0]);
    const colList = columns.map((c) => `"${c}"`).join(', ');
    const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');

    await pgClient.query(`DELETE FROM "${table}"`);

    for (const row of rows) {
      const values = columns.map((c) => toPgValue(row[c], c));
      await pgClient.query(
        `INSERT INTO "${table}" (${colList}) VALUES (${placeholders})`,
        values,
      );
    }

    console.log(`  ${table}: ${rows.length} rows`);
    total += rows.length;
  }

  console.log(`\n✅ Migrated ${total} rows across ${tables.length} tables`);

  // Re-enable FK checks
  await pgClient.query('SET session_replication_role = DEFAULT');
  await pgClient.end();
  sqlite.close();
}

main().catch((e) => {
  console.error('Migration failed:', e.message);
  process.exit(1);
});
