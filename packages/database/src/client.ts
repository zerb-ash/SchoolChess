import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema.js';

const { Pool } = pg;

export function createDatabaseClient(connectionString?: string) {
  const url = connectionString || process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/schoolchess';
  const pool = new Pool({
    connectionString: url,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });

  return {
    db: drizzle(pool, { schema }),
    pool,
  };
}

export type DatabaseInstance = ReturnType<typeof createDatabaseClient>['db'];
