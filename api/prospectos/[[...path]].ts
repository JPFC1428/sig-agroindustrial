import type { IncomingMessage, ServerResponse } from "node:http";
import { requireAuthorizedApiRequest } from "../../server/auth-api.js";
import {
  getProspectoIdFromRequestUrl,
  handleProspectoItem,
  handleProspectosCollection,
} from "../../server/prospectos-api.js";

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
    const authenticatedUser = await requireAuthorizedApiRequest(
      request,
      response,
      getPathname(request.url)
    );

    if (!authenticatedUser) {
      return;
    }

    const pathname = getPathname(request.url);

    if (pathname === "/api/prospectos" || pathname === "/api/prospectos/") {
      await handleProspectosCollection(request, response);
      return;
    }

    const id = getProspectoIdFromRequestUrl(request.url);

    if (!id) {
      response.statusCode = 400;
      response.setHeader("Content-Type", "application/json; charset=utf-8");
      response.end(
        JSON.stringify({
          error: "Prospecto invalido",
          detail: "No se pudo extraer un id valido desde la URL",
        })
      );
      return;
    }

    await handleProspectoItem(request, response, id);
  } catch (error) {
    const detail =
      error instanceof Error ? error.message : "Error desconocido";

    if (!response.headersSent) {
      response.statusCode = 500;
      response.setHeader("Content-Type", "application/json; charset=utf-8");
      response.end(
        JSON.stringify({
          error: "Error interno en /api/prospectos",
          detail,
        })
      );
      return;
    }

    response.end();
  }
}
