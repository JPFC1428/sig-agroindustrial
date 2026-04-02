import type { IncomingMessage, ServerResponse } from "node:http";
import { handleAuthRoute } from "../../server/auth-api.js";

export const config = {
  runtime: "nodejs",
};

type NodeRequest = IncomingMessage & {
  body?: unknown;
};

function getPathname(urlValue?: string) {
  return new URL(urlValue ?? "/", "http://localhost").pathname;
}

export default async function handler(
  request: NodeRequest,
  response: ServerResponse
) {
  try {
    const handled = await handleAuthRoute(request, response);

    if (handled) {
      return;
    }

    const pathname = getPathname(request.url);

    if (!response.headersSent) {
      response.statusCode = 404;
      response.setHeader("Content-Type", "application/json; charset=utf-8");
      response.end(
        JSON.stringify({
          error: "Ruta auth no encontrada",
          detail: `No existe la ruta ${pathname}`,
        })
      );
      return;
    }

    response.end();
  } catch (error) {
    const detail =
      error instanceof Error ? error.message : "Error desconocido";

    if (!response.headersSent) {
      response.statusCode = 500;
      response.setHeader("Content-Type", "application/json; charset=utf-8");
      response.end(
        JSON.stringify({ error: "Error interno en /api/auth", detail })
      );
      return;
    }

    response.end();
  }
}
