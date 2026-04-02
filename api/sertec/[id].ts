import type { IncomingMessage, ServerResponse } from "node:http";
import { requireAuthorizedApiRequest } from "../../server/auth-api.js";
import {
  getSertecIdFromRequestUrl,
  handleSertecItem,
} from "../../server/sertec-api.js";

export const config = {
  runtime: "nodejs",
};

type NodeRequest = IncomingMessage & {
  body?: unknown;
};

export default async function handler(
  request: NodeRequest,
  response: ServerResponse
) {
  const id = getSertecIdFromRequestUrl(request.url);

  if (!id) {
    response.statusCode = 400;
    response.setHeader("Content-Type", "application/json; charset=utf-8");
    response.end(
      JSON.stringify({
        error: "Orden invalida",
        detail: "No se pudo extraer un id valido desde la URL",
      })
    );
    return;
  }

  try {
    const authenticatedUser = await requireAuthorizedApiRequest(
      request,
      response,
      new URL(request.url ?? "/", "http://localhost").pathname
    );

    if (!authenticatedUser) {
      return;
    }

    await handleSertecItem(request, response, id);
  } catch (error) {
    const detail =
      error instanceof Error ? error.message : "Error desconocido";

    if (!response.headersSent) {
      response.statusCode = 500;
      response.setHeader("Content-Type", "application/json; charset=utf-8");
      response.end(
        JSON.stringify({
          error: "Error interno en /api/sertec/[id]",
          detail,
        })
      );
      return;
    }

    response.end();
  }
}
