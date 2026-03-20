import type { IncomingMessage, ServerResponse } from "node:http";

type NodeRequest = IncomingMessage & {
  body?: unknown;
};

type NodeResponseCapture = {
  readonly headersSent: boolean;
  readonly nodeResponse: ServerResponse;
  readonly statusCode: number;
  toResponse(): Response;
};

export async function createNodeRequestFromWebRequest(
  request: Request
): Promise<NodeRequest> {
  const body = await request.text();

  return {
    body,
    headers: Object.fromEntries(request.headers.entries()),
    method: request.method,
    url: request.url,
  } as NodeRequest;
}

export function createNodeResponseCapture(): NodeResponseCapture {
  const headers = new Headers();
  let body: BodyInit | null = null;
  let headersSent = false;
  let statusCode = 200;

  const nodeResponse = {
    end: (chunk?: string | Buffer | Uint8Array | null) => {
      headersSent = true;
      body = chunk ?? null;
      return nodeResponse;
    },
    get headersSent() {
      return headersSent;
    },
    setHeader: (
      name: string,
      value: number | string | readonly string[]
    ) => {
      headers.delete(name);

      if (Array.isArray(value)) {
        for (const item of value) {
          headers.append(name, String(item));
        }
      } else {
        headers.set(name, String(value));
      }

      return nodeResponse;
    },
    get statusCode() {
      return statusCode;
    },
    set statusCode(value: number) {
      statusCode = value;
    },
  } as unknown as ServerResponse;

  return {
    get headersSent() {
      return headersSent;
    },
    nodeResponse,
    get statusCode() {
      return statusCode;
    },
    toResponse() {
      return new Response(body, {
        headers,
        status: statusCode,
      });
    },
  };
}
