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
  getCotizacionIdFromRequestUrl,
  handleCotizacionItem,
  handleCotizacionesCollection,
} from "./cotizaciones-api.js";
import { handleDashboardSummary } from "./dashboard-api.js";
import {
  getVisitaIdFromRequestUrl,
  handleVisitaItem,
  handleVisitasCollection,
} from "./visitas-api.js";
import {
  getSeguimientoIdFromRequestUrl,
  handleSeguimientoItem,
  handleSeguimientosCollection,
} from "./seguimientos-api.js";
import {
  handleAuthRoute,
  isProtectedApiPath,
  requireAuthorizedApiRequest,
} from "./auth-api.js";
import {
  getProspectoIdFromRequestUrl,
  handleProspectoItem,
  handleProspectosCollection,
} from "./prospectos-api.js";
import {
  getSertecIdFromRequestUrl,
  handleSertecCollection,
  handleSertecItem,
} from "./sertec-api.js";
import {
  getContableTerceroIdFromRequestUrl,
  handleContableTerceroItem,
  handleContableTercerosCollection,
} from "./contable-terceros-api.js";
import {
  getFacturaCompraIdFromRequestUrl,
  handleFacturaCompraItem,
  handleFacturasCompraCollection,
} from "./contable-facturas-compra-api.js";
import {
  getContableNotaCreditoIdFromRequestUrl,
  handleContableNotaCreditoItem,
  handleContableNotasCreditoCollection,
} from "./contable-notas-credito-api.js";
import { handleContableCuadresCajaCollection } from "./contable-cuadres-caja-api.js";
import { handleContableNominaCollection } from "./contable-nomina-api.js";
import {
  getEgresoIdFromRequestUrl,
  handleEgresoItem,
  handleEgresosCollection,
} from "./contable-egresos-api.js";
import {
  getReciboCajaIdFromRequestUrl,
  handleReciboCajaItem,
  handleRecibosCajaCollection,
} from "./contable-recibos-caja-api.js";
import {
  handleCarteraClientesCollection,
  handleCarteraProveedoresCollection,
} from "./contable-cartera-api.js";
import {
  getContableCuentaBancariaIdFromRequestUrl,
  handleContableBancoItem,
  handleContableBancosCollection,
} from "./contable-bancos-api.js";
import {
  getContableViaticoIdFromRequestUrl,
  handleContableViaticosCollection,
  handleContableViaticoItem,
} from "./contable-viaticos-api.js";
import { handleContableArchivoCollection } from "./contable-archivo-api.js";
import { handleContableReportesCollection } from "./contable-reportes-api.js";
import { handleUsersCollection } from "./users-api.js";

