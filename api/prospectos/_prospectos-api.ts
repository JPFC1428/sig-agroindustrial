import type { IncomingMessage, ServerResponse } from "node:http";
import { nanoid } from "nanoid";
import { getSql } from "./_neon.js";

type ProspectoEstadoValue =
  | "nuevo"
  | "contactado"
  | "interesado"
  | "negociacion"
  | "ganado"
  | "perdido";

type ProspectoFuenteValue =
  | "referencia"
  | "web"
  | "evento"
  | "llamada_fria"
  | "otro";

type ProspectoApiRecord = {
  id: string;
  nombre: string;
  empresa: string;
  email: string;
  telefono: string;
  ciudad: string;
  departamento: string;
  contactoPrincipal: string;
  cargoContacto: string;
  estado: ProspectoEstadoValue;
  fuente: ProspectoFuenteValue;
  fechaCaptura: string;
  proximoSeguimiento?: string;
  probabilidadConversion: number;
  montoEstimado?: number;
  notas?: string;
  asignadoA?: string;
};

type NodeRequest = IncomingMessage & {
  body?: unknown;
};

type ConnectNext = (error?: unknown) => void;

type ProspectoRow = {
  id: string;
  nombre: string;
  empresa: string;
  email: string;
  telefono: string;
  ciudad: string;
  departamento: string;
  contacto_principal: string;
  cargo_contacto: string;
  estado: ProspectoEstadoValue;
  fuente: ProspectoFuenteValue;
  fecha_captura: string | Date;
  proximo_seguimiento: string | Date | null;
  probabilidad_conversion: number | string;
  monto_estimado: number | string | null;
  notas: string | null;
  asignado_a: string | null;
};

const PROSPECTO_ESTADOS = new Set<ProspectoEstadoValue>([
  "nuevo",
  "contactado",
  "interesado",
  "negociacion",
  "ganado",
  "perdido",
]);

const PROSPECTO_FUENTES = new Set<ProspectoFuenteValue>([
  "referencia",
  "web",
  "evento",
  "llamada_fria",
  "otro",
]);

const PROSPECTOS_API_LOG_PREFIX = "[api/prospectos/_prospectos-api]";

function logProspectosInfo(
  message: string,
  metadata?: Record<string, unknown>
) {
  if (metadata) {
    console.info(PROSPECTOS_API_LOG_PREFIX, message, metadata);
    return;
  }

  console.info(PROSPECTOS_API_LOG_PREFIX, message);
}

function logProspectosError(
  message: string,
  error: unknown,
  metadata?: Record<string, unknown>
) {
  console.error(PROSPECTOS_API_LOG_PREFIX, message, {
    ...(metadata ?? {}),
    detail: getErrorMessage(error, "Error desconocido"),
    ...(error instanceof Error && error.stack ? { stack: error.stack } : {}),
  });
}

function getPayloadKeys(payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return [];
  }

  return Object.keys(payload as Record<string, unknown>);
}

function hasOwnField(payload: Record<string, unknown>, field: string) {
  return Object.prototype.hasOwnProperty.call(payload, field);
}

function readString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function readOptionalString(
  value: unknown,
  fallback?: string
): string | undefined {
  if (value === undefined) {
    return fallback;
  }

  if (value === null) {
    return undefined;
  }

  return readString(value);
}

function readNumber(value: unknown, fallback: number): number {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  const numberValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
}

function readOptionalNumber(
  value: unknown,
  errorMessage: string
): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || value === "") {
    return undefined;
  }

  const numberValue = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(numberValue)) {
    throw new Error(errorMessage);
  }

  return numberValue;
}

function readDate(
  value: string | Date | null | undefined,
  fallback: Date | undefined
): Date | undefined {
  if (value === undefined) {
    return fallback;
  }

  if (value === null || value === "") {
    return undefined;
  }

  const date = value instanceof Date ? new Date(value) : new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date;
}

function assertPayload(
  payload: unknown
): asserts payload is Record<string, unknown> {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Cuerpo de solicitud invalido");
  }
}

function parseDateValue(value: string | Date): Date {
  const parsed = value instanceof Date ? new Date(value) : new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Fecha invalida en la base de datos");
  }

  return parsed;
}

