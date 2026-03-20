import type { IncomingMessage, ServerResponse } from "node:http";
import {
  getClienteIdFromRequestUrl,
  handleClienteItem,
} from "../../server/clientes-api";

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
  console.info("[api/clientes/[id]] handler:start", {
    method: req.method,
    url: req.url,
  });

  const id = getClienteIdFromRequestUrl(req.url);

  console.info("[api/clientes/[id]] handler:parsed-id", {
    method: req.method,
    url: req.url,
    id,
  });

  if (!id) {
    console.error("[api/clientes/[id]] handler:invalid-id", {
      method: req.method,
      url: req.url,
    });

    sendJsonError(
      res,
      400,
      "Cliente invalido",
      "No se pudo extraer un id valido desde la URL"
    );
    return;
  }

  try {
    await handleClienteItem(req, res, id);
    console.info("[api/clientes/[id]] handler:done", {
      method: req.method,
      url: req.url,
      id,
      statusCode: res.statusCode,
    });
  } catch (error) {
    const detail =
      error instanceof Error ? error.message : "Error desconocido";

    console.error("[api/clientes/[id]] handler:error", {
      method: req.method,
      url: req.url,
      id,
      detail,
      ...(error instanceof Error && error.stack ? { stack: error.stack } : {}),
    });

    if (!res.headersSent) {
      sendJsonError(res, 500, "Error interno en /api/clientes/[id]", detail);
    }
  }
}