type CorsConfig = {
  allowCredentials: boolean;
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
      allowCredentials: false,
      allowHeaders: "Content-Type, Authorization",
      allowMethods: "GET, POST, PUT, DELETE, OPTIONS",
      allowOrigin: "*",
      isWildcard: true,
    };
  }

  if (requestOrigin && allowedOrigins.includes(requestOrigin)) {
    return {
      allowCredentials: true,
      allowHeaders: "Content-Type, Authorization",
      allowMethods: "GET, POST, PUT, DELETE, OPTIONS",
      allowOrigin: requestOrigin,
      isWildcard: false,
    };
  }

  return {
    allowCredentials: true,
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

  if (corsConfig.allowCredentials) {
    res.setHeader("Access-Control-Allow-Credentials", "true");
  }

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

  if (await handleAuthRoute(req, res)) {
    return;
  }

  if (isProtectedApiPath(pathname)) {
    const authenticatedUser = await requireAuthorizedApiRequest(
      req,
      res,
      pathname
    );

    if (!authenticatedUser) {
      return;
    }
  }

  if (pathname === "/api/users" || pathname === "/api/users/") {
    await handleUsersCollection(req, res);
    return;
  }

  if (pathname === "/api/dashboard" || pathname === "/api/dashboard/") {
    await handleDashboardSummary(req, res);
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

  if (pathname === "/api/cotizaciones" || pathname === "/api/cotizaciones/") {
    await handleCotizacionesCollection(req, res);
    return;
  }

  const cotizacionId = getCotizacionIdFromRequestUrl(req.url);

  if (cotizacionId) {
    await handleCotizacionItem(req, res, cotizacionId);
    return;
  }

  if (pathname === "/api/visitas" || pathname === "/api/visitas/") {
    await handleVisitasCollection(req, res);
    return;
  }

  const visitaId = getVisitaIdFromRequestUrl(req.url);

  if (visitaId) {
    await handleVisitaItem(req, res, visitaId);
    return;
  }

  if (pathname === "/api/seguimientos" || pathname === "/api/seguimientos/") {
    await handleSeguimientosCollection(req, res);
    return;
  }

  const seguimientoId = getSeguimientoIdFromRequestUrl(req.url);

  if (seguimientoId) {
    await handleSeguimientoItem(req, res, seguimientoId);
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

  if (pathname === "/api/sertec" || pathname === "/api/sertec/") {
    await handleSertecCollection(req, res);
    return;
  }

  const sertecId = getSertecIdFromRequestUrl(req.url);

  if (sertecId) {
    await handleSertecItem(req, res, sertecId);
    return;
  }

  if (
    pathname === "/api/contable/terceros" ||
    pathname === "/api/contable/terceros/"
  ) {
    await handleContableTercerosCollection(req, res);
    return;
  }

  const contableTerceroId = getContableTerceroIdFromRequestUrl(req.url);

  if (contableTerceroId) {
    await handleContableTerceroItem(req, res, contableTerceroId);
    return;
  }

  if (
    pathname === "/api/contable/facturas-compra" ||
    pathname === "/api/contable/facturas-compra/"
  ) {
    await handleFacturasCompraCollection(req, res);
    return;
  }

  const facturaCompraId = getFacturaCompraIdFromRequestUrl(req.url);

  if (facturaCompraId) {
    await handleFacturaCompraItem(req, res, facturaCompraId);
    return;
  }

  if (
    pathname === "/api/contable/notas-credito" ||
    pathname === "/api/contable/notas-credito/"
  ) {
    await handleContableNotasCreditoCollection(req, res);
    return;
  }

  const notaCreditoId = getContableNotaCreditoIdFromRequestUrl(req.url);

  if (notaCreditoId) {
    await handleContableNotaCreditoItem(req, res, notaCreditoId);
    return;
  }

  if (
    pathname === "/api/contable/cuadres-caja" ||
    pathname === "/api/contable/cuadres-caja/"
  ) {
    await handleContableCuadresCajaCollection(req, res);
    return;
  }

  if (pathname === "/api/contable/nomina" || pathname === "/api/contable/nomina/") {
    await handleContableNominaCollection(req, res);
    return;
  }

  if (pathname === "/api/contable/egresos" || pathname === "/api/contable/egresos/") {
    await handleEgresosCollection(req, res);
    return;
  }

  const egresoId = getEgresoIdFromRequestUrl(req.url);

  if (egresoId) {
    await handleEgresoItem(req, res, egresoId);
    return;
  }

  if (
    pathname === "/api/contable/recibos-caja" ||
    pathname === "/api/contable/recibos-caja/"
  ) {
    await handleRecibosCajaCollection(req, res);
    return;
  }

  const reciboCajaId = getReciboCajaIdFromRequestUrl(req.url);

  if (reciboCajaId) {
    await handleReciboCajaItem(req, res, reciboCajaId);
    return;
  }

  if (
    pathname === "/api/contable/cartera-proveedores" ||
    pathname === "/api/contable/cartera-proveedores/"
  ) {
    await handleCarteraProveedoresCollection(req, res);
    return;
  }

  if (
    pathname === "/api/contable/cartera-clientes" ||
    pathname === "/api/contable/cartera-clientes/"
  ) {
    await handleCarteraClientesCollection(req, res);
    return;
  }

  if (
    pathname === "/api/contable/reportes" ||
    pathname === "/api/contable/reportes/"
  ) {
    await handleContableReportesCollection(req, res);
    return;
  }

  if (
    pathname === "/api/contable/archivo" ||
    pathname === "/api/contable/archivo/"
  ) {
    await handleContableArchivoCollection(req, res);
    return;
  }

  if (
    pathname === "/api/contable/bancos" ||
    pathname === "/api/contable/bancos/"
  ) {
    await handleContableBancosCollection(req, res);
    return;
  }

  const cuentaBancariaId = getContableCuentaBancariaIdFromRequestUrl(req.url);

  if (cuentaBancariaId) {
    await handleContableBancoItem(req, res, cuentaBancariaId);
    return;
  }

  if (
    pathname === "/api/contable/viaticos" ||
    pathname === "/api/contable/viaticos/"
  ) {
    await handleContableViaticosCollection(req, res);
    return;
  }

  const contableViaticoId = getContableViaticoIdFromRequestUrl(req.url);

  if (contableViaticoId) {
    await handleContableViaticoItem(req, res, contableViaticoId);
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
