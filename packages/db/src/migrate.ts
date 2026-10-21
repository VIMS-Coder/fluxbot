import { dirname, join } from 'node:path';
import { config } from 'dotenv';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

const here = import.meta.dirname ?? '.';

// Works when run from the workspace package as well as from the repo root.
config({ path: join(here, '..', '..', '..', '.env') });

const url = process.env.DATABASE_URL;

if (!url) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}

const migrationsFolder = join(dirname(here), 'drizzle');

const sql = postgres(url, { max: 1 });
const db = drizzle(sql);

try {
  await migrate(db, { migrationsFolder });
  console.log('Migrations applied');
} finally {
  await sql.end({ timeout: 5 });
}
