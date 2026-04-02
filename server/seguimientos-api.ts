import type { IncomingMessage, ServerResponse } from "node:http";
import { nanoid } from "nanoid";
import type { Seguimiento } from "../client/src/lib/types.js";
import { getSql } from "./neon.js";

type SeguimientoTipoValue = Seguimiento["tipo"];
type SeguimientoEstadoValue = Seguimiento["estado"];

type SeguimientoApiRecord = Omit<
  Seguimiento,
  "fechaVencimiento" | "fecha" | "proximoSeguimiento"
> & {
  fechaVencimiento: string;
  fecha?: string;
  proximoSeguimiento?: string;
};

type NodeRequest = IncomingMessage & {
  body?: unknown;
};

type ConnectNext = (error?: unknown) => void;

type SeguimientoRow = {
  id: string;
  cliente_id: string | null;
  cliente_nombre: string | null;
  cliente_empresa: string | null;
  prospecto_id: string | null;
  prospecto_nombre: string | null;
  prospecto_empresa: string | null;
  cotizacion_id: string | null;
  cotizacion_numero: string | null;
  cotizacion_cliente_nombre: string | null;
  cotizacion_cliente_empresa: string | null;
  tipo: SeguimientoTipoValue;
  fecha_vencimiento: string | Date;
  observaciones: string | null;
  estado: SeguimientoEstadoValue;
  completado: boolean;
};

type RelatedSummary = {
  id: string;
  nombre?: string | null;
  empresa?: string | null;
  numero?: string | null;
  cliente_nombre?: string | null;
  cliente_empresa?: string | null;
};

type SeguimientoDraft = {
  id: string;
  clienteId?: string;
  prospectoId?: string;
  cotizacionId?: string;
  tipo: SeguimientoTipoValue;
  fechaVencimiento: Date;
  observaciones?: string;
  estado: SeguimientoEstadoValue;
  completado: boolean;
};

const SEGUIMIENTO_TIPOS = new Set<SeguimientoTipoValue>([
  "llamada",
  "email",
  "reunion",
  "mensaje",
  "tarea",
] as SeguimientoTipoValue[]);

const SEGUIMIENTO_ESTADOS = new Set<SeguimientoEstadoValue>([
  "pendiente",
  "en_proceso",
  "cerrado",
  "cancelado",
] as SeguimientoEstadoValue[]);

const SEGUIMIENTOS_API_LOG_PREFIX = "[server/seguimientos-api]";

function logSeguimientosInfo(
  message: string,
  metadata?: Record<string, unknown>
) {
  if (metadata) {
    console.info(SEGUIMIENTOS_API_LOG_PREFIX, message, metadata);
    return;
  }

  console.info(SEGUIMIENTOS_API_LOG_PREFIX, message);
}