function mapProspectoRow(row: ProspectoRow): ProspectoApiRecord {
  try {
    const fechaCaptura = parseDateValue(row.fecha_captura);
    const proximoSeguimiento = row.proximo_seguimiento
      ? parseDateValue(row.proximo_seguimiento)
      : undefined;
    const montoEstimado =
      row.monto_estimado === null
        ? undefined
        : readNumber(row.monto_estimado, 0);

    return {
      id: row.id,
      nombre: row.nombre,
      empresa: row.empresa,
      email: row.email ?? "",
      telefono: row.telefono ?? "",
      ciudad: row.ciudad,
      departamento: row.departamento ?? "",
      contactoPrincipal: row.contacto_principal ?? "",
      cargoContacto: row.cargo_contacto ?? "",
      estado: row.estado,
      fuente: row.fuente,
      fechaCaptura: fechaCaptura.toISOString(),
      ...(proximoSeguimiento
        ? { proximoSeguimiento: proximoSeguimiento.toISOString() }
        : {}),
      probabilidadConversion: Math.round(
        readNumber(row.probabilidad_conversion, 0)
      ),
      ...(montoEstimado !== undefined ? { montoEstimado } : {}),
      ...(row.notas ? { notas: row.notas } : {}),
      ...(row.asignado_a ? { asignadoA: row.asignado_a } : {}),
    };
  } catch (error) {
    logProspectosError("mapProspectoRow:error", error, { id: row.id });
    throw error;
  }
}

function buildProspecto(payload: unknown, existing?: ProspectoApiRecord) {
  logProspectosInfo("buildProspecto:start", {
    existingId: existing?.id ?? null,
    payloadKeys: getPayloadKeys(payload),
  });

  try {
    assertPayload(payload);

    const nombre = readString(payload.nombre) ?? existing?.nombre ?? "";
    const empresa = readString(payload.empresa) ?? existing?.empresa ?? "";
    const email = readOptionalString(payload.email, existing?.email) ?? "";
    const telefono =
      readOptionalString(payload.telefono, existing?.telefono) ?? "";
    const ciudad = readString(payload.ciudad) ?? existing?.ciudad ?? "";
    const departamento =
      readOptionalString(payload.departamento, existing?.departamento) ?? "";
    const contactoPrincipal =
      readOptionalString(
        payload.contactoPrincipal,
        existing?.contactoPrincipal
      ) ?? "";
    const cargoContacto =
      readOptionalString(payload.cargoContacto, existing?.cargoContacto) ?? "";
    const estadoRaw = readString(payload.estado) ?? existing?.estado ?? "nuevo";
    const fuenteRaw = readString(payload.fuente) ?? existing?.fuente ?? "otro";

    const probabilidadInput = readOptionalNumber(
      payload.probabilidadConversion,
      "Probabilidad de conversion invalida"
    );
    const hasProbabilidad = hasOwnField(payload, "probabilidadConversion");

    if (hasProbabilidad && probabilidadInput === undefined) {
      throw new Error("La probabilidad de conversion es obligatoria");
    }

    const probabilidadConversion = Math.round(
      probabilidadInput ?? existing?.probabilidadConversion ?? 0
    );

    if (!nombre || !empresa || !ciudad) {
      throw new Error("Faltan campos obligatorios del prospecto");
    }

    if (!email && !contactoPrincipal) {
      throw new Error("Debe indicar un contacto principal o un email");
    }

    if (!PROSPECTO_ESTADOS.has(estadoRaw as ProspectoEstadoValue)) {
      throw new Error("Estado de prospecto invalido");
    }

    if (!PROSPECTO_FUENTES.has(fuenteRaw as ProspectoFuenteValue)) {
      throw new Error("Fuente de prospecto invalida");
    }

    if (probabilidadConversion < 0 || probabilidadConversion > 100) {
      throw new Error("La probabilidad de conversion debe estar entre 0 y 100");
    }

    const montoEstimadoInput = readOptionalNumber(
      payload.montoEstimado,
      "Monto estimado invalido"
    );
    const montoEstimado = hasOwnField(payload, "montoEstimado")
      ? montoEstimadoInput
      : existing?.montoEstimado;

    if (montoEstimado !== undefined && montoEstimado < 0) {
      throw new Error("El monto estimado no puede ser negativo");
    }

    const prospecto = {
      id: existing?.id ?? `pro-${nanoid(8)}`,
      nombre,
      empresa,
      email,
      telefono,
      ciudad,
      departamento,
      contactoPrincipal,
      cargoContacto,
      estado: estadoRaw as ProspectoEstadoValue,
      fuente: fuenteRaw as ProspectoFuenteValue,
      fechaCaptura:
        readDate(
          payload.fechaCaptura as string | Date | null | undefined,
          existing?.fechaCaptura ? new Date(existing.fechaCaptura) : undefined
        ) ?? new Date(),
      proximoSeguimiento: readDate(
        payload.proximoSeguimiento as string | Date | null | undefined,
        existing?.proximoSeguimiento
          ? new Date(existing.proximoSeguimiento)
          : undefined
      ),
      probabilidadConversion,
      montoEstimado,
      notas: readOptionalString(payload.notas, existing?.notas),
      asignadoA: readOptionalString(payload.asignadoA, existing?.asignadoA),
    };

    logProspectosInfo("buildProspecto:success", {
      id: prospecto.id,
      existingId: existing?.id ?? null,
    });

    return prospecto;
  } catch (error) {
    logProspectosError("buildProspecto:error", error, {
      existingId: existing?.id ?? null,
      payloadKeys: getPayloadKeys(payload),
    });
    throw error;
  }
}

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

