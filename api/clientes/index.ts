import { handleClientesCollection } from "./_clientes-api.js";
import {
  createNodeRequestFromWebRequest,
  createNodeResponseCapture,
  type RuntimeRequest,
} from "./_web-response-bridge.js";

export const config = {
  runtime: "nodejs",
};

export default async function handler(request: RuntimeRequest) {
  console.info("[api/clientes/index] handler:start", {
    method: request.method,
    url: request.url,
  });

  const nodeRequest = await createNodeRequestFromWebRequest(request);
  const nodeResponse = createNodeResponseCapture();

  try {
    await handleClientesCollection(nodeRequest, nodeResponse.nodeResponse);
    console.info("[api/clientes/index] handler:done", {
      method: nodeRequest.method,
      url: nodeRequest.url,
      statusCode: nodeResponse.statusCode,
    });
    return nodeResponse.toResponse();
  } catch (error) {
    const detail =
      error instanceof Error ? error.message : "Error desconocido";

    console.error("[api/clientes/index] handler:error", {
      method: nodeRequest.method,
      url: nodeRequest.url,
      detail,
      ...(error instanceof Error && error.stack ? { stack: error.stack } : {}),
    });

    if (!nodeResponse.headersSent) {
      return new Response(
        JSON.stringify({ error: "Error interno en /api/clientes", detail }),
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
