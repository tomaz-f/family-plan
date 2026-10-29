import { createClient } from '@libsql/client';
import fs from 'node:fs';

const env = fs.readFileSync('.env', 'utf8');
const url = env.match(/turso_db_url=(.+)/)[1].trim();
const token = env.match(/turso_token=(.+)/)[1].trim();

const client = createClient({ url, authToken: token });

async function inspect() {
  const res = await client.execute("SELECT sql FROM sqlite_master WHERE name='transactions'");
  console.log('Transactions table SQL:\n', res.rows[0].sql);
}
inspect().catch(console.error);
