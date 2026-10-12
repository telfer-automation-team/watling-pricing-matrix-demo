import { Pool } from "pg";

// Direct Postgres connection for fast COPY ingest. SERVER ONLY.
// Uses the Supabase "Session" pooler string (port 5432) from DATABASE_URL.
declare global {
  // eslint-disable-next-line no-var
  var __WPM_PG__: Pool | undefined;
}

export function pgPool(): Pool {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL must be set (Supabase → Settings → Database → Session connection string, port 5432).");
  }
  if (!globalThis.__WPM_PG__) {
    globalThis.__WPM_PG__ = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 4,
    });
  }
  return globalThis.__WPM_PG__;
}