function sendEmpty(res: ServerResponse, statusCode = 204): void {
  res.statusCode = statusCode;
  res.setHeader("Cache-Control", "no-store");
  res.end();
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
  logProspectosInfo("readJsonBody:start", {
    method: req.method,
    url: req.url,
    bodyType: Buffer.isBuffer(req.body) ? "buffer" : typeof req.body,
  });

  try {
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
  } catch (error) {
    logProspectosError("readJsonBody:error", error, {
      method: req.method,
      url: req.url,
    });
    throw error;
  }
}

function getPathname(urlValue?: string) {
  return new URL(urlValue ?? "/", "http://localhost").pathname;
}

export function getProspectoIdFromRequestUrl(urlValue?: string) {
  const match = getPathname(urlValue).match(/^\/api\/prospectos\/([^/]+)\/?$/);
  return match ? decodeURIComponent(match[1]) : null;
}

async function listProspectos() {
  logProspectosInfo("listProspectos:start");

  try {
    const sql = getSql();
    const rows = (await sql`
      SELECT
        id,
        nombre,
        empresa,
        email,
        telefono,
        ciudad,
        departamento,
        contacto_principal,
        cargo_contacto,
        estado,
        fuente,
        fecha_captura,
        proximo_seguimiento,
        probabilidad_conversion,
        monto_estimado,
        notas,
        asignado_a
      FROM prospectos
      ORDER BY fecha_captura DESC, id DESC
    `) as ProspectoRow[];

    logProspectosInfo("listProspectos:success", { count: rows.length });
    return rows.map(mapProspectoRow);
  } catch (error) {
    logProspectosError("listProspectos:error", error);
    throw error;
  }
}

async function findProspectoById(id: string) {
  logProspectosInfo("findProspectoById:start", { id });

  try {
    const sql = getSql();
    const rows = (await sql`
      SELECT
        id,
        nombre,
        empresa,
        email,
        telefono,
        ciudad,
        departamento,
        contacto_principal,
        cargo_contacto,
        estado,
        fuente,
        fecha_captura,
        proximo_seguimiento,
        probabilidad_conversion,
        monto_estimado,
        notas,
        asignado_a
      FROM prospectos
      WHERE id = ${id}
      LIMIT 1
    `) as ProspectoRow[];

    logProspectosInfo("findProspectoById:success", {
      id,
      found: rows.length > 0,
    });
    return rows[0] ? mapProspectoRow(rows[0]) : null;
  } catch (error) {
    logProspectosError("findProspectoById:error", error, { id });
    throw error;
  }
}

