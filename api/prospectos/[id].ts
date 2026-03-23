import {
  getProspectoIdFromRequestUrl,
  handleProspectoItem,
} from "./_prospectos-api.js";
import {
  createNodeRequestFromWebRequest,
  createNodeResponseCapture,
  type RuntimeRequest,
} from "./_web-response-bridge.js";

export const config = {
  runtime: "nodejs",
};

export default async function handler(request: RuntimeRequest) {
  console.info("[api/prospectos/[id]] handler:start", {
    method: request.method,
    url: request.url,
  });

  const nodeRequest = await createNodeRequestFromWebRequest(request);
  const nodeResponse = createNodeResponseCapture();
  const id = getProspectoIdFromRequestUrl(nodeRequest.url);

  console.info("[api/prospectos/[id]] handler:parsed-id", {
    method: nodeRequest.method,
    url: nodeRequest.url,
    id,
  });

  if (!id) {
    console.error("[api/prospectos/[id]] handler:invalid-id", {
      method: nodeRequest.method,
      url: nodeRequest.url,
    });

    return new Response(
      JSON.stringify({
        error: "Prospecto invalido",
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
    await handleProspectoItem(nodeRequest, nodeResponse.nodeResponse, id);
    console.info("[api/prospectos/[id]] handler:done", {
      method: nodeRequest.method,
      url: nodeRequest.url,
      id,
      statusCode: nodeResponse.statusCode,
    });
    return nodeResponse.toResponse();
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Error desconocido";

    console.error("[api/prospectos/[id]] handler:error", {
      method: nodeRequest.method,
      url: nodeRequest.url,
      id,
      detail,
      ...(error instanceof Error && error.stack ? { stack: error.stack } : {}),
    });

    if (!nodeResponse.headersSent) {
      return new Response(
        JSON.stringify({
          error: "Error interno en /api/prospectos/[id]",
          detail,
        }),
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
