import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import fs from "node:fs";
import path from "node:path";
import {
  getClienteIdFromRequestUrl,
  handleClienteItem,
  handleClientesCollection,
} from "./clientes-api.js";
import {
  getProspectoIdFromRequestUrl,
  handleProspectoItem,
  handleProspectosCollection,
} from "./prospectos-api.js";

type CorsConfig = {
  allowHeaders: string;
  allowMethods: string;
  allowOrigin: string;
  isWildcard: boolean;
};

function loadLocalEnvFile() {
  const envCandidates = [
    path.resolve(process.cwd(), ".env"),
    path.resolve(import.meta.dirname, "..", ".env"),
    path.resolve(import.meta.dirname, "..", "..", ".env"),
  ];

  const envPath = envCandidates.find(candidate => fs.existsSync(candidate));

  if (!envPath) {
    return;
  }

  const raw = fs.readFileSync(envPath, "utf-8");

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");

    if (separatorIndex <= 0) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();

    if (!key || process.env[key] !== undefined) {
      continue;
    }

    const unquotedValue =
      (rawValue.startsWith('"') && rawValue.endsWith('"')) ||
      (rawValue.startsWith("'") && rawValue.endsWith("'"))
        ? rawValue.slice(1, -1)
        : rawValue;

    process.env[key] = unquotedValue;
  }
}

function getAllowedOrigins() {
  const configuredOrigins = process.env.CORS_ALLOWED_ORIGINS?.trim();

  if (!configuredOrigins) {
    return null;
  }

  return configuredOrigins
    .split(",")
    .map(origin => origin.trim())
    .filter(Boolean);
}

function resolveCorsConfig(req: IncomingMessage): CorsConfig {
  const requestOrigin = req.headers.origin;
  const allowedOrigins = getAllowedOrigins();

  if (!allowedOrigins || allowedOrigins.includes("*")) {
    return {
      allowHeaders: "Content-Type, Authorization",
      allowMethods: "GET, POST, PUT, DELETE, OPTIONS",
      allowOrigin: "*",
      isWildcard: true,
    };
  }

  if (requestOrigin && allowedOrigins.includes(requestOrigin)) {
    return {
      allowHeaders: "Content-Type, Authorization",
      allowMethods: "GET, POST, PUT, DELETE, OPTIONS",
      allowOrigin: requestOrigin,
      isWildcard: false,
    };
  }

  return {
    allowHeaders: "Content-Type, Authorization",
    allowMethods: "GET, POST, PUT, DELETE, OPTIONS",
    allowOrigin: allowedOrigins[0],
    isWildcard: false,
  };
}

function setCorsHeaders(req: IncomingMessage, res: ServerResponse) {
  const corsConfig = resolveCorsConfig(req);

  res.setHeader("Access-Control-Allow-Headers", corsConfig.allowHeaders);
  res.setHeader("Access-Control-Allow-Methods", corsConfig.allowMethods);
  res.setHeader("Access-Control-Allow-Origin", corsConfig.allowOrigin);

  if (!corsConfig.isWildcard) {
    res.setHeader("Vary", "Origin");
  }
}

function getPathname(urlValue?: string) {
  return new URL(urlValue ?? "/", "http://localhost").pathname;
}

function sendJson(res: ServerResponse, statusCode: number, payload: unknown) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

async function requestHandler(req: IncomingMessage, res: ServerResponse) {
  setCorsHeaders(req, res);

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  const pathname = getPathname(req.url);

  if (pathname === "/" || pathname === "/health") {
    sendJson(res, 200, {
      service: "sig-agroindustrial-api",
      ok: true,
      timestamp: new Date().toISOString(),
    });
    return;
  }

  if (pathname === "/api/clientes" || pathname === "/api/clientes/") {
    await handleClientesCollection(req, res);
    return;
  }

  const clienteId = getClienteIdFromRequestUrl(req.url);

  if (clienteId) {
    await handleClienteItem(req, res, clienteId);
    return;
  }

  if (pathname === "/api/prospectos" || pathname === "/api/prospectos/") {
    await handleProspectosCollection(req, res);
    return;
  }

  const prospectoId = getProspectoIdFromRequestUrl(req.url);

  if (prospectoId) {
    await handleProspectoItem(req, res, prospectoId);
    return;
  }

  sendJson(res, 404, {
    error: "Ruta no encontrada",
    detail: `No existe la ruta ${pathname}`,
  });
}

loadLocalEnvFile();

const port = Number(process.env.PORT || 8080);

createServer((req, res) => {
  void requestHandler(req, res).catch(error => {
    console.error("[server/http] request:error", {
      detail: error instanceof Error ? error.message : "Error desconocido",
      method: req.method,
      url: req.url,
      ...(error instanceof Error && error.stack ? { stack: error.stack } : {}),
    });

    if (!res.headersSent) {
      setCorsHeaders(req, res);
      sendJson(res, 500, {
        error: "Error interno",
        detail:
          error instanceof Error
            ? error.message
            : "No se pudo procesar la solicitud",
      });
      return;
    }

    res.end();
  });
}).listen(port, "0.0.0.0", () => {
  console.info("[server/http] listening", { port });
});