async function insertProspecto(payload: unknown) {
  logProspectosInfo("insertProspecto:start", {
    payloadKeys: getPayloadKeys(payload),
  });

  try {
    const prospecto = buildProspecto(payload);
    const sql = getSql();
    const rows = (await sql`
      INSERT INTO prospectos (
        id,
        nombre,
        empresa,
        email,
        telefono,
        ciudad,
        departamento,
        contacto_principal,
        cargo_contacto,
        estado,
        fuente,
        fecha_captura,
        proximo_seguimiento,
        probabilidad_conversion,
        monto_estimado,
        notas,
        asignado_a
      ) VALUES (
        ${prospecto.id},
        ${prospecto.nombre},
        ${prospecto.empresa},
        ${prospecto.email},
        ${prospecto.telefono},
        ${prospecto.ciudad},
        ${prospecto.departamento},
        ${prospecto.contactoPrincipal},
        ${prospecto.cargoContacto},
        ${prospecto.estado},
        ${prospecto.fuente},
        ${prospecto.fechaCaptura.toISOString()},
        ${prospecto.proximoSeguimiento?.toISOString() ?? null},
        ${prospecto.probabilidadConversion},
        ${prospecto.montoEstimado ?? null},
        ${prospecto.notas ?? null},
        ${prospecto.asignadoA ?? null}
      )
      RETURNING
        id,
        nombre,
        empresa,
        email,
        telefono,
        ciudad,
        departamento,
        contacto_principal,
        cargo_contacto,
        estado,
        fuente,
        fecha_captura,
        proximo_seguimiento,
        probabilidad_conversion,
        monto_estimado,
        notas,
        asignado_a
    `) as ProspectoRow[];

    logProspectosInfo("insertProspecto:success", {
      id: rows[0]?.id ?? prospecto.id,
    });
    return mapProspectoRow(rows[0]);
  } catch (error) {
    logProspectosError("insertProspecto:error", error, {
      payloadKeys: getPayloadKeys(payload),
    });
    throw error;
  }
}

async function updateExistingProspecto(id: string, payload: unknown) {
  logProspectosInfo("updateExistingProspecto:start", {
    id,
    payloadKeys: getPayloadKeys(payload),
  });

  try {
    const existing = await findProspectoById(id);

    if (!existing) {
      logProspectosInfo("updateExistingProspecto:not-found", { id });
      return null;
    }

    const prospecto = buildProspecto(payload, existing);
    const sql = getSql();
    const rows = (await sql`
      UPDATE prospectos
      SET
        nombre = ${prospecto.nombre},
        empresa = ${prospecto.empresa},
        email = ${prospecto.email},
        telefono = ${prospecto.telefono},
        ciudad = ${prospecto.ciudad},
        departamento = ${prospecto.departamento},
        contacto_principal = ${prospecto.contactoPrincipal},
        cargo_contacto = ${prospecto.cargoContacto},
        estado = ${prospecto.estado},
        fuente = ${prospecto.fuente},
        fecha_captura = ${prospecto.fechaCaptura.toISOString()},
        proximo_seguimiento = ${prospecto.proximoSeguimiento?.toISOString() ?? null},
        probabilidad_conversion = ${prospecto.probabilidadConversion},
        monto_estimado = ${prospecto.montoEstimado ?? null},
        notas = ${prospecto.notas ?? null},
        asignado_a = ${prospecto.asignadoA ?? null},
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING
        id,
        nombre,
        empresa,
        email,
        telefono,
        ciudad,
        departamento,
        contacto_principal,
        cargo_contacto,
        estado,
        fuente,
        fecha_captura,
        proximo_seguimiento,
        probabilidad_conversion,
        monto_estimado,
        notas,
        asignado_a
    `) as ProspectoRow[];

    logProspectosInfo("updateExistingProspecto:success", { id });
    return mapProspectoRow(rows[0]);
  } catch (error) {
    logProspectosError("updateExistingProspecto:error", error, {
      id,
      payloadKeys: getPayloadKeys(payload),
    });
    throw error;
  }
}

