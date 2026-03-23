import { handleProspectosCollection } from "./_prospectos-api.js";
import {
  createNodeRequestFromWebRequest,
  createNodeResponseCapture,
  type RuntimeRequest,
} from "../clientes/_web-response-bridge.js";

export const config = {
  runtime: "nodejs",
};

export default async function handler(request: RuntimeRequest) {
  console.info("[api/prospectos/index] handler:start", {
    method: request.method,
    url: request.url,
  });

  const nodeRequest = await createNodeRequestFromWebRequest(request);
  const nodeResponse = createNodeResponseCapture();

  try {
    await handleProspectosCollection(nodeRequest, nodeResponse.nodeResponse);
    console.info("[api/prospectos/index] handler:done", {
      method: nodeRequest.method,
      url: nodeRequest.url,
      statusCode: nodeResponse.statusCode,
    });
    return nodeResponse.toResponse();
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Error desconocido";

    console.error("[api/prospectos/index] handler:error", {
      method: nodeRequest.method,
      url: nodeRequest.url,
      detail,
      ...(error instanceof Error && error.stack ? { stack: error.stack } : {}),
    });

    if (!nodeResponse.headersSent) {
      return new Response(
        JSON.stringify({ error: "Error interno en /api/prospectos", detail }),
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
