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

function hasHeadersEntries(
  request: RuntimeRequest
): request is RuntimeRequest & { headers: Headers } {
  return typeof (request as { headers?: Headers }).headers?.entries === "function";
}

function hasRequestText(
  request: RuntimeRequest
): request is RuntimeRequest & Pick<Request, "text"> {
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

function isPlainObject(body: unknown): body is Record<string, unknown> {
  if (!body || typeof body !== "object") {
    return false;
  }

  const prototype = Object.getPrototypeOf(body);
  return prototype === Object.prototype || prototype === null;
}

function getRequestHeaders(
  request: RuntimeRequest
): IncomingHttpHeaders | Record<string, string> {
  if (hasHeadersEntries(request)) {
    return Object.fromEntries(request.headers.entries());
  }

  return (request as NodeRequest).headers ?? {};
}

function isNodeStreamRequest(
  request: RuntimeRequest
): request is NodeRequest & {
  on: IncomingMessage["on"];
  off?: IncomingMessage["off"];
} {
  return typeof (request as IncomingMessage).on === "function";
}

async function readAsyncIterableBody(
  request: AsyncIterable<unknown>
): Promise<string> {
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

  return chunks.length > 0 ? Buffer.concat(chunks).toString("utf-8") : "";
}

function readNodeStreamBody(
  request: NodeRequest & {
    on: IncomingMessage["on"];
    off?: IncomingMessage["off"];
  }
): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];

    const cleanup = () => {
      if (typeof request.off === "function") {
        request.off("data", handleData);
        request.off("end", handleEnd);
        request.off("error", handleError);
      }
    };

    const handleData = (chunk: unknown) => {
      if (Buffer.isBuffer(chunk)) {
        chunks.push(chunk);
        return;
      }

      if (chunk instanceof Uint8Array) {
        chunks.push(Buffer.from(chunk));
        return;
      }

      chunks.push(Buffer.from(String(chunk)));
    };

    const handleEnd = () => {
      cleanup();
      resolve(chunks.length > 0 ? Buffer.concat(chunks).toString("utf-8") : "");
    };

    const handleError = (error: Error) => {
      cleanup();
      reject(error);
    };

    request.on("data", handleData);
    request.on("end", handleEnd);
    request.on("error", handleError);
  });
}

async function readBodySafe(request: RuntimeRequest): Promise<string> {
  if (!shouldReadBody(request.method)) {
    return "";
  }

  if (hasRequestText(request)) {
    return await request.text();
  }

  if (hasBodyProperty(request)) {
    if (typeof request.body === "string") {
      return request.body;
    }

    if (Buffer.isBuffer(request.body)) {
      return request.body.toString("utf-8");
    }

    if (request.body instanceof Uint8Array) {
      return Buffer.from(request.body).toString("utf-8");
    }

    if (isPlainObject(request.body)) {
      return JSON.stringify(request.body);
    }

    if (request.body === undefined || request.body === null) {
      return "";
    }
  }

  if (isNodeStreamRequest(request)) {
    return await readNodeStreamBody(request);
  }

  if (isAsyncIterableRequest(request)) {
    return await readAsyncIterableBody(request);
  }

  return "";
}

export async function createNodeRequestFromWebRequest(
  request: RuntimeRequest
): Promise<NodeRequest> {
  const body = await readBodySafe(request);

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
