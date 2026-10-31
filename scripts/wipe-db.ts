import { createClient } from '@libsql/client';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Resolve project root and load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

function loadEnvConfig(): { url: string; token?: string } {
  const envPath = path.resolve(ROOT_DIR, '.env');
  let url = process.env.turso_db_url || process.env.TURSO_DB_URL || '';
  let token = process.env.turso_token || process.env.TURSO_TOKEN || '';

  if (fs.existsSync(envPath)) {
    const raw = fs.readFileSync(envPath, 'utf8');
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx > 0) {
        const key = trimmed.slice(0, eqIdx).trim();
        const val = trimmed.slice(eqIdx + 1).trim();
        if ((key === 'turso_db_url' || key === 'TURSO_DB_URL') && !url) {
          url = val;
        }
        if ((key === 'turso_token' || key === 'TURSO_TOKEN') && !token) {
          token = val;
        }
      }
    }
  }

  if (!url) {
    throw new Error('Database URL (turso_db_url) not found in .env or environment.');
  }

  return { url, token: token || undefined };
}

const { url, token } = loadEnvConfig();
const client = createClient({ url, authToken: token });

const TABLES_IN_WIPE_ORDER = [
  'transactions',
  'recurring_templates',
  'fuel_logs',
  'credit_cards',
  'categories',
  'settings',
  'families',
] as const;

async function getTableRowCount(table: string): Promise<number> {
  try {
    const res = await client.execute(`SELECT COUNT(*) as count FROM ${table};`);
    const val = res.rows[0]?.count ?? res.rows[0]?.[0];
    return typeof val === 'number' ? val : Number(val || 0);
  } catch (err: any) {
    console.warn(`[Count Warning] Could not count table '${table}': ${err?.message}`);
    return 0;
  }
}

async function wipeDatabase(): Promise<void> {
  console.log('=====================================================');
  console.log('       PRUMO / FAMILY PLAN - DATABASE WIPE SCRIPT     ');
  console.log('=====================================================');
  console.log(`Connecting to: ${url.replace(/\/\/[^@]+@/, '//***@')}`);

  console.log('\n[1/3] Checking current table row counts before wipe:');
  const initialCounts: Record<string, number> = {};
  for (const table of TABLES_IN_WIPE_ORDER) {
    const count = await getTableRowCount(table);
    initialCounts[table] = count;
    console.log(`  • ${table.padEnd(22)} : ${count} row(s)`);
  }

  console.log('\n[2/3] Wiping all records across tables (FK-safe deletion)...');

  // Disable foreign keys temporarily for clean deletion
  try {
    await client.execute('PRAGMA foreign_keys = OFF;');
  } catch (e: any) {
    console.warn('Note: PRAGMA foreign_keys = OFF not supported in HTTP mode, deleting sequentially.');
  }

  // Delete records from each table in order
  for (const table of TABLES_IN_WIPE_ORDER) {
    console.log(`  -> Deleting from '${table}'...`);
    await client.execute(`DELETE FROM ${table};`);
  }

  // Clear sqlite_sequence if table exists
  try {
    await client.execute(
      "DELETE FROM sqlite_sequence WHERE name IN ('transactions', 'recurring_templates', 'fuel_logs', 'credit_cards', 'categories', 'settings', 'families');"
    );
    console.log('  -> Cleared sqlite_sequence autoincrement pointers.');
  } catch {
    // sqlite_sequence does not exist if autoincrement was not used; safe to ignore
  }

  // Re-enable foreign keys
  try {
    await client.execute('PRAGMA foreign_keys = ON;');
  } catch {
    // ignore
  }

  console.log('\n[3/3] Verifying remaining table row counts:');
  let allZero = true;
  for (const table of TABLES_IN_WIPE_ORDER) {
    const finalCount = await getTableRowCount(table);
    const status = finalCount === 0 ? '✓ EMPTY (0)' : `✗ FAILED (${finalCount} rows remaining)`;
    console.log(`  • ${table.padEnd(22)} : ${status}`);
    if (finalCount !== 0) {
      allZero = false;
    }
  }

  console.log('=====================================================');
  if (allZero) {
    console.log('SUCCESS: All 7 tables have been successfully wiped to 0 records!');
  } else {
    console.error('WARNING: Some tables still contain records.');
    process.exit(1);
  }
  console.log('=====================================================');
}

wipeDatabase().catch((err) => {
  console.error('\n[FATAL ERROR during database wipe]:', err);
  process.exit(1);
});
