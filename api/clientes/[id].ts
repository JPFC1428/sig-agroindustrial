import {
  getClienteIdFromRequestUrl,
  handleClienteItem,
} from "../../server/clientes-api";
import {
  createNodeRequestFromWebRequest,
  createNodeResponseCapture,
} from "./_web-response-bridge";

export const config = {
  runtime: "nodejs",
};

export default async function handler(request: Request) {
  console.info("[api/clientes/[id]] handler:start", {
    method: request.method,
    url: request.url,
  });

  const nodeRequest = await createNodeRequestFromWebRequest(request);
  const nodeResponse = createNodeResponseCapture();
  const id = getClienteIdFromRequestUrl(nodeRequest.url);

  console.info("[api/clientes/[id]] handler:parsed-id", {
    method: nodeRequest.method,
    url: nodeRequest.url,
    id,
  });

  if (!id) {
    console.error("[api/clientes/[id]] handler:invalid-id", {
      method: nodeRequest.method,
      url: nodeRequest.url,
    });

    return new Response(
      JSON.stringify({
        error: "Cliente invalido",
        detail: "No se pudo extraer un id valido desde la URL",
      }),
      {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
        },
        status: 400,
      }
    );
  }

  try {
    await handleClienteItem(nodeRequest, nodeResponse.nodeResponse, id);
    console.info("[api/clientes/[id]] handler:done", {
      method: nodeRequest.method,
      url: nodeRequest.url,
      id,
      statusCode: nodeResponse.statusCode,
    });
    return nodeResponse.toResponse();
  } catch (error) {
    const detail =
      error instanceof Error ? error.message : "Error desconocido";

    console.error("[api/clientes/[id]] handler:error", {
      method: nodeRequest.method,
      url: nodeRequest.url,
      id,
      detail,
      ...(error instanceof Error && error.stack ? { stack: error.stack } : {}),
    });

    if (!nodeResponse.headersSent) {
      return new Response(
        JSON.stringify({ error: "Error interno en /api/clientes/[id]", detail }),
        {
          headers: {
            "Content-Type": "application/json; charset=utf-8",
          },
          status: 500,
        }
      );
    }

    return nodeResponse.toResponse();
  }
}
