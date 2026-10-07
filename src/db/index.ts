import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema.ts';

declare global {
  var _postgresPool: Pool | undefined;
}

export const createPool = () => {
  if (!global._postgresPool) {
    const isUrl = Boolean(process.env.DATABASE_URL);
    global._postgresPool = new Pool(
      isUrl
        ? {
            connectionString: process.env.DATABASE_URL,
            ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false },
            max: 10,
            connectionTimeoutMillis: 15000,
          }
        : {
            host: process.env.SQL_HOST || 'localhost',
            user: process.env.SQL_USER || 'postgres',
            password: process.env.SQL_PASSWORD || '',
            database: process.env.SQL_DB_NAME || 'beatpulse',
            port: Number(process.env.SQL_PORT) || 5432,
            ssl: process.env.SQL_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
            max: 10,
            connectionTimeoutMillis: 15000,
          }
    );

    global._postgresPool.on('error', (err) => {
      console.warn('[PostgreSQL Pool Notice]', err.message);
    });
  }
  return global._postgresPool;
};

const pool = createPool();

export const db = drizzle(pool, { schema });