async function removeProspecto(id: string) {
  logProspectosInfo("removeProspecto:start", { id });

  try {
    const sql = getSql();
    const rows = (await sql`
      DELETE FROM prospectos
      WHERE id = ${id}
      RETURNING id
    `) as Array<{ id: string }>;

    logProspectosInfo("removeProspecto:success", {
      id,
      deleted: rows.length > 0,
    });
    return rows.length > 0;
  } catch (error) {
    logProspectosError("removeProspecto:error", error, { id });
    throw error;
  }
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function isValidationError(error: unknown) {
  return (
    error instanceof Error &&
    /invalido|obligatorios|Debe indicar|probabilidad|monto|fuente|estado/i.test(
      error.message
    )
  );
}

export async function handleProspectosCollection(
  req: NodeRequest,
  res: ServerResponse
) {
  logProspectosInfo("handleProspectosCollection:start", {
    method: req.method,
    url: req.url,
  });

  try {
    if (req.method === "GET") {
      const prospectos = await listProspectos();
      sendJson(res, 200, prospectos);
      logProspectosInfo("handleProspectosCollection:response", {
        method: req.method,
        url: req.url,
        statusCode: 200,
        count: prospectos.length,
      });
      return;
    }

    if (req.method === "POST") {
      const payload = await readJsonBody(req);
      const prospecto = await insertProspecto(payload);
      sendJson(res, 201, prospecto);
      logProspectosInfo("handleProspectosCollection:response", {
        method: req.method,
        url: req.url,
        statusCode: 201,
        id: prospecto.id,
      });
      return;
    }

    sendMethodNotAllowed(res, ["GET", "POST"]);
  } catch (error) {
    const statusCode = isValidationError(error) ? 400 : 500;
    const detail = getErrorMessage(error, "No se pudo procesar la solicitud");

    logProspectosError("handleProspectosCollection:error", error, {
      method: req.method,
      url: req.url,
      statusCode,
    });

    sendErrorJson(
      res,
      statusCode,
      statusCode === 400
        ? "Solicitud invalida en /api/prospectos"
        : "Error interno en /api/prospectos",
      detail
    );
  }
}

export async function handleProspectoItem(
  req: NodeRequest,
  res: ServerResponse,
  id: string
) {
  logProspectosInfo("handleProspectoItem:start", {
    method: req.method,
    url: req.url,
    id,
  });

  try {
    if (!id) {
      sendErrorJson(
        res,
        400,
        "Prospecto invalido",
        "Se recibio un id vacio para /api/prospectos/[id]"
      );
      return;
    }

    if (req.method === "GET") {
      const prospecto = await findProspectoById(id);

      if (!prospecto) {
        sendErrorJson(
          res,
          404,
          "Prospecto no encontrado",
          `No existe un prospecto con id ${id}`
        );
        return;
      }

      sendJson(res, 200, prospecto);
      logProspectosInfo("handleProspectoItem:response", {
        method: req.method,
        url: req.url,
        id,
        statusCode: 200,
      });
      return;
    }

    if (req.method === "PUT") {
      const payload = await readJsonBody(req);
      const prospecto = await updateExistingProspecto(id, payload);

      if (!prospecto) {
        sendErrorJson(
          res,
          404,
          "Prospecto no encontrado",
          `No existe un prospecto con id ${id}`
        );
        return;
      }

      sendJson(res, 200, prospecto);
      logProspectosInfo("handleProspectoItem:response", {
        method: req.method,
        url: req.url,
        id,
        statusCode: 200,
      });
      return;
    }

    if (req.method === "DELETE") {
      const deleted = await removeProspecto(id);

      if (!deleted) {
        sendErrorJson(
          res,
          404,
          "Prospecto no encontrado",
          `No existe un prospecto con id ${id}`
        );
        return;
      }

      sendEmpty(res, 204);
      logProspectosInfo("handleProspectoItem:response", {
        method: req.method,
        url: req.url,
        id,
        statusCode: 204,
      });
      return;
    }

    sendMethodNotAllowed(res, ["GET", "PUT", "DELETE"]);
  } catch (error) {
    const statusCode = isValidationError(error) ? 400 : 500;
    const detail = getErrorMessage(error, "No se pudo procesar la solicitud");

    logProspectosError("handleProspectoItem:error", error, {
      method: req.method,
      url: req.url,
      id,
      statusCode,
    });

    sendErrorJson(
      res,
      statusCode,
      statusCode === 400
        ? "Solicitud invalida en /api/prospectos/[id]"
        : "Error interno en /api/prospectos/[id]",
      detail
    );
  }
}

export function createProspectosDevMiddleware() {
  return (req: NodeRequest, res: ServerResponse, next: ConnectNext) => {
    const pathname = getPathname(req.url);

    if (pathname === "/api/prospectos" || pathname === "/api/prospectos/") {
      void handleProspectosCollection(req, res).catch(next);
      return;
    }

    const prospectoId = getProspectoIdFromRequestUrl(req.url);

    if (prospectoId) {
      void handleProspectoItem(req, res, prospectoId).catch(next);
      return;
    }

    next();
  };
}
