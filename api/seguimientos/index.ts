import type { IncomingMessage, ServerResponse } from "node:http";
import { requireAuthorizedApiRequest } from "../../server/auth-api.js";
import { handleSeguimientosCollection } from "./_seguimientos-api.js";

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
  try {
    const authenticatedUser = await requireAuthorizedApiRequest(
      request,
      response,
      new URL(request.url ?? "/", "http://localhost").pathname
    );

    if (!authenticatedUser) {
      return;
    }

    await handleSeguimientosCollection(request, response);
  } catch (error) {
    const detail =
      error instanceof Error ? error.message : "Error desconocido";

    if (!response.headersSent) {
      response.statusCode = 500;
      response.setHeader("Content-Type", "application/json; charset=utf-8");
      response.end(
        JSON.stringify({ error: "Error interno en /api/seguimientos", detail })
      );
      return;
    }

    response.end();
  }
}
