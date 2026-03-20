import type { IncomingMessage, ServerResponse } from "node:http";
import { handleClientesCollection } from "../../server/clientes-api";

export const config = {
  runtime: "nodejs",
};

function sendJsonError(
  res: ServerResponse,
  statusCode: number,
  error: string,
  detail: string
) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify({ error, detail }));
}

export default async function handler(
  req: IncomingMessage & { body?: unknown },
  res: ServerResponse
) {
  console.info("[api/clientes/index] handler:start", {
    method: req.method,
    url: req.url,
  });

  try {
    await handleClientesCollection(req, res);
    console.info("[api/clientes/index] handler:done", {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
    });
  } catch (error) {
    const detail =
      error instanceof Error ? error.message : "Error desconocido";

    console.error("[api/clientes/index] handler:error", {
      method: req.method,
      url: req.url,
      detail,
      ...(error instanceof Error && error.stack ? { stack: error.stack } : {}),
    });

    if (!res.headersSent) {
      sendJsonError(res, 500, "Error interno en /api/clientes", detail);
    }
  }
}