function logSeguimientosError(
  message: string,
  error: unknown,
  metadata?: Record<string, unknown>
) {
  console.error(SEGUIMIENTOS_API_LOG_PREFIX, message, {
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

function readBoolean(value: unknown, fallback: boolean) {
  if (value === undefined) {
    return fallback;
  }

  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();

    if (normalized === "true") {
      return true;
    }

    if (normalized === "false") {
      return false;
    }
  }

  return fallback;
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

  const parsed = value instanceof Date ? new Date(value) : new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
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

function mapSeguimientoRow(row: SeguimientoRow): SeguimientoApiRecord {
  try {
    const fechaVencimiento = parseDateValue(row.fecha_vencimiento);
    const relacionTipo = row.cliente_id
      ? "cliente"
      : row.prospecto_id
        ? "prospecto"
        : row.cotizacion_id
          ? "cotizacion"
          : undefined;

    const relacionadoNombre =
      relacionTipo === "cliente"
        ? row.cliente_nombre ?? undefined
        : relacionTipo === "prospecto"
          ? row.prospecto_nombre ?? undefined
          : row.cotizacion_numero ?? undefined;

    const relacionadoEmpresa =
      relacionTipo === "cliente"
        ? row.cliente_empresa ?? undefined
        : relacionTipo === "prospecto"
          ? row.prospecto_empresa ?? undefined
          : row.cotizacion_cliente_empresa ??
            row.cotizacion_cliente_nombre ??
            undefined;

    return {
      id: row.id,
      clienteId: row.cliente_id ?? undefined,
      clienteNombre: row.cliente_nombre ?? undefined,
      clienteEmpresa: row.cliente_empresa ?? undefined,
      prospectoId: row.prospecto_id ?? undefined,
      prospectoNombre: row.prospecto_nombre ?? undefined,
      prospectoEmpresa: row.prospecto_empresa ?? undefined,
      cotizacionId: row.cotizacion_id ?? undefined,
      cotizacionNumero: row.cotizacion_numero ?? undefined,
      relacionTipo,
      relacionadoNombre,
      relacionadoEmpresa,
      tipo: row.tipo,
      fechaVencimiento: fechaVencimiento.toISOString(),
      observaciones: row.observaciones ?? undefined,
      estado: row.estado,
      completado: Boolean(row.completado),
      fecha: fechaVencimiento.toISOString(),
      descripcion: row.observaciones ?? undefined,
      proximoSeguimiento: fechaVencimiento.toISOString(),
      notas: row.observaciones ?? undefined,
    };
  } catch (error) {
    logSeguimientosError("mapSeguimientoRow:error", error, { id: row.id });
    throw error;
  }
}

async function findClienteSummaryById(id: string) {
  logSeguimientosInfo("findClienteSummaryById:start", { id });

  try {
    const sql = getSql();
    const rows = (await sql`
      SELECT id, nombre, empresa
      FROM clientes
      WHERE id = ${id}
      LIMIT 1
    `) as RelatedSummary[];

    logSeguimientosInfo("findClienteSummaryById:success", {
      id,
      found: rows.length > 0,
    });

    return rows[0] ?? null;
  } catch (error) {
    logSeguimientosError("findClienteSummaryById:error", error, { id });
    throw error;
  }
}

async function findProspectoSummaryById(id: string) {
  logSeguimientosInfo("findProspectoSummaryById:start", { id });

  try {
    const sql = getSql();
    const rows = (await sql`
      SELECT id, nombre, empresa
      FROM prospectos
      WHERE id = ${id}
      LIMIT 1
    `) as RelatedSummary[];

    logSeguimientosInfo("findProspectoSummaryById:success", {
      id,
      found: rows.length > 0,
    });

    return rows[0] ?? null;
  } catch (error) {
    logSeguimientosError("findProspectoSummaryById:error", error, { id });
    throw error;
  }
}

async function findCotizacionSummaryById(id: string) {
  logSeguimientosInfo("findCotizacionSummaryById:start", { id });

  try {
    const sql = getSql();
    const rows = (await sql`
      SELECT
        co.id,
        co.numero,
        c.nombre AS cliente_nombre,
        c.empresa AS cliente_empresa
      FROM cotizaciones co
      LEFT JOIN clientes c ON c.id = co.cliente_id
      WHERE co.id = ${id}
      LIMIT 1
    `) as RelatedSummary[];

    logSeguimientosInfo("findCotizacionSummaryById:success", {
      id,
      found: rows.length > 0,
    });

    return rows[0] ?? null;
  } catch (error) {
    logSeguimientosError("findCotizacionSummaryById:error", error, { id });
    throw error;
  }
}

async function buildSeguimiento(
  payload: unknown,
  existing?: SeguimientoApiRecord
): Promise<SeguimientoDraft> {
  logSeguimientosInfo("buildSeguimiento:start", {
    existingId: existing?.id ?? null,
    payloadKeys: getPayloadKeys(payload),
  });

  try {
    assertPayload(payload);

    const clienteId = readOptionalString(payload.clienteId, existing?.clienteId);
    const prospectoId = readOptionalString(
      payload.prospectoId,
      existing?.prospectoId
    );
    const cotizacionId = readOptionalString(
      payload.cotizacionId,
      existing?.cotizacionId
    );
    const tipoRaw = readString(payload.tipo) ?? existing?.tipo ?? "tarea";
    const fechaVencimiento =
      readDate(
        (payload.fechaVencimiento ??
          payload.fecha ??
          payload.proximoSeguimiento) as string | Date | null | undefined,
        existing?.fechaVencimiento
          ? new Date(existing.fechaVencimiento)
          : existing?.fecha
            ? new Date(existing.fecha)
            : existing?.proximoSeguimiento
              ? new Date(existing.proximoSeguimiento)
              : undefined
      ) ?? new Date();
    const observaciones = readOptionalString(
      payload.observaciones ?? payload.descripcion ?? payload.notas,
      existing?.observaciones ?? existing?.descripcion ?? existing?.notas
    );
    let estado =
      (readString(payload.estado) ?? existing?.estado ?? "pendiente") as
        | SeguimientoEstadoValue
        | string;
    let completado = readBoolean(payload.completado, existing?.completado ?? false);

    if ((clienteId ? 1 : 0) + (prospectoId ? 1 : 0) + (cotizacionId ? 1 : 0) !== 1) {
      throw new Error(
        "Debes asociar el seguimiento a un cliente, un prospecto o una cotizacion"
      );
    }

    if (!SEGUIMIENTO_TIPOS.has(tipoRaw as SeguimientoTipoValue)) {
      throw new Error("Tipo de seguimiento invalido");
    }

    if (!SEGUIMIENTO_ESTADOS.has(estado as SeguimientoEstadoValue)) {
      throw new Error("Estado de seguimiento invalido");
    }

    if (estado === "cancelado") {
      completado = false;
    } else if (completado) {
      estado = "cerrado";
    } else if (estado === "cerrado") {
      estado = "pendiente";
    }

    if (clienteId) {
      const cliente = await findClienteSummaryById(clienteId);

      if (!cliente) {
        throw new Error("El cliente seleccionado no existe");
      }
    }

    if (prospectoId) {
      const prospecto = await findProspectoSummaryById(prospectoId);

      if (!prospecto) {
        throw new Error("El prospecto seleccionado no existe");
      }
    }

    if (cotizacionId) {
      const cotizacion = await findCotizacionSummaryById(cotizacionId);

      if (!cotizacion) {
        throw new Error("La cotizacion seleccionada no existe");
      }
    }

    const seguimiento = {
      id: existing?.id ?? `seg-${nanoid(10)}`,
      ...(clienteId ? { clienteId } : {}),
      ...(prospectoId ? { prospectoId } : {}),
      ...(cotizacionId ? { cotizacionId } : {}),
      tipo: tipoRaw as SeguimientoTipoValue,
      fechaVencimiento,
      observaciones,
      estado: estado as SeguimientoEstadoValue,
      completado,
    };

    logSeguimientosInfo("buildSeguimiento:success", {
      id: seguimiento.id,
      clienteId: seguimiento.clienteId ?? null,
      prospectoId: seguimiento.prospectoId ?? null,
      cotizacionId: seguimiento.cotizacionId ?? null,
    });

    return seguimiento;
  } catch (error) {
    logSeguimientosError("buildSeguimiento:error", error, {
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
  logSeguimientosInfo("readJsonBody:start", {
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
    logSeguimientosError("readJsonBody:error", error, {
      method: req.method,
      url: req.url,
    });
    throw error;
  }
}

function getPathname(urlValue?: string) {
  return new URL(urlValue ?? "/", "http://localhost").pathname;
}

export function getSeguimientoIdFromRequestUrl(urlValue?: string) {
  const match = getPathname(urlValue).match(/^\/api\/seguimientos\/([^/]+)\/?$/);
  return match ? decodeURIComponent(match[1]) : null;
}

async function listSeguimientos() {
  logSeguimientosInfo("listSeguimientos:start");

  try {
    const sql = getSql();
    const rows = (await sql`
      SELECT
        s.id,
        s.cliente_id,
        c.nombre AS cliente_nombre,
        c.empresa AS cliente_empresa,
        s.prospecto_id,
        p.nombre AS prospecto_nombre,
        p.empresa AS prospecto_empresa,
        s.cotizacion_id,
        co.numero AS cotizacion_numero,
        cc.nombre AS cotizacion_cliente_nombre,
        cc.empresa AS cotizacion_cliente_empresa,
        s.tipo,
        s.fecha_vencimiento,
        s.observaciones,
        s.estado,
        s.completado
      FROM seguimientos s
      LEFT JOIN clientes c ON c.id = s.cliente_id
      LEFT JOIN prospectos p ON p.id = s.prospecto_id
      LEFT JOIN cotizaciones co ON co.id = s.cotizacion_id
      LEFT JOIN clientes cc ON cc.id = co.cliente_id
      ORDER BY s.completado ASC, s.fecha_vencimiento ASC, s.id DESC
    `) as SeguimientoRow[];

    logSeguimientosInfo("listSeguimientos:success", { count: rows.length });
    return rows.map(mapSeguimientoRow);
  } catch (error) {
    logSeguimientosError("listSeguimientos:error", error);
    throw error;
  }
}

async function findSeguimientoById(id: string) {
  logSeguimientosInfo("findSeguimientoById:start", { id });

  try {
    const sql = getSql();
    const rows = (await sql`
      SELECT
        s.id,
        s.cliente_id,
        c.nombre AS cliente_nombre,
        c.empresa AS cliente_empresa,
        s.prospecto_id,
        p.nombre AS prospecto_nombre,
        p.empresa AS prospecto_empresa,
        s.cotizacion_id,
        co.numero AS cotizacion_numero,
        cc.nombre AS cotizacion_cliente_nombre,
        cc.empresa AS cotizacion_cliente_empresa,
        s.tipo,
        s.fecha_vencimiento,
        s.observaciones,
        s.estado,
        s.completado
      FROM seguimientos s
      LEFT JOIN clientes c ON c.id = s.cliente_id
      LEFT JOIN prospectos p ON p.id = s.prospecto_id
      LEFT JOIN cotizaciones co ON co.id = s.cotizacion_id
      LEFT JOIN clientes cc ON cc.id = co.cliente_id
      WHERE s.id = ${id}
      LIMIT 1
    `) as SeguimientoRow[];

    logSeguimientosInfo("findSeguimientoById:success", {
      id,
      found: rows.length > 0,
    });

    return rows[0] ? mapSeguimientoRow(rows[0]) : null;
  } catch (error) {
    logSeguimientosError("findSeguimientoById:error", error, { id });
    throw error;
  }
}

async function insertSeguimiento(payload: unknown) {
  logSeguimientosInfo("insertSeguimiento:start", {
    payloadKeys: getPayloadKeys(payload),
  });

  try {
    const seguimiento = await buildSeguimiento(payload);
    const sql = getSql();
    const rows = (await sql`
      INSERT INTO seguimientos (
        id,
        cliente_id,
        prospecto_id,
        cotizacion_id,
        tipo,
        fecha_vencimiento,
        observaciones,
        estado,
        completado
      ) VALUES (
        ${seguimiento.id},
        ${seguimiento.clienteId ?? null},
        ${seguimiento.prospectoId ?? null},
        ${seguimiento.cotizacionId ?? null},
        ${seguimiento.tipo},
        ${seguimiento.fechaVencimiento.toISOString()},
        ${seguimiento.observaciones ?? null},
        ${seguimiento.estado},
        ${seguimiento.completado}
      )
      RETURNING id
    `) as Array<{ id: string }>;

    const created = await findSeguimientoById(rows[0]?.id ?? seguimiento.id);

    if (!created) {
      throw new Error("No se pudo recuperar el seguimiento creado");
    }

    logSeguimientosInfo("insertSeguimiento:success", { id: created.id });
    return created;
  } catch (error) {
    logSeguimientosError("insertSeguimiento:error", error, {
      payloadKeys: getPayloadKeys(payload),
    });
    throw error;
  }
}

async function updateExistingSeguimiento(id: string, payload: unknown) {
  logSeguimientosInfo("updateExistingSeguimiento:start", {
    id,
    payloadKeys: getPayloadKeys(payload),
  });

  try {
    const existing = await findSeguimientoById(id);

    if (!existing) {
      logSeguimientosInfo("updateExistingSeguimiento:not-found", { id });
      return null;
    }

    const seguimiento = await buildSeguimiento(payload, existing);
    const sql = getSql();
    const rows = (await sql`
      UPDATE seguimientos
      SET
        cliente_id = ${seguimiento.clienteId ?? null},
        prospecto_id = ${seguimiento.prospectoId ?? null},
        cotizacion_id = ${seguimiento.cotizacionId ?? null},
        tipo = ${seguimiento.tipo},
        fecha_vencimiento = ${seguimiento.fechaVencimiento.toISOString()},
        observaciones = ${seguimiento.observaciones ?? null},
        estado = ${seguimiento.estado},
        completado = ${seguimiento.completado},
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING id
    `) as Array<{ id: string }>;

    const updated = await findSeguimientoById(rows[0]?.id ?? id);

    if (!updated) {
      throw new Error("No se pudo recuperar el seguimiento actualizado");
    }

    logSeguimientosInfo("updateExistingSeguimiento:success", { id: updated.id });
    return updated;
  } catch (error) {
    logSeguimientosError("updateExistingSeguimiento:error", error, {
      id,
      payloadKeys: getPayloadKeys(payload),
    });
    throw error;
  }
}

async function removeSeguimiento(id: string) {
  logSeguimientosInfo("removeSeguimiento:start", { id });

  try {
    const sql = getSql();
    const rows = (await sql`
      DELETE FROM seguimientos
      WHERE id = ${id}
      RETURNING id
    `) as Array<{ id: string }>;

    logSeguimientosInfo("removeSeguimiento:success", {
      id,
      deleted: rows.length > 0,
    });

    return rows.length > 0;
  } catch (error) {
    logSeguimientosError("removeSeguimiento:error", error, { id });
    throw error;
  }
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function isValidationError(error: unknown) {
  return (
    error instanceof Error &&
    /invalido|cliente|prospecto|cotizacion|seguimiento|solicitud/i.test(
      error.message
    )
  );
}

export async function handleSeguimientosCollection(
  req: NodeRequest,
  res: ServerResponse
) {
  logSeguimientosInfo("handleSeguimientosCollection:start", {
    method: req.method,
    url: req.url,
  });

  try {
    if (req.method === "GET") {
      const seguimientos = await listSeguimientos();
      sendJson(res, 200, seguimientos);
      logSeguimientosInfo("handleSeguimientosCollection:response", {
        method: req.method,
        url: req.url,
        statusCode: 200,
        count: seguimientos.length,
      });
      return;
    }

    if (req.method === "POST") {
      const payload = await readJsonBody(req);
      const seguimiento = await insertSeguimiento(payload);
      sendJson(res, 201, seguimiento);
      logSeguimientosInfo("handleSeguimientosCollection:response", {
        method: req.method,
        url: req.url,
        statusCode: 201,
        id: seguimiento.id,
      });
      return;
    }

    sendMethodNotAllowed(res, ["GET", "POST"]);
  } catch (error) {
    const statusCode = isValidationError(error) ? 400 : 500;
    const detail = getErrorMessage(error, "No se pudo procesar la solicitud");

    logSeguimientosError("handleSeguimientosCollection:error", error, {
      method: req.method,
      url: req.url,
      statusCode,
    });

    sendErrorJson(
      res,
      statusCode,
      statusCode === 400
        ? "Solicitud invalida en /api/seguimientos"
        : "Error interno en /api/seguimientos",
      detail
    );
  }
}

export async function handleSeguimientoItem(
  req: NodeRequest,
  res: ServerResponse,
  id: string
) {
  logSeguimientosInfo("handleSeguimientoItem:start", {
    method: req.method,
    url: req.url,
    id,
  });

  try {
    if (!id) {
      sendErrorJson(
        res,
        400,
        "Seguimiento invalido",
        "Se recibio un id vacio para /api/seguimientos/[id]"
      );
      return;
    }

    if (req.method === "GET") {
      const seguimiento = await findSeguimientoById(id);

      if (!seguimiento) {
        sendErrorJson(
          res,
          404,
          "Seguimiento no encontrado",
          `No existe un seguimiento con id ${id}`
        );
        return;
      }

      sendJson(res, 200, seguimiento);
      logSeguimientosInfo("handleSeguimientoItem:response", {
        method: req.method,
        url: req.url,
        id,
        statusCode: 200,
      });
      return;
    }

    if (req.method === "PUT") {
      const payload = await readJsonBody(req);
      const seguimiento = await updateExistingSeguimiento(id, payload);

      if (!seguimiento) {
        sendErrorJson(
          res,
          404,
          "Seguimiento no encontrado",
          `No existe un seguimiento con id ${id}`
        );
        return;
      }

      sendJson(res, 200, seguimiento);
      logSeguimientosInfo("handleSeguimientoItem:response", {
        method: req.method,
        url: req.url,
        id,
        statusCode: 200,
      });
      return;
    }

    if (req.method === "DELETE") {
      const deleted = await removeSeguimiento(id);

      if (!deleted) {
        sendErrorJson(
          res,
          404,
          "Seguimiento no encontrado",
          `No existe un seguimiento con id ${id}`
        );
        return;
      }

      sendEmpty(res, 204);
      logSeguimientosInfo("handleSeguimientoItem:response", {
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

    logSeguimientosError("handleSeguimientoItem:error", error, {
      method: req.method,
      url: req.url,
      id,
      statusCode,
    });

    sendErrorJson(
      res,
      statusCode,
      statusCode === 400
        ? "Solicitud invalida en /api/seguimientos/[id]"
        : "Error interno en /api/seguimientos/[id]",
      detail
    );
  }
}

export function createSeguimientosDevMiddleware() {
  return (req: NodeRequest, res: ServerResponse, next: ConnectNext) => {
    const pathname = getPathname(req.url);

    if (pathname === "/api/seguimientos" || pathname === "/api/seguimientos/") {
      void handleSeguimientosCollection(req, res).catch(next);
      return;
    }

    const seguimientoId = getSeguimientoIdFromRequestUrl(req.url);

    if (seguimientoId) {
      void handleSeguimientoItem(req, res, seguimientoId).catch(next);
      return;
    }

    next();
  };
}
