import type { IncomingMessage, ServerResponse } from "node:http";
import { requireAdminRequest } from "./auth-api.js";
import { createUser, isUserValidationError, listUsers } from "./users-service.js";

type NodeRequest = IncomingMessage & {
  body?: unknown;
};

type ConnectNext = (error?: unknown) => void;

function setJsonHeaders(res: ServerResponse) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
}

function sendJson(
  res: ServerResponse,
  statusCode: number,
  payload: unknown
): void {
  res.statusCode = statusCode;
  setJsonHeaders(res);
  res.end(JSON.stringify(payload));
}

function sendErrorJson(
  res: ServerResponse,
  statusCode: number,
  error: string,
  detail: string
) {
  sendJson(res, statusCode, { error, detail });
}

function sendMethodNotAllowed(
  res: ServerResponse,
  allowedMethods: readonly string[]
) {
  res.setHeader("Allow", allowedMethods.join(", "));
  sendErrorJson(
    res,
    405,
    "Metodo no permitido",
    `Metodos permitidos: ${allowedMethods.join(", ")}`
  );
}

async function readJsonBody(req: NodeRequest): Promise<unknown> {
  if (typeof req.body === "string") {
    return req.body.trim() ? JSON.parse(req.body) : {};
  }

  if (Buffer.isBuffer(req.body)) {
    const rawBufferBody = req.body.toString("utf-8").trim();
    return rawBufferBody ? JSON.parse(rawBufferBody) : {};
  }

  if (req.body && typeof req.body === "object") {
    return req.body;
  }

  const chunks: Buffer[] = [];

  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (chunks.length === 0) {
    return {};
  }

  const rawBody = Buffer.concat(chunks).toString("utf-8").trim();
  return rawBody ? JSON.parse(rawBody) : {};
}

function getPathname(urlValue?: string) {
  return new URL(urlValue ?? "/", "http://localhost").pathname;
}

export async function handleUsersCollection(
  req: NodeRequest,
  res: ServerResponse
) {
  try {
    const adminUser = await requireAdminRequest(req, res);

    if (!adminUser) {
      return;
    }

    if (req.method === "GET") {
      const users = await listUsers();
      sendJson(res, 200, users);
      return;
    }

    if (req.method === "POST") {
      const payload = await readJsonBody(req);
      const user = await createUser(payload);
      sendJson(res, 201, user);
      return;
    }

    sendMethodNotAllowed(res, ["GET", "POST"]);
  } catch (error) {
    const statusCode = isUserValidationError(error) ? 400 : 500;
    const detail =
      error instanceof Error
        ? error.message
        : "No se pudo procesar la solicitud";

    sendErrorJson(
      res,
      statusCode,
      statusCode === 400 ? "Solicitud invalida" : "Error interno",
      detail
    );
  }
}

export function createUsersDevMiddleware() {
  return (req: NodeRequest, res: ServerResponse, next: ConnectNext) => {
    const pathname = getPathname(req.url);

    if (pathname === "/api/users" || pathname === "/api/users/") {
      void handleUsersCollection(req, res).catch(next);
      return;
    }

    next();
  };
}
