import type {
  IncomingHttpHeaders,
  IncomingMessage,
  ServerResponse,
} from "node:http";

type NodeRequest = IncomingMessage & {
  body?: unknown;
};

export type RuntimeRequest = Request | NodeRequest;

type NodeResponseCapture = {
  readonly headersSent: boolean;
  readonly nodeResponse: ServerResponse;
  readonly statusCode: number;
  toResponse(): Response;
};

const METHODS_WITHOUT_BODY = new Set(["DELETE", "GET", "HEAD"]);

function shouldReadBody(method?: string) {
  return !METHODS_WITHOUT_BODY.has((method ?? "").toUpperCase());
}

function isWebRequest(request: RuntimeRequest): request is Request {
  return typeof (request as Request).text === "function";
}

function isAsyncIterableRequest(
  request: RuntimeRequest
): request is NodeRequest & AsyncIterable<unknown> {
  return (
    typeof (request as AsyncIterable<unknown>)[Symbol.asyncIterator] ===
    "function"
  );
}

function hasBodyProperty(
  request: NodeRequest
): request is NodeRequest & { body: unknown } {
  return "body" in request;
}

function normalizeBodyValue(body: unknown) {
  if (body === undefined || body === null) {
    return "";
  }

  if (
    typeof body === "string" ||
    Buffer.isBuffer(body) ||
    typeof body === "object"
  ) {
    return body;
  }

  return JSON.stringify(body);
}

function getRequestHeaders(
  request: RuntimeRequest
): IncomingHttpHeaders | Record<string, string> {
  if (isWebRequest(request)) {
    return Object.fromEntries(request.headers.entries());
  }

  return request.headers ?? {};
}

async function readRequestBody(request: RuntimeRequest): Promise<unknown> {
  if (!shouldReadBody(request.method)) {
    return undefined;
  }

  if (isWebRequest(request)) {
    return await request.text();
  }

  if (hasBodyProperty(request)) {
    return normalizeBodyValue(request.body);
  }

  if (!isAsyncIterableRequest(request)) {
    return "";
  }

  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    if (Buffer.isBuffer(chunk)) {
      chunks.push(chunk);
      continue;
    }

    if (chunk instanceof Uint8Array) {
      chunks.push(Buffer.from(chunk));
      continue;
    }

    chunks.push(Buffer.from(String(chunk)));
  }

  return chunks.length > 0 ? Buffer.concat(chunks) : Buffer.alloc(0);
}

export async function createNodeRequestFromWebRequest(
  request: RuntimeRequest
): Promise<NodeRequest> {
  const body = await readRequestBody(request);

  return {
    body,
    headers: getRequestHeaders(request),
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
