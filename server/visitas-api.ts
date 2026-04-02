import type { IncomingMessage, ServerResponse } from "node:http";
import { nanoid } from "nanoid";
import { getAuthenticatedUser } from "./auth-api.js";
import {
  generateVisitaViaticosExcel,
  generateVisitaViaticosPdf,
} from "./visitas-export.js";
import type {
  ResumenViaticosVisita,
  ViaticoTipoGasto,
  Visita,
  VisitaViaticoSoporte,
  VisitaViatico,
} from "../client/src/lib/types.js";
import { getSql } from "./neon.js";

type VisitaTipoValue = Visita["tipo"];
type VisitaEstadoValue = Visita["estado"];
type VisitaViaticoApiRecord = Omit<VisitaViatico, "fecha"> & {
  fecha: string;
};
type VisitaApiRecord = Omit<Visita, "fecha" | "proximaFecha" | "viaticos"> & {
  fecha: string;
  proximaFecha?: string;
  viaticos?: VisitaViaticoApiRecord[];
};

type NodeRequest = IncomingMessage & {
  body?: unknown;
};

type ConnectNext = (error?: unknown) => void;

type VisitaRow = {
  id: string;
  cliente_id: string | null;
  cliente_nombre: string | null;
  cliente_empresa: string | null;
  prospecto_id: string | null;
  prospecto_nombre: string | null;
  prospecto_empresa: string | null;
  tipo: VisitaTipoValue;
  fecha: string | Date;
  hora: string;
  objetivo: string;
  resultado: string;
  observaciones: string | null;
  proxima_accion: string | null;
  estado: VisitaEstadoValue;
};

type RelatedSummary = {
  id: string;
  nombre: string;
  empresa: string;
};

type VisitaDraft = {
  id: string;
  clienteId?: string;
  prospectoId?: string;
  tipo: VisitaTipoValue;
  fecha: Date;
  hora: string;
  objetivo: string;
  resultado: string;
  observaciones?: string;
  proximaAccion?: string;
  estado: VisitaEstadoValue;
};

type VisitaViaticoTipoValue = ViaticoTipoGasto;

type VisitaViaticoRow = {
  descripcion: string;
  fecha: string | Date;
  id: string;
  observaciones: string | null;
  soporte_contenido_base64?: string | null;
  soporte_nombre?: string | null;
  soporte_tamano?: number | string | null;
  soporte_tipo_mime?: string | null;
  tipo_gasto: VisitaViaticoTipoValue;
  usuario_id: string | null;
  usuario_nombre: string | null;
  valor: number | string;
  visita_id: string;
};

type VisitaViaticoSupportPayload = {
  contentBase64?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
};

type VisitaViaticoSoporteDraft = VisitaViaticoSoporte & {
  contentBase64: string;
};

type VisitaViaticoDraft = {
  descripcion: string;
  fecha: Date;
  id: string;
  observaciones?: string;
  soporte?: VisitaViaticoSoporteDraft;
  tipoGasto: VisitaViaticoTipoValue;
  usuarioId: string;
  valor: number;
  visitaId: string;
};

const VISITA_TIPOS = new Set<VisitaTipoValue>([
  "prospectacion",
  "seguimiento",
  "negociacion",
  "servicio",
] as VisitaTipoValue[]);

const VISITA_ESTADOS = new Set<VisitaEstadoValue>([
  "programada",
  "realizada",
  "cancelada",
] as VisitaEstadoValue[]);

const VIATICO_TIPOS = new Set<VisitaViaticoTipoValue>([
  "peajes",
  "gasolina",
  "estadia",
  "alimentacion",
] as VisitaViaticoTipoValue[]);

