import type { IncomingMessage, ServerResponse } from "node:http";
import {
  buildClearSessionCookie,
  buildSessionCookie,
  createSessionToken,
  getCookieValue,
  SESSION_COOKIE_NAME,
  verifyPassword,
  verifySessionToken,
} from "./auth-utils.js";
import {
  findUserRowByEmail,
  findUserRowById,
  recordUserLogin,
  toAuthUser,
  updateUserVisualPreferences,
  isUserValidationError,
} from "./users-service.js";
import { canAccessApiPath } from "./access-control.js";

type NodeRequest = IncomingMessage & {
  body?: unknown;
};

type ConnectNext = (error?: unknown) => void;

type AuthPayload = {
  email?: string;
  password?: string;
};

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

function readString(value: unknown) {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function readAuthPayload(payload: unknown): Required<AuthPayload> {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Cuerpo de solicitud invalido");
  }

  const email = readString((payload as AuthPayload).email);
  const password = readString((payload as AuthPayload).password);

  if (!email || !password) {
    throw new Error("Email y contrasena son obligatorios");
  }

  return { email, password };
}

function isAuthValidationError(error: unknown) {
  return (
    error instanceof Error &&
    /obligatorios|invalido|solicitud/i.test(error.message)
  );
}

export function isProtectedApiPath(pathname: string) {
  return (
    pathname === "/api/users" ||
    pathname === "/api/users/" ||
    pathname === "/api/dashboard" ||
    pathname === "/api/dashboard/" ||
    pathname.startsWith("/api/contable") ||
    pathname.startsWith("/api/clientes") ||
    pathname.startsWith("/api/cotizaciones") ||
    pathname.startsWith("/api/inventario") ||
    pathname.startsWith("/api/seguimientos") ||
    pathname.startsWith("/api/visitas") ||
    pathname.startsWith("/api/prospectos") ||
    pathname.startsWith("/api/sertec")
  );
}

export async function getAuthenticatedUser(req: NodeRequest) {
  const sessionToken = getCookieValue(req.headers, SESSION_COOKIE_NAME);

  if (!sessionToken) {
    return null;
  }

  const session = verifySessionToken(sessionToken);

  if (!session?.sub) {
    return null;
  }

  const user = await findUserRowById(session.sub);

  if (!user || !user.activo) {
    return null;
  }

  return toAuthUser(user);
}

export async function requireAuthenticatedRequest(
  req: NodeRequest,
  res: ServerResponse
) {
  const user = await getAuthenticatedUser(req);

  if (!user) {
    sendErrorJson(
      res,
      401,
      "No autenticado",
      "Debes iniciar sesion para continuar"
    );
    return null;
  }

  return user;
}

export async function requireAuthorizedApiRequest(
  req: NodeRequest,
  res: ServerResponse,
  pathname?: string
) {
  const user = await requireAuthenticatedRequest(req, res);

  if (!user) {
    return null;
  }

  const resolvedPathname = pathname ?? getPathname(req.url);

  if (!canAccessApiPath(user.rol, resolvedPathname)) {
    sendErrorJson(
      res,
      403,
      "Acceso denegado",
      "Tu rol no tiene permiso para acceder a este recurso"
    );
    return null;
  }

  return user;
}

export async function requireAdminRequest(
  req: NodeRequest,
  res: ServerResponse
) {
  const user = await requireAuthenticatedRequest(req, res);

  if (!user) {
    return null;
  }

  if (user.rol !== "admin") {
    sendErrorJson(
      res,
      403,
      "Acceso denegado",
      "Solo un usuario admin puede realizar esta accion"
    );
    return null;
  }

  return user;
}

