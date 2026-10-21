import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

export type Database = PostgresJsDatabase<typeof schema>;
export type Sql = ReturnType<typeof postgres>;

export interface DatabaseHandle {
  db: Database;
  sql: Sql;
  close: () => Promise<void>;
}

export function createDatabase(url: string, options: { max?: number } = {}): DatabaseHandle {
  const sql = postgres(url, {
    max: options.max ?? 10,
    onnotice: () => {},
  });
  const db = drizzle(sql, { schema });

  return {
    db,
    sql,
    close: async () => {
      await sql.end({ timeout: 5 });
    },
  };
}

const globalForDb = globalThis as unknown as {
  __fluxbotDb?: DatabaseHandle;
};

/** Process-wide handle used by the Next.js app (survives HMR in dev). */
export function getDatabase(): DatabaseHandle {
  if (globalForDb.__fluxbotDb) return globalForDb.__fluxbotDb;

  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');

  const handle = createDatabase(url);
  globalForDb.__fluxbotDb = handle;
  return handle;
}

export function getDb(): Database {
  return getDatabase().db;
}