const SOPORTE_MIME_TYPES = new Set<VisitaViaticoSoporte["mimeType"]>([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const MAX_SUPPORT_FILE_SIZE = 2.5 * 1024 * 1024;

const VISITAS_API_LOG_PREFIX = "[server/visitas-api]";
let cachedVisitaViaticosSupportColumns: boolean | null = null;
let visitaViaticosSupportColumnsPromise: Promise<boolean> | null = null;

function logVisitasInfo(message: string, metadata?: Record<string, unknown>) {
  if (metadata) {
    console.info(VISITAS_API_LOG_PREFIX, message, metadata);
    return;
  }

  console.info(VISITAS_API_LOG_PREFIX, message);
}

function logVisitasError(
  message: string,
  error: unknown,
  metadata?: Record<string, unknown>
) {
  console.error(VISITAS_API_LOG_PREFIX, message, {
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

function readNumber(value: unknown, fallback: number) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
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

function mapVisitaRow(row: VisitaRow): VisitaApiRecord {
  try {
    const fecha = parseDateValue(row.fecha);

    return {
      id: row.id,
      clienteId: row.cliente_id ?? undefined,
      clienteNombre: row.cliente_nombre ?? undefined,
      clienteEmpresa: row.cliente_empresa ?? undefined,
      prospectoId: row.prospecto_id ?? undefined,
      prospectoNombre: row.prospecto_nombre ?? undefined,
      prospectoEmpresa: row.prospecto_empresa ?? undefined,
      tipo: row.tipo,
      fecha: fecha.toISOString(),
      hora: row.hora,
      objetivo: row.objetivo,
      resultado: row.resultado,
      resultados: row.resultado,
      observaciones: row.observaciones ?? undefined,
      proximaAccion: row.proxima_accion ?? undefined,
      estado: row.estado,
      notas: row.observaciones ?? undefined,
    };
  } catch (error) {
    logVisitasError("mapVisitaRow:error", error, { id: row.id });
    throw error;
  }
}

function mapVisitaViaticoRow(row: VisitaViaticoRow): VisitaViaticoApiRecord {
  const fecha = parseDateValue(row.fecha);

  return {
    descripcion: row.descripcion,
    fecha: fecha.toISOString(),
    id: row.id,
    observaciones: row.observaciones ?? undefined,
    ...(row.soporte_nombre && row.soporte_tipo_mime
      ? {
          soporte: {
            fileName: row.soporte_nombre,
            fileSize: readNumber(row.soporte_tamano, 0),
            mimeType: row.soporte_tipo_mime as VisitaViaticoSoporte["mimeType"],
          },
        }
      : {}),
    tipoGasto: row.tipo_gasto,
    usuarioId: row.usuario_id ?? undefined,
    usuarioNombre: row.usuario_nombre ?? undefined,
    valor: readNumber(row.valor, 0),
    visitaId: row.visita_id,
  };
}

function buildResumenViaticos(
  viaticos: VisitaViaticoApiRecord[]
): ResumenViaticosVisita {
  const resumen: ResumenViaticosVisita = {
    alimentacion: 0,
    estadia: 0,
    gasolina: 0,
    peajes: 0,
    totalGeneral: 0,
  };

  for (const viatico of viaticos) {
    resumen[viatico.tipoGasto] += viatico.valor;
    resumen.totalGeneral += viatico.valor;
  }

  return resumen;
}

function isValidBase64(value: string) {
  return /^[A-Za-z0-9+/]+={0,2}$/.test(value);
}

function hasSupportPayloadChanges(payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return false;
  }

  const record = payload as {
    removeSoporte?: unknown;
    soporte?: unknown;
  };

  return Boolean(record.removeSoporte) || record.soporte !== undefined;
}

async function hasVisitaViaticoSupportColumns() {
  if (cachedVisitaViaticosSupportColumns !== null) {
    return cachedVisitaViaticosSupportColumns;
  }

  if (visitaViaticosSupportColumnsPromise) {
    return visitaViaticosSupportColumnsPromise;
  }

  visitaViaticosSupportColumnsPromise = (async () => {
    try {
      const sql = getSql();
      const rows = (await sql`
        SELECT COUNT(*)::int AS total
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'visita_viaticos'
          AND column_name IN (
            'soporte_nombre',
            'soporte_tipo_mime',
            'soporte_tamano',
            'soporte_contenido_base64'
          )
      `) as Array<{ total: number | string }>;

      const hasColumns = readNumber(rows[0]?.total, 0) >= 4;
      cachedVisitaViaticosSupportColumns = hasColumns;
      return hasColumns;
    } catch (error) {
      logVisitasError("hasVisitaViaticoSupportColumns:error", error);
      cachedVisitaViaticosSupportColumns = false;
      return false;
    } finally {
      visitaViaticosSupportColumnsPromise = null;
    }
  })();

  return visitaViaticosSupportColumnsPromise;
}

function parseVisitaViaticoSupport(
  value: unknown,
  fallback?: VisitaViaticoSoporteDraft
) {
  if (value === undefined) {
    return fallback;
  }

  if (value === null) {
    return undefined;
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("El soporte del viatico es invalido");
  }

  const payload = value as VisitaViaticoSupportPayload;
  const fileName = readString(payload.fileName) ?? "";
  const mimeType = readString(payload.mimeType) ?? "";
  const contentBase64 = readString(payload.contentBase64) ?? "";
  const fileSize = readNumber(payload.fileSize, NaN);

  if (!fileName) {
    throw new Error("El soporte debe incluir un nombre de archivo");
  }

  if (!SOPORTE_MIME_TYPES.has(mimeType as VisitaViaticoSoporte["mimeType"])) {
    throw new Error("Tipo de soporte invalido");
  }

  if (!contentBase64 || !isValidBase64(contentBase64)) {
    throw new Error("El contenido del soporte es invalido");
  }

  if (!Number.isFinite(fileSize) || fileSize <= 0) {
    throw new Error("El tamano del soporte es invalido");
  }

  if (fileSize > MAX_SUPPORT_FILE_SIZE) {
    throw new Error(
      "El soporte excede el tamano maximo permitido de 2.5 MB"
    );
  }

  return {
    contentBase64,
    fileName,
    fileSize: Math.round(fileSize),
    mimeType: mimeType as VisitaViaticoSoporte["mimeType"],
  };
}

function isValidTime(value: string) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

async function findClienteSummaryById(id: string) {
  logVisitasInfo("findClienteSummaryById:start", { id });

  try {
    const sql = getSql();
    const rows = (await sql`
      SELECT id, nombre, empresa
      FROM clientes
      WHERE id = ${id}
      LIMIT 1
    `) as RelatedSummary[];

    logVisitasInfo("findClienteSummaryById:success", {
      id,
      found: rows.length > 0,
    });

    return rows[0] ?? null;
  } catch (error) {
    logVisitasError("findClienteSummaryById:error", error, { id });
    throw error;
  }
}

async function findProspectoSummaryById(id: string) {
  logVisitasInfo("findProspectoSummaryById:start", { id });

  try {
    const sql = getSql();
    const rows = (await sql`
      SELECT id, nombre, empresa
      FROM prospectos
      WHERE id = ${id}
      LIMIT 1
    `) as RelatedSummary[];

    logVisitasInfo("findProspectoSummaryById:success", {
      id,
      found: rows.length > 0,
    });

    return rows[0] ?? null;
  } catch (error) {
    logVisitasError("findProspectoSummaryById:error", error, { id });
    throw error;
  }
}

async function buildVisita(
  payload: unknown,
  existing?: VisitaApiRecord
): Promise<VisitaDraft> {
  logVisitasInfo("buildVisita:start", {
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
    const tipoRaw = readString(payload.tipo) ?? existing?.tipo ?? "seguimiento";
    const fecha =
      readDate(
        payload.fecha as string | Date | null | undefined,
        existing?.fecha ? new Date(existing.fecha) : undefined
      ) ?? new Date();
    const hora = readString(payload.hora) ?? existing?.hora ?? "";
    const objetivo = readString(payload.objetivo) ?? existing?.objetivo ?? "";
    const resultado =
      readOptionalString(payload.resultado, existing?.resultado) ?? "";
    const observaciones = readOptionalString(
      payload.observaciones,
      existing?.observaciones
    );
    const proximaAccion = readOptionalString(
      payload.proximaAccion,
      existing?.proximaAccion
    );
    const estadoRaw =
      readString(payload.estado) ?? existing?.estado ?? "programada";

    if ((clienteId ? 1 : 0) + (prospectoId ? 1 : 0) !== 1) {
      throw new Error("Debes asociar la visita a un cliente o a un prospecto");
    }

    if (!VISITA_TIPOS.has(tipoRaw as VisitaTipoValue)) {
      throw new Error("Tipo de visita invalido");
    }

    if (!isValidTime(hora)) {
      throw new Error("La hora de la visita es invalida");
    }

    if (!objetivo) {
      throw new Error("El objetivo de la visita es obligatorio");
    }

    if (!VISITA_ESTADOS.has(estadoRaw as VisitaEstadoValue)) {
      throw new Error("Estado de visita invalido");
    }

    if (estadoRaw === "realizada" && !resultado) {
      throw new Error("Debes registrar un resultado para una visita realizada");
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

    const visita = {
      id: existing?.id ?? `vis-${nanoid(10)}`,
      ...(clienteId ? { clienteId } : {}),
      ...(prospectoId ? { prospectoId } : {}),
      tipo: tipoRaw as VisitaTipoValue,
      fecha,
      hora,
      objetivo,
      resultado,
      observaciones,
      proximaAccion,
      estado: estadoRaw as VisitaEstadoValue,
    };

    logVisitasInfo("buildVisita:success", {
      id: visita.id,
      existingId: existing?.id ?? null,
      clienteId: visita.clienteId ?? null,
      prospectoId: visita.prospectoId ?? null,
    });

    return visita;
  } catch (error) {
    logVisitasError("buildVisita:error", error, {
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

function sendBuffer(
  res: ServerResponse,
  statusCode: number,
  buffer: Buffer,
  contentType: string,
  fileName: string,
  dispositionType: "attachment" | "inline"
) {
  res.statusCode = statusCode;
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", contentType);
  res.setHeader(
    "Content-Disposition",
    `${dispositionType}; filename="${fileName}"; filename*=UTF-8''${encodeURIComponent(
      fileName
    )}`
  );
  res.setHeader("Content-Length", String(buffer.byteLength));
  res.end(buffer);
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
  logVisitasInfo("readJsonBody:start", {
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
    logVisitasError("readJsonBody:error", error, {
      method: req.method,
      url: req.url,
    });
    throw error;
  }
}

function getPathname(urlValue?: string) {
  return new URL(urlValue ?? "/", "http://localhost").pathname;
}

function isViaticosResourceRequest(urlValue?: string) {
  const url = new URL(urlValue ?? "/", "http://localhost");
  const resource = url.searchParams.get("resource")?.trim().toLowerCase();

  return resource === "viaticos";
}

function getViaticoIdFromRequestUrl(urlValue?: string) {
  const url = new URL(urlValue ?? "/", "http://localhost");
  const viaticoId = url.searchParams.get("viaticoId");
  return viaticoId ? decodeURIComponent(viaticoId) : null;
}

function getVisitaExportFormat(urlValue?: string) {
  const url = new URL(urlValue ?? "/", "http://localhost");
  const exportValue = url.searchParams.get("export")?.trim().toLowerCase();

  if (exportValue === "excel" || exportValue === "xlsx") {
    return "excel" as const;
  }

  if (exportValue === "pdf") {
    return "pdf" as const;
  }

  return null;
}

function isViaticoSupportRequest(urlValue?: string) {
  const url = new URL(urlValue ?? "/", "http://localhost");
  const supportValue = url.searchParams.get("support")?.trim().toLowerCase();
  const resourceValue = url.searchParams.get("subresource")?.trim().toLowerCase();

  return supportValue === "1" || supportValue === "true" || resourceValue === "support";
}

function resolveRequestOrigin(req: NodeRequest) {
  const origin = readString(req.headers.origin);

  if (origin) {
    return origin.replace(/\/+$/, "");
  }

  const protocolHeader = readString(req.headers["x-forwarded-proto"]);
  const hostHeader =
    readString(req.headers["x-forwarded-host"]) ||
    readString(req.headers.host);

  if (!hostHeader) {
    return undefined;
  }

  return `${protocolHeader ?? "http"}://${hostHeader}`.replace(/\/+$/, "");
}

function shouldDownloadViaticoSupport(urlValue?: string) {
  const url = new URL(urlValue ?? "/", "http://localhost");
  const downloadValue = url.searchParams.get("download")?.trim().toLowerCase();

  return downloadValue === "1" || downloadValue === "true" || downloadValue === "support";
}

export function getVisitaIdFromRequestUrl(urlValue?: string) {
  const match = getPathname(urlValue).match(/^\/api\/visitas\/([^/]+)\/?$/);
  return match ? decodeURIComponent(match[1]) : null;
}

async function listVisitas() {
  logVisitasInfo("listVisitas:start");

  try {
    const sql = getSql();
    const rows = (await sql`
      SELECT
        v.id,
        v.cliente_id,
        c.nombre AS cliente_nombre,
        c.empresa AS cliente_empresa,
        v.prospecto_id,
        p.nombre AS prospecto_nombre,
        p.empresa AS prospecto_empresa,
        v.tipo,
        v.fecha,
        v.hora,
        v.objetivo,
        v.resultado,
        v.observaciones,
        v.proxima_accion,
        v.estado
      FROM visitas v
      LEFT JOIN clientes c ON c.id = v.cliente_id
      LEFT JOIN prospectos p ON p.id = v.prospecto_id
      ORDER BY v.fecha DESC, v.hora DESC, v.id DESC
    `) as VisitaRow[];

    logVisitasInfo("listVisitas:success", { count: rows.length });
    return rows.map(mapVisitaRow);
  } catch (error) {
    logVisitasError("listVisitas:error", error);
    throw error;
  }
}

async function findVisitaById(id: string) {
  logVisitasInfo("findVisitaById:start", { id });

  try {
    const sql = getSql();
    const rows = (await sql`
      SELECT
        v.id,
        v.cliente_id,
        c.nombre AS cliente_nombre,
        c.empresa AS cliente_empresa,
        v.prospecto_id,
        p.nombre AS prospecto_nombre,
        p.empresa AS prospecto_empresa,
        v.tipo,
        v.fecha,
        v.hora,
        v.objetivo,
        v.resultado,
        v.observaciones,
        v.proxima_accion,
        v.estado
      FROM visitas v
      LEFT JOIN clientes c ON c.id = v.cliente_id
      LEFT JOIN prospectos p ON p.id = v.prospecto_id
      WHERE v.id = ${id}
      LIMIT 1
    `) as VisitaRow[];

    logVisitasInfo("findVisitaById:success", {
      id,
      found: rows.length > 0,
    });

    if (!rows[0]) {
      return null;
    }

    const visita = mapVisitaRow(rows[0]);
    const viaticos = await listVisitaViaticos(id);
    const resumenViaticos = buildResumenViaticos(viaticos);

    return {
      ...visita,
      resumenViaticos,
      totalViaticos: resumenViaticos.totalGeneral,
      viaticos,
    };
  } catch (error) {
    logVisitasError("findVisitaById:error", error, { id });
    throw error;
  }
}

async function listVisitaViaticos(visitaId: string) {
  logVisitasInfo("listVisitaViaticos:start", { visitaId });

  try {
    const sql = getSql();
    const hasSupportColumns = await hasVisitaViaticoSupportColumns();
    const rows = hasSupportColumns
      ? ((await sql`
          SELECT
            vv.id,
            vv.visita_id,
            vv.usuario_id,
            u.nombre AS usuario_nombre,
            vv.tipo_gasto,
            vv.fecha,
            vv.valor,
            vv.descripcion,
            vv.observaciones,
            vv.soporte_nombre,
            vv.soporte_tipo_mime,
            vv.soporte_tamano
          FROM visita_viaticos vv
          LEFT JOIN users u ON u.id = vv.usuario_id
          WHERE vv.visita_id = ${visitaId}
          ORDER BY vv.fecha DESC, vv.id DESC
        `) as VisitaViaticoRow[])
      : ((await sql`
          SELECT
            vv.id,
            vv.visita_id,
            vv.usuario_id,
            u.nombre AS usuario_nombre,
            vv.tipo_gasto,
            vv.fecha,
            vv.valor,
            vv.descripcion,
            vv.observaciones,
            NULL::text AS soporte_nombre,
            NULL::text AS soporte_tipo_mime,
            NULL::integer AS soporte_tamano
          FROM visita_viaticos vv
          LEFT JOIN users u ON u.id = vv.usuario_id
          WHERE vv.visita_id = ${visitaId}
          ORDER BY vv.fecha DESC, vv.id DESC
        `) as VisitaViaticoRow[]);

    logVisitasInfo("listVisitaViaticos:success", {
      visitaId,
      count: rows.length,
    });

    return rows.map(mapVisitaViaticoRow);
  } catch (error) {
    logVisitasError("listVisitaViaticos:error", error, { visitaId });
    throw error;
  }
}

async function findVisitaViaticoById(visitaId: string, viaticoId: string) {
  logVisitasInfo("findVisitaViaticoById:start", { visitaId, viaticoId });

  try {
    const sql = getSql();
    const hasSupportColumns = await hasVisitaViaticoSupportColumns();
    const rows = hasSupportColumns
      ? ((await sql`
          SELECT
            vv.id,
            vv.visita_id,
            vv.usuario_id,
            u.nombre AS usuario_nombre,
            vv.tipo_gasto,
            vv.fecha,
            vv.valor,
            vv.descripcion,
            vv.observaciones,
            vv.soporte_nombre,
            vv.soporte_tipo_mime,
            vv.soporte_tamano
          FROM visita_viaticos vv
          LEFT JOIN users u ON u.id = vv.usuario_id
          WHERE vv.visita_id = ${visitaId}
            AND vv.id = ${viaticoId}
          LIMIT 1
        `) as VisitaViaticoRow[])
      : ((await sql`
          SELECT
            vv.id,
            vv.visita_id,
            vv.usuario_id,
            u.nombre AS usuario_nombre,
            vv.tipo_gasto,
            vv.fecha,
            vv.valor,
            vv.descripcion,
            vv.observaciones,
            NULL::text AS soporte_nombre,
            NULL::text AS soporte_tipo_mime,
            NULL::integer AS soporte_tamano
          FROM visita_viaticos vv
          LEFT JOIN users u ON u.id = vv.usuario_id
          WHERE vv.visita_id = ${visitaId}
            AND vv.id = ${viaticoId}
          LIMIT 1
        `) as VisitaViaticoRow[]);

    return rows[0] ? mapVisitaViaticoRow(rows[0]) : null;
  } catch (error) {
    logVisitasError("findVisitaViaticoById:error", error, { visitaId, viaticoId });
    throw error;
  }
}

async function findVisitaViaticoSupportById(visitaId: string, viaticoId: string) {
  logVisitasInfo("findVisitaViaticoSupportById:start", { visitaId, viaticoId });

  try {
    if (!(await hasVisitaViaticoSupportColumns())) {
      return null;
    }

    const sql = getSql();
    const rows = (await sql`
      SELECT
        vv.id,
        vv.visita_id,
        vv.usuario_id,
        u.nombre AS usuario_nombre,
        vv.tipo_gasto,
        vv.fecha,
        vv.valor,
        vv.descripcion,
        vv.observaciones,
        vv.soporte_nombre,
        vv.soporte_tipo_mime,
        vv.soporte_tamano,
        vv.soporte_contenido_base64
      FROM visita_viaticos vv
      LEFT JOIN users u ON u.id = vv.usuario_id
      WHERE vv.visita_id = ${visitaId}
        AND vv.id = ${viaticoId}
      LIMIT 1
    `) as VisitaViaticoRow[];

    const row = rows[0];

    if (!row?.soporte_nombre || !row.soporte_tipo_mime || !row.soporte_contenido_base64) {
      return null;
    }

    const buffer = Buffer.from(row.soporte_contenido_base64, "base64");

    return {
      contentBase64: row.soporte_contenido_base64,
      fileName: row.soporte_nombre,
      fileSize: readNumber(row.soporte_tamano, buffer.byteLength),
      buffer,
      mimeType: row.soporte_tipo_mime as VisitaViaticoSoporte["mimeType"],
    };
  } catch (error) {
    logVisitasError("findVisitaViaticoSupportById:error", error, {
      visitaId,
      viaticoId,
    });
    throw error;
  }
}

async function insertVisita(payload: unknown) {
  logVisitasInfo("insertVisita:start", {
    payloadKeys: getPayloadKeys(payload),
  });

  try {
    const visita = await buildVisita(payload);
    const sql = getSql();
    const rows = (await sql`
      INSERT INTO visitas (
        id,
        cliente_id,
        prospecto_id,
        tipo,
        fecha,
        hora,
        objetivo,
        resultado,
        observaciones,
        proxima_accion,
        estado
      ) VALUES (
        ${visita.id},
        ${visita.clienteId ?? null},
        ${visita.prospectoId ?? null},
        ${visita.tipo},
        ${visita.fecha.toISOString()},
        ${visita.hora},
        ${visita.objetivo},
        ${visita.resultado},
        ${visita.observaciones ?? null},
        ${visita.proximaAccion ?? null},
        ${visita.estado}
      )
      RETURNING id
    `) as Array<{ id: string }>;

    const created = await findVisitaById(rows[0]?.id ?? visita.id);

    if (!created) {
      throw new Error("No se pudo recuperar la visita creada");
    }

    logVisitasInfo("insertVisita:success", {
      id: created.id,
    });

    return created;
  } catch (error) {
    logVisitasError("insertVisita:error", error, {
      payloadKeys: getPayloadKeys(payload),
    });
    throw error;
  }
}

async function updateExistingVisita(id: string, payload: unknown) {
  logVisitasInfo("updateExistingVisita:start", {
    id,
    payloadKeys: getPayloadKeys(payload),
  });

  try {
    const existing = await findVisitaById(id);

    if (!existing) {
      logVisitasInfo("updateExistingVisita:not-found", { id });
      return null;
    }

    const visita = await buildVisita(payload, existing);
    const sql = getSql();
    const rows = (await sql`
      UPDATE visitas
      SET
        cliente_id = ${visita.clienteId ?? null},
        prospecto_id = ${visita.prospectoId ?? null},
        tipo = ${visita.tipo},
        fecha = ${visita.fecha.toISOString()},
        hora = ${visita.hora},
        objetivo = ${visita.objetivo},
        resultado = ${visita.resultado},
        observaciones = ${visita.observaciones ?? null},
        proxima_accion = ${visita.proximaAccion ?? null},
        estado = ${visita.estado},
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING id
    `) as Array<{ id: string }>;

    const updated = await findVisitaById(rows[0]?.id ?? id);

    if (!updated) {
      throw new Error("No se pudo recuperar la visita actualizada");
    }

    logVisitasInfo("updateExistingVisita:success", { id: updated.id });
    return updated;
  } catch (error) {
    logVisitasError("updateExistingVisita:error", error, {
      id,
      payloadKeys: getPayloadKeys(payload),
    });
    throw error;
  }
}

async function buildVisitaViatico(
  visitaId: string,
  payload: unknown,
  usuarioId: string,
  existing?: VisitaViaticoApiRecord,
  existingSupport?: VisitaViaticoSoporteDraft
): Promise<VisitaViaticoDraft> {
  logVisitasInfo("buildVisitaViatico:start", {
    existingId: existing?.id ?? null,
    payloadKeys: getPayloadKeys(payload),
    visitaId,
  });

  try {
    assertPayload(payload);

    const tipoGastoRaw =
      readString(payload.tipoGasto) ?? existing?.tipoGasto ?? "";
    const fecha =
      readDate(
        payload.fecha as string | Date | null | undefined,
        existing?.fecha ? new Date(existing.fecha) : undefined
      ) ?? new Date();
    const valor = readNumber(payload.valor, existing?.valor ?? NaN);
    const descripcion =
      readString(payload.descripcion) ?? existing?.descripcion ?? "";
    const observaciones = readOptionalString(
      payload.observaciones,
      existing?.observaciones
    );
    const removeSoporte = payload.removeSoporte === true;
    const soporte = removeSoporte
      ? undefined
      : parseVisitaViaticoSupport(payload.soporte, existingSupport);

    if (!VIATICO_TIPOS.has(tipoGastoRaw as VisitaViaticoTipoValue)) {
      throw new Error("Tipo de gasto invalido");
    }

    if (!Number.isFinite(valor) || valor <= 0) {
      throw new Error("El valor del viatico debe ser mayor a cero");
    }

    if (!descripcion) {
      throw new Error("La descripcion del viatico es obligatoria");
    }

    return {
      descripcion,
      fecha,
      id: existing?.id ?? `via-${nanoid(10)}`,
      observaciones,
      ...(soporte ? { soporte } : {}),
      tipoGasto: tipoGastoRaw as VisitaViaticoTipoValue,
      usuarioId: existing?.usuarioId ?? usuarioId,
      valor: Math.round((valor + Number.EPSILON) * 100) / 100,
      visitaId,
    };
  } catch (error) {
    logVisitasError("buildVisitaViatico:error", error, {
      existingId: existing?.id ?? null,
      payloadKeys: getPayloadKeys(payload),
      visitaId,
    });
    throw error;
  }
}

async function insertVisitaViatico(
  req: NodeRequest,
  visitaId: string,
  payload: unknown
) {
  logVisitasInfo("insertVisitaViatico:start", { visitaId });

  const visita = await findVisitaById(visitaId);

  if (!visita) {
    return null;
  }

  const usuario = await getAuthenticatedUser(req);

  if (!usuario) {
    throw new Error("Debes iniciar sesion para registrar viaticos");
  }

  const viatico = await buildVisitaViatico(visitaId, payload, usuario.id);
  const sql = getSql();
  const hasSupportColumns = await hasVisitaViaticoSupportColumns();

  if (!hasSupportColumns && hasSupportPayloadChanges(payload)) {
    throw new Error(
      "La base actual no tiene habilitado el soporte de archivos para viaticos"
    );
  }

  if (hasSupportColumns) {
    await sql`
      INSERT INTO visita_viaticos (
        id,
        visita_id,
        usuario_id,
        tipo_gasto,
        fecha,
        valor,
        descripcion,
        observaciones,
        soporte_nombre,
        soporte_tipo_mime,
        soporte_tamano,
        soporte_contenido_base64
      ) VALUES (
        ${viatico.id},
        ${viatico.visitaId},
        ${viatico.usuarioId},
        ${viatico.tipoGasto},
        ${viatico.fecha.toISOString()},
        ${viatico.valor},
        ${viatico.descripcion},
        ${viatico.observaciones ?? null},
        ${viatico.soporte?.fileName ?? null},
        ${viatico.soporte?.mimeType ?? null},
        ${viatico.soporte?.fileSize ?? null},
        ${viatico.soporte?.contentBase64 ?? null}
      )
    `;
  } else {
    await sql`
      INSERT INTO visita_viaticos (
        id,
        visita_id,
        usuario_id,
        tipo_gasto,
        fecha,
        valor,
        descripcion,
        observaciones
      ) VALUES (
        ${viatico.id},
        ${viatico.visitaId},
        ${viatico.usuarioId},
        ${viatico.tipoGasto},
        ${viatico.fecha.toISOString()},
        ${viatico.valor},
        ${viatico.descripcion},
        ${viatico.observaciones ?? null}
      )
    `;
  }

  return findVisitaById(visitaId);
}

async function updateExistingVisitaViatico(
  req: NodeRequest,
  visitaId: string,
  viaticoId: string,
  payload: unknown
) {
  logVisitasInfo("updateExistingVisitaViatico:start", { visitaId, viaticoId });

  const visita = await findVisitaById(visitaId);

  if (!visita) {
    return null;
  }

  const existingViatico = await findVisitaViaticoById(visitaId, viaticoId);

  if (!existingViatico) {
    return "viatico-not-found" as const;
  }

  const usuario = await getAuthenticatedUser(req);

  if (!usuario) {
    throw new Error("Debes iniciar sesion para editar viaticos");
  }

  const existingSupport = await findVisitaViaticoSupportById(visitaId, viaticoId);

  const viatico = await buildVisitaViatico(
    visitaId,
    payload,
    usuario.id,
    existingViatico,
    existingSupport ?? undefined
  );
  const sql = getSql();
  const hasSupportColumns = await hasVisitaViaticoSupportColumns();

  if (!hasSupportColumns && hasSupportPayloadChanges(payload)) {
    throw new Error(
      "La base actual no tiene habilitado el soporte de archivos para viaticos"
    );
  }

  if (hasSupportColumns) {
    await sql`
      UPDATE visita_viaticos
      SET
        tipo_gasto = ${viatico.tipoGasto},
        fecha = ${viatico.fecha.toISOString()},
        valor = ${viatico.valor},
        descripcion = ${viatico.descripcion},
        observaciones = ${viatico.observaciones ?? null},
        soporte_nombre = ${viatico.soporte?.fileName ?? null},
        soporte_tipo_mime = ${viatico.soporte?.mimeType ?? null},
        soporte_tamano = ${viatico.soporte?.fileSize ?? null},
        soporte_contenido_base64 = ${viatico.soporte?.contentBase64 ?? null},
        updated_at = NOW()
      WHERE id = ${viaticoId}
        AND visita_id = ${visitaId}
    `;
  } else {
    await sql`
      UPDATE visita_viaticos
      SET
        tipo_gasto = ${viatico.tipoGasto},
        fecha = ${viatico.fecha.toISOString()},
        valor = ${viatico.valor},
        descripcion = ${viatico.descripcion},
        observaciones = ${viatico.observaciones ?? null},
        updated_at = NOW()
      WHERE id = ${viaticoId}
        AND visita_id = ${visitaId}
    `;
  }

  return findVisitaById(visitaId);
}

async function removeVisitaViatico(
  visitaId: string,
  viaticoId: string
) {
  logVisitasInfo("removeVisitaViatico:start", { visitaId, viaticoId });

  const visita = await findVisitaById(visitaId);

  if (!visita) {
    return null;
  }

  const sql = getSql();
  const rows = (await sql`
    DELETE FROM visita_viaticos
    WHERE id = ${viaticoId}
      AND visita_id = ${visitaId}
    RETURNING id
  `) as Array<{ id: string }>;

  if (rows.length === 0) {
    return "viatico-not-found" as const;
  }

  return findVisitaById(visitaId);
}

async function removeVisita(id: string) {
  logVisitasInfo("removeVisita:start", { id });

  try {
    const sql = getSql();
    const rows = (await sql`
      DELETE FROM visitas
      WHERE id = ${id}
      RETURNING id
    `) as Array<{ id: string }>;

    logVisitasInfo("removeVisita:success", {
      id,
      deleted: rows.length > 0,
    });

    return rows.length > 0;
  } catch (error) {
    logVisitasError("removeVisita:error", error, { id });
    throw error;
  }
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function isValidationError(error: unknown) {
  return (
    error instanceof Error &&
    /invalido|obligatorio|obligatoria|cliente|prospecto|hora|resultado|objetivo|gasto|viatico|valor|descripcion|soporte|tamano|archivo/i.test(
      error.message
    )
  );
}

export async function handleVisitasCollection(
  req: NodeRequest,
  res: ServerResponse
) {
  logVisitasInfo("handleVisitasCollection:start", {
    method: req.method,
    url: req.url,
  });

  try {
    if (req.method === "GET") {
      const visitas = await listVisitas();
      sendJson(res, 200, visitas);
      logVisitasInfo("handleVisitasCollection:response", {
        method: req.method,
        url: req.url,
        statusCode: 200,
        count: visitas.length,
      });
      return;
    }

    if (req.method === "POST") {
      const payload = await readJsonBody(req);
      const visita = await insertVisita(payload);
      sendJson(res, 201, visita);
      logVisitasInfo("handleVisitasCollection:response", {
        method: req.method,
        url: req.url,
        statusCode: 201,
        id: visita.id,
      });
      return;
    }

    sendMethodNotAllowed(res, ["GET", "POST"]);
  } catch (error) {
    const statusCode = isValidationError(error) ? 400 : 500;
    const detail = getErrorMessage(error, "No se pudo procesar la solicitud");

    logVisitasError("handleVisitasCollection:error", error, {
      method: req.method,
      url: req.url,
      statusCode,
    });

    sendErrorJson(
      res,
      statusCode,
      statusCode === 400
        ? "Solicitud invalida en /api/visitas"
        : "Error interno en /api/visitas",
      detail
    );
  }
}

export async function handleVisitaItem(
  req: NodeRequest,
  res: ServerResponse,
  id: string
) {
  logVisitasInfo("handleVisitaItem:start", {
    method: req.method,
    url: req.url,
    id,
  });

  try {
    if (!id) {
      sendErrorJson(
        res,
        400,
        "Visita invalida",
        "Se recibio un id vacio para /api/visitas/[id]"
      );
      return;
    }

    if (req.method === "GET") {
      if (isViaticosResourceRequest(req.url) && isViaticoSupportRequest(req.url)) {
        const viaticoId = getViaticoIdFromRequestUrl(req.url);

        if (!viaticoId) {
          sendErrorJson(
            res,
            400,
            "Viatico invalido",
            "Debes indicar un viaticoId valido"
          );
          return;
        }

        const visita = await findVisitaById(id);

        if (!visita) {
          sendErrorJson(
            res,
            404,
            "Visita no encontrada",
            `No existe una visita con id ${id}`
          );
          return;
        }

        const soporte = await findVisitaViaticoSupportById(id, viaticoId);

        if (!soporte) {
          sendErrorJson(
            res,
            404,
            "Soporte no encontrado",
            `No existe soporte para el viatico ${viaticoId} de la visita ${id}`
          );
          return;
        }

        sendBuffer(
          res,
          200,
          soporte.buffer,
          soporte.mimeType,
          soporte.fileName,
          shouldDownloadViaticoSupport(req.url) ? "attachment" : "inline"
        );
        logVisitasInfo("handleVisitaItem:response", {
          action: shouldDownloadViaticoSupport(req.url)
            ? "download-viatico-support"
            : "view-viatico-support",
          id,
          method: req.method,
          statusCode: 200,
          url: req.url,
          viaticoId,
        });
        return;
      }

      const visita = await findVisitaById(id);

      if (!visita) {
        sendErrorJson(
          res,
          404,
          "Visita no encontrada",
          `No existe una visita con id ${id}`
        );
        return;
      }

      const exportFormat = getVisitaExportFormat(req.url);

      if (exportFormat) {
        const baseUrl = readString(process.env.PUBLIC_APP_URL) ?? resolveRequestOrigin(req);
        const exported =
          exportFormat === "excel"
            ? await generateVisitaViaticosExcel(visita, baseUrl)
            : await generateVisitaViaticosPdf(visita, baseUrl);

        sendBuffer(
          res,
          200,
          exported.buffer,
          exported.contentType,
          exported.fileName,
          "attachment"
        );
        logVisitasInfo("handleVisitaItem:response", {
          action: `export-${exportFormat}`,
          id,
          method: req.method,
          statusCode: 200,
          url: req.url,
        });
        return;
      }

      sendJson(res, 200, visita);
      logVisitasInfo("handleVisitaItem:response", {
        method: req.method,
        url: req.url,
        id,
        statusCode: 200,
      });
      return;
    }

    if (req.method === "POST" && isViaticosResourceRequest(req.url)) {
      const payload = await readJsonBody(req);
      const visita = await insertVisitaViatico(req, id, payload);

      if (!visita) {
        sendErrorJson(
          res,
          404,
          "Visita no encontrada",
          `No existe una visita con id ${id}`
        );
        return;
      }

      sendJson(res, 201, visita);
      logVisitasInfo("handleVisitaItem:response", {
        action: "create-viatico",
        id,
        method: req.method,
        statusCode: 201,
        url: req.url,
      });
      return;
    }

    if (req.method === "PUT") {
      if (isViaticosResourceRequest(req.url)) {
        const viaticoId = getViaticoIdFromRequestUrl(req.url);

        if (!viaticoId) {
          sendErrorJson(
            res,
            400,
            "Viatico invalido",
            "Debes indicar un viaticoId valido"
          );
          return;
        }

        const payload = await readJsonBody(req);
        const visita = await updateExistingVisitaViatico(
          req,
          id,
          viaticoId,
          payload
        );

        if (!visita) {
          sendErrorJson(
            res,
            404,
            "Visita no encontrada",
            `No existe una visita con id ${id}`
          );
          return;
        }

        if (visita === "viatico-not-found") {
          sendErrorJson(
            res,
            404,
            "Viatico no encontrado",
            `No existe un viatico con id ${viaticoId} para la visita ${id}`
          );
          return;
        }

        sendJson(res, 200, visita);
        logVisitasInfo("handleVisitaItem:response", {
          action: "update-viatico",
          id,
          method: req.method,
          statusCode: 200,
          url: req.url,
          viaticoId,
        });
        return;
      }

      const payload = await readJsonBody(req);
      const visita = await updateExistingVisita(id, payload);

      if (!visita) {
        sendErrorJson(
          res,
          404,
          "Visita no encontrada",
          `No existe una visita con id ${id}`
        );
        return;
      }

      sendJson(res, 200, visita);
      logVisitasInfo("handleVisitaItem:response", {
        method: req.method,
        url: req.url,
        id,
        statusCode: 200,
      });
      return;
    }

    if (req.method === "DELETE") {
      if (isViaticosResourceRequest(req.url)) {
        const viaticoId = getViaticoIdFromRequestUrl(req.url);

        if (!viaticoId) {
          sendErrorJson(
            res,
            400,
            "Viatico invalido",
            "Debes indicar un viaticoId valido"
          );
          return;
        }

        const visita = await removeVisitaViatico(id, viaticoId);

        if (!visita) {
          sendErrorJson(
            res,
            404,
            "Visita no encontrada",
            `No existe una visita con id ${id}`
          );
          return;
        }

        if (visita === "viatico-not-found") {
          sendErrorJson(
            res,
            404,
            "Viatico no encontrado",
            `No existe un viatico con id ${viaticoId} para la visita ${id}`
          );
          return;
        }

        sendJson(res, 200, visita);
        logVisitasInfo("handleVisitaItem:response", {
          action: "delete-viatico",
          id,
          method: req.method,
          statusCode: 200,
          url: req.url,
          viaticoId,
        });
        return;
      }

      const deleted = await removeVisita(id);

      if (!deleted) {
        sendErrorJson(
          res,
          404,
          "Visita no encontrada",
          `No existe una visita con id ${id}`
        );
        return;
      }

      sendEmpty(res, 204);
      logVisitasInfo("handleVisitaItem:response", {
        method: req.method,
        url: req.url,
        id,
        statusCode: 204,
      });
      return;
    }

    sendMethodNotAllowed(res, ["GET", "POST", "PUT", "DELETE"]);
  } catch (error) {
    const statusCode = isValidationError(error) ? 400 : 500;
    const detail = getErrorMessage(error, "No se pudo procesar la solicitud");

    logVisitasError("handleVisitaItem:error", error, {
      method: req.method,
      url: req.url,
      id,
      statusCode,
    });

    sendErrorJson(
      res,
      statusCode,
      statusCode === 400
        ? "Solicitud invalida en /api/visitas/[id]"
        : "Error interno en /api/visitas/[id]",
      detail
    );
  }
}

export function createVisitasDevMiddleware() {
  return (req: NodeRequest, res: ServerResponse, next: ConnectNext) => {
    const pathname = getPathname(req.url);

    if (pathname === "/api/visitas" || pathname === "/api/visitas/") {
      void handleVisitasCollection(req, res).catch(next);
      return;
    }

    const visitaId = getVisitaIdFromRequestUrl(req.url);

    if (visitaId) {
      void handleVisitaItem(req, res, visitaId).catch(next);
      return;
    }

    next();
  };
}