export async function handleAuthLogin(req: NodeRequest, res: ServerResponse) {
  try {
    if (req.method !== "POST") {
      sendMethodNotAllowed(res, ["POST"]);
      return;
    }

    const payload = readAuthPayload(await readJsonBody(req));
    const user = await findUserRowByEmail(payload.email);

    if (!user || !user.activo) {
      sendErrorJson(
        res,
        401,
        "Credenciales invalidas",
        "Email o contrasena incorrectos"
      );
      return;
    }

    const isValidPassword = await verifyPassword(
      payload.password,
      user.password_hash
    );

    if (!isValidPassword) {
      sendErrorJson(
        res,
        401,
        "Credenciales invalidas",
        "Email o contrasena incorrectos"
      );
      return;
    }

    const authUser = await recordUserLogin(user.id);

    if (!authUser) {
      throw new Error("No se pudo actualizar el ultimo acceso del usuario");
    }

    const sessionToken = createSessionToken(authUser.id);
    res.setHeader("Set-Cookie", buildSessionCookie(req, sessionToken));
    sendJson(res, 200, authUser);
  } catch (error) {
    const statusCode = isAuthValidationError(error) ? 400 : 500;
    const detail =
      error instanceof Error ? error.message : "No se pudo iniciar sesion";

    sendErrorJson(
      res,
      statusCode,
      statusCode === 400 ? "Solicitud invalida" : "Error interno",
      detail
    );
  }
}

export async function handleAuthLogout(req: NodeRequest, res: ServerResponse) {
  if (req.method !== "POST") {
    sendMethodNotAllowed(res, ["POST"]);
    return;
  }

  res.setHeader("Set-Cookie", buildClearSessionCookie(req));
  sendJson(res, 200, { ok: true });
}

export async function handleAuthMe(req: NodeRequest, res: ServerResponse) {
  if (req.method !== "GET") {
    sendMethodNotAllowed(res, ["GET"]);
    return;
  }

  const user = await requireAuthenticatedRequest(req, res);

  if (!user) {
    return;
  }

  sendJson(res, 200, user);
}

export async function handleAuthPreferences(
  req: NodeRequest,
  res: ServerResponse
) {
  try {
    if (req.method !== "PUT") {
      sendMethodNotAllowed(res, ["PUT"]);
      return;
    }

    const user = await requireAuthenticatedRequest(req, res);

    if (!user) {
      return;
    }

    const payload = await readJsonBody(req);
    const updatedUser = await updateUserVisualPreferences(user.id, payload);

    if (!updatedUser) {
      throw new Error("No se pudo actualizar la configuracion visual");
    }

    sendJson(res, 200, updatedUser);
  } catch (error) {
    const statusCode =
      isAuthValidationError(error) || isUserValidationError(error) ? 400 : 500;
    const detail =
      error instanceof Error
        ? error.message
        : "No se pudo actualizar la configuracion visual";

    sendErrorJson(
      res,
      statusCode,
      statusCode === 400 ? "Solicitud invalida" : "Error interno",
      detail
    );
  }
}

export async function handleAuthRoute(req: NodeRequest, res: ServerResponse) {
  const pathname = getPathname(req.url);

  if (pathname === "/api/auth/login") {
    await handleAuthLogin(req, res);
    return true;
  }

  if (pathname === "/api/auth/logout") {
    await handleAuthLogout(req, res);
    return true;
  }

  if (pathname === "/api/auth/me") {
    await handleAuthMe(req, res);
    return true;
  }

  if (pathname === "/api/auth/preferences") {
    await handleAuthPreferences(req, res);
    return true;
  }

  return false;
}

export function createAuthDevMiddleware() {
  return (req: NodeRequest, res: ServerResponse, next: ConnectNext) => {
    const pathname = getPathname(req.url);

    if (!pathname.startsWith("/api/auth/")) {
      next();
      return;
    }

    void handleAuthRoute(req, res)
      .then(handled => {
        if (!handled) {
          next();
        }
      })
      .catch(next);
  };
}

export function createProtectedApiDevMiddleware() {
  return (req: NodeRequest, res: ServerResponse, next: ConnectNext) => {
    const pathname = getPathname(req.url);

    if (!isProtectedApiPath(pathname)) {
      next();
      return;
    }

    void requireAuthorizedApiRequest(req, res, pathname)
      .then(user => {
        if (!user) {
          return;
        }

        next();
      })
      .catch(next);
  };
}
