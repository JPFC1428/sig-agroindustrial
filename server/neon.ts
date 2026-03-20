import { neon } from "@neondatabase/serverless";

let cachedSql: ReturnType<typeof neon> | undefined;

function getErrorDetail(error: unknown) {
  return error instanceof Error ? error.message : "Error desconocido";
}

export function getSql() {
  const databaseUrl = process.env.DATABASE_URL;
  const createdNewClient = !cachedSql;

  console.info("[server/neon] getSql:start", {
    hasDatabaseUrl: Boolean(databaseUrl),
    hasCachedSql: Boolean(cachedSql),
  });

  try {
    if (!databaseUrl) {
      throw new Error("DATABASE_URL no esta configurada");
    }

    // Reuse the Neon client across local reloads and serverless invocations.
    cachedSql ??= neon(databaseUrl);

    console.info("[server/neon] getSql:success", {
      createdNewClient,
      hasCachedSql: Boolean(cachedSql),
    });

    return cachedSql;
  } catch (error) {
    console.error("[server/neon] getSql:error", {
      hasDatabaseUrl: Boolean(databaseUrl),
      hasCachedSql: Boolean(cachedSql),
      detail: getErrorDetail(error),
      ...(error instanceof Error && error.stack ? { stack: error.stack } : {}),
    });
    throw error;
  }
}
