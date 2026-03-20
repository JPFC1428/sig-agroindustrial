import { neon } from "@neondatabase/serverless";

let cachedSql: ReturnType<typeof neon> | undefined;

export function getSql() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL no esta configurada");
  }

  // Reuse the Neon client across local reloads and serverless invocations.
  cachedSql ??= neon(databaseUrl);

  return cachedSql;
}
