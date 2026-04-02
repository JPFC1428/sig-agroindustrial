import type { IncomingMessage, ServerResponse } from "node:http";
import { nanoid } from "nanoid";
import type { Cotizacion, LineaCotizacion } from "../client/src/lib/types.js";
import { getAuthenticatedUser } from "./auth-api.js";
import { normalizeEmail } from "./auth-utils.js";
import {
  buildDefaultCotizacionEmailMessage,
  buildDefaultCotizacionEmailSubject,
  isCotizacionEmailConfigError,
  sendCotizacionEmail,
} from "./cotizaciones-email.js";
import { generateCotizacionExcel } from "./cotizaciones-excel.js";
import { getSql } from "./neon.js";

type CotizacionEstadoValue = Cotizacion["estado"];
type CotizacionMonedaValue = Cotizacion["moneda"];

type CotizacionApiRecord = Omit<Cotizacion, "fecha" | "fechaVencimiento"> & {
  fecha: string;
  fechaVencimiento: string;
};

type CotizacionItemApiRecord = LineaCotizacion;

type NodeRequest = IncomingMessage & {
  body?: unknown;
};

type ConnectNext = (error?: unknown) => void;

type CotizacionRow = {
  id: string;
  numero: string;
  cliente_id: string | null;
  cliente_email: string | null;
  cliente_nombre: string | null;
  cliente_empresa: string | null;
  fecha: string | Date;
  fecha_vencimiento: string | Date;
  estado: CotizacionEstadoValue;
  subtotal: number | string;
  impuesto: number | string;
  descuento_global: number | string | null;
  total: number | string;
  moneda: CotizacionMonedaValue;
  condiciones_pago: string;
  notas: string | null;
  items: unknown;
};

type ClienteSummaryRow = {
  id: string;
  nombre: string;
  empresa: string;
};

type ClienteExcelRow = ClienteSummaryRow & {
  nit: string | null;
  telefono: string | null;
  email: string | null;
  direccion: string | null;
  ciudad: string | null;
  contacto_principal: string | null;
};

type CotizacionItemDraft = {
  id: string;
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
  descuento: number;
  subtotal: number;
  orden: number;
};

type CotizacionDraft = {
  id: string;
  numero: string;
  clienteId: string;
  fecha: Date;
  fechaVencimiento: Date;
  estado: CotizacionEstadoValue;
  lineas: CotizacionItemDraft[];
  subtotal: number;
  impuesto: number;
  descuentoGlobal: number;
  total: number;
  moneda: CotizacionMonedaValue;
  condicionesPago: string;
  notas?: string;
};

type CotizacionEnvioEstado = "enviado" | "error";

type CotizacionEnvioRow = {
  asunto: string;
  cotizacion_id: string;
  destinatario: string;
  estado: CotizacionEnvioEstado;
  fecha_envio: string | Date;
  id: string;
  usuario_envio: string | null;
};

type CotizacionEnvioApiRecord = {
  asunto: string;
  cotizacionId: string;
  destinatario: string;
  estado: CotizacionEnvioEstado;
  fechaEnvio: string;
  id: string;
  usuarioEnvio?: string;
};

type CotizacionEmailDraft = {
  asunto: string;
  destinatario: string;
  mensaje: string;
};

type CotizacionSendResponse = {
  cotizacion: CotizacionApiRecord;
  envio: CotizacionEnvioApiRecord;
};

type CotizacionWhatsappRow = {
  cotizacion_id: string;
  estado: "preparado";
  fecha_preparado: string | Date;
  id: string;
  mensaje: string;
  telefono_destino: string;
  url_cotizacion: string | null;
  url_whatsapp: string;
  usuario_preparo: string | null;
};

type CotizacionWhatsappApiRecord = {
  cotizacionId: string;
  estado: "preparado";
  fechaPreparado: string;
  id: string;
  mensaje: string;
  telefonoDestino: string;
  urlCotizacion?: string;
  urlWhatsapp: string;
  usuarioPreparo?: string;
};

type CotizacionWhatsappResponse = {
  cotizacion: CotizacionApiRecord;
  whatsapp: CotizacionWhatsappApiRecord;
};

const COTIZACION_ESTADOS = new Set<CotizacionEstadoValue>([
  "borrador",
  "enviada",
  "aprobada",
  "rechazada",
] as CotizacionEstadoValue[]);

const MONEDAS = new Set<CotizacionMonedaValue>([
  "COP",
  "USD",
] as CotizacionMonedaValue[]);

const COTIZACIONES_API_LOG_PREFIX = "[server/cotizaciones-api]";

function logCotizacionesInfo(
  message: string,
  metadata?: Record<string, unknown>
) {
  if (metadata) {
    console.info(COTIZACIONES_API_LOG_PREFIX, message, metadata);
    return;
  }

  console.info(COTIZACIONES_API_LOG_PREFIX, message);
}

function logCotizacionesError(
  message: string,
  error: unknown,
  metadata?: Record<string, unknown>
) {
  console.error(COTIZACIONES_API_LOG_PREFIX, message, {
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

function roundCurrency(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
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

  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readOptionalNumber(
  value: unknown,
  errorMessage: string,
  fallback?: number
) {
  if (value === undefined) {
    return fallback;
  }

  if (value === null || value === "") {
    return undefined;
  }

  const parsed = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(parsed)) {
    throw new Error(errorMessage);
  }

  return parsed;
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
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

function mapCotizacionEnvioRow(row: CotizacionEnvioRow): CotizacionEnvioApiRecord {
  const fechaEnvio = parseDateValue(row.fecha_envio);

  return {
    asunto: row.asunto,
    cotizacionId: row.cotizacion_id,
    destinatario: row.destinatario,
    estado: row.estado,
    fechaEnvio: fechaEnvio.toISOString(),
    id: row.id,
    ...(row.usuario_envio ? { usuarioEnvio: row.usuario_envio } : {}),
  };
}

function mapCotizacionWhatsappRow(
  row: CotizacionWhatsappRow
): CotizacionWhatsappApiRecord {
  const fechaPreparado = parseDateValue(row.fecha_preparado);

  return {
    cotizacionId: row.cotizacion_id,
    estado: row.estado,
    fechaPreparado: fechaPreparado.toISOString(),
    id: row.id,
    mensaje: row.mensaje,
    telefonoDestino: row.telefono_destino,
    ...(row.url_cotizacion ? { urlCotizacion: row.url_cotizacion } : {}),
    urlWhatsapp: row.url_whatsapp,
    ...(row.usuario_preparo ? { usuarioPreparo: row.usuario_preparo } : {}),
  };
}

function parseItemsValue(itemsValue: unknown): CotizacionItemApiRecord[] {
  const rawItems =
    typeof itemsValue === "string" ? JSON.parse(itemsValue) : itemsValue;

  if (!Array.isArray(rawItems)) {
    return [];
  }

  return rawItems.map((item, index) => {
    assertPayload(item);

    return {
      id: readString(item.id) ?? `cit-${index + 1}`,
      descripcion: readString(item.descripcion) ?? "",
      cantidad: readNumber(item.cantidad, 0),
      precioUnitario: readNumber(item.precioUnitario, 0),
      descuento: readNumber(item.descuento, 0),
      subtotal: readNumber(item.subtotal, 0),
    };
  });
}

function mapCotizacionRow(row: CotizacionRow): CotizacionApiRecord {
  try {
    const fecha = parseDateValue(row.fecha);
    const fechaVencimiento = parseDateValue(row.fecha_vencimiento);
    const lineas = parseItemsValue(row.items);

    return {
      id: row.id,
      numero: row.numero,
      clienteId: row.cliente_id ?? undefined,
      clienteEmail: row.cliente_email ?? undefined,
      clienteNombre: row.cliente_nombre ?? undefined,
      clienteEmpresa: row.cliente_empresa ?? undefined,
      fecha: fecha.toISOString(),
      fechaVencimiento: fechaVencimiento.toISOString(),
      estado: row.estado,
      lineas,
      subtotal: readNumber(row.subtotal, 0),
      impuesto: readNumber(row.impuesto, 0),
      descuentoGlobal: readNumber(row.descuento_global, 0),
      total: readNumber(row.total, 0),
      moneda: row.moneda,
      condicionesPago: row.condiciones_pago,
      notas: row.notas ?? undefined,
    };
  } catch (error) {
    logCotizacionesError("mapCotizacionRow:error", error, { id: row.id });
    throw error;
  }
}

function buildCotizacionLineas(
  lineasValue: unknown,
  fallbackLineas?: CotizacionApiRecord["lineas"]
) {
  const rawLineas = Array.isArray(lineasValue) ? lineasValue : fallbackLineas;

  if (!rawLineas || rawLineas.length === 0) {
    throw new Error("Debes agregar al menos una linea de cotizacion");
  }

  return rawLineas.map((lineaValue, index) => {
    assertPayload(lineaValue);

    const descripcion = readString(lineaValue.descripcion) ?? "";
    const cantidad = readOptionalNumber(
      lineaValue.cantidad,
      "Cantidad invalida en una linea de cotizacion"
    );
    const precioUnitario = readOptionalNumber(
      lineaValue.precioUnitario,
      "Precio unitario invalido en una linea de cotizacion"
    );
    const descuento =
      readOptionalNumber(
        lineaValue.descuento,
        "Descuento invalido en una linea de cotizacion",
        0
      ) ?? 0;

    if (!descripcion) {
      throw new Error("Cada linea debe tener una descripcion");
    }

    if (cantidad === undefined || cantidad <= 0) {
      throw new Error("La cantidad debe ser mayor a cero");
    }

    if (precioUnitario === undefined || precioUnitario < 0) {
      throw new Error("El precio unitario no puede ser negativo");
    }

    if (descuento < 0 || descuento > 100) {
      throw new Error("El descuento por linea debe estar entre 0 y 100");
    }

    const subtotal = roundCurrency(
      cantidad * precioUnitario * (1 - descuento / 100)
    );

    return {
      id: `cit-${nanoid(10)}`,
      descripcion,
      cantidad: roundCurrency(cantidad),
      precioUnitario: roundCurrency(precioUnitario),
      descuento: roundCurrency(descuento),
      subtotal,
      orden: index,
    };
  });
}

function generateCotizacionNumero(fecha: Date) {
  const year = fecha.getFullYear();
  return `COT-${year}-${nanoid(6).toUpperCase()}`;
}

async function findClienteSummaryById(id: string) {
  logCotizacionesInfo("findClienteSummaryById:start", { id });

  try {
    const sql = getSql();
    const rows = (await sql`
      SELECT id, nombre, empresa
      FROM clientes
      WHERE id = ${id}
      LIMIT 1
    `) as ClienteSummaryRow[];

    logCotizacionesInfo("findClienteSummaryById:success", {
      id,
      found: rows.length > 0,
    });

    return rows[0] ?? null;
  } catch (error) {
    logCotizacionesError("findClienteSummaryById:error", error, { id });
    throw error;
  }
}

async function findClienteExcelById(id: string) {
  logCotizacionesInfo("findClienteExcelById:start", { id });

  try {
    const sql = getSql();
    const rows = (await sql`
      SELECT
        id,
        nombre,
        empresa,
        nit,
        telefono,
        email,
        direccion,
        ciudad,
        contacto_principal
      FROM clientes
      WHERE id = ${id}
      LIMIT 1
    `) as ClienteExcelRow[];

    logCotizacionesInfo("findClienteExcelById:success", {
      id,
      found: rows.length > 0,
    });

    return rows[0] ?? null;
  } catch (error) {
    logCotizacionesError("findClienteExcelById:error", error, { id });
    throw error;
  }
}

async function buildCotizacion(
  payload: unknown,
  existing?: CotizacionApiRecord
): Promise<CotizacionDraft> {
  logCotizacionesInfo("buildCotizacion:start", {
    existingId: existing?.id ?? null,
    payloadKeys: getPayloadKeys(payload),
  });

  try {
    assertPayload(payload);

    const clienteId = readString(payload.clienteId) ?? existing?.clienteId ?? "";
    const fecha =
      readDate(
        payload.fecha as string | Date | null | undefined,
        existing?.fecha ? new Date(existing.fecha) : undefined
      ) ?? new Date();
    const fechaVencimiento = readDate(
      payload.fechaVencimiento as string | Date | null | undefined,
      existing?.fechaVencimiento
        ? new Date(existing.fechaVencimiento)
        : undefined
    );
    const estadoRaw =
      readString(payload.estado) ?? existing?.estado ?? "borrador";
    const monedaRaw =
      readString(payload.moneda) ?? existing?.moneda ?? "COP";
    const condicionesPago =
      readString(payload.condicionesPago) ??
      existing?.condicionesPago ??
      "";
    const lineas = buildCotizacionLineas(payload.lineas, existing?.lineas);
    const subtotal = roundCurrency(
      lineas.reduce((accumulator, linea) => accumulator + linea.subtotal, 0)
    );
    const impuesto =
      readOptionalNumber(
        payload.impuesto,
        "El impuesto es invalido",
        existing?.impuesto ?? 0
      ) ?? 0;
    const descuentoGlobal =
      readOptionalNumber(
        payload.descuentoGlobal,
        "El descuento global es invalido",
        existing?.descuentoGlobal ?? 0
      ) ?? 0;

    if (!clienteId) {
      throw new Error("Debes seleccionar un cliente");
    }

    const cliente = await findClienteSummaryById(clienteId);

    if (!cliente) {
      throw new Error("El cliente seleccionado no existe");
    }

    if (!fechaVencimiento) {
      throw new Error("La fecha de vencimiento es obligatoria");
    }

    if (fechaVencimiento.getTime() < fecha.getTime()) {
      throw new Error(
        "La fecha de vencimiento no puede ser anterior a la fecha de cotizacion"
      );
    }

    if (
      !estadoRaw ||
      !COTIZACION_ESTADOS.has(estadoRaw as CotizacionEstadoValue)
    ) {
      throw new Error("Estado de cotizacion invalido");
    }

    if (!MONEDAS.has(monedaRaw as CotizacionMonedaValue)) {
      throw new Error("Moneda invalida");
    }

    if (!condicionesPago) {
      throw new Error("Las condiciones de pago son obligatorias");
    }

    if (impuesto < 0) {
      throw new Error("El impuesto no puede ser negativo");
    }

    if (descuentoGlobal < 0) {
      throw new Error("El descuento global no puede ser negativo");
    }

    if (descuentoGlobal > subtotal) {
      throw new Error(
        "El descuento global no puede ser mayor al subtotal de la cotizacion"
      );
    }

    const total = roundCurrency(subtotal - descuentoGlobal + impuesto);

    if (total < 0) {
      throw new Error("El total de la cotizacion no puede ser negativo");
    }

    const cotizacion = {
      id: existing?.id ?? `cot-${nanoid(10)}`,
      numero: existing?.numero ?? generateCotizacionNumero(fecha),
      clienteId: cliente.id,
      fecha,
      fechaVencimiento,
      estado: estadoRaw as CotizacionEstadoValue,
      lineas,
      subtotal,
      impuesto: roundCurrency(impuesto),
      descuentoGlobal: roundCurrency(descuentoGlobal),
      total,
      moneda: monedaRaw as CotizacionMonedaValue,
      condicionesPago,
      notas: readOptionalString(payload.notas, existing?.notas),
    };

    logCotizacionesInfo("buildCotizacion:success", {
      id: cotizacion.id,
      existingId: existing?.id ?? null,
      clienteId: cotizacion.clienteId,
      total: cotizacion.total,
    });

    return cotizacion;
  } catch (error) {
    logCotizacionesError("buildCotizacion:error", error, {
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
  fileName: string
) {
  res.statusCode = statusCode;
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", contentType);
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${fileName}"; filename*=UTF-8''${encodeURIComponent(
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
  logCotizacionesInfo("readJsonBody:start", {
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
    logCotizacionesError("readJsonBody:error", error, {
      method: req.method,
      url: req.url,
    });
    throw error;
  }
}

function getPathname(urlValue?: string) {
  return new URL(urlValue ?? "/", "http://localhost").pathname;
}

function shouldDownloadCotizacionExcel(urlValue?: string) {
  const url = new URL(urlValue ?? "/", "http://localhost");
  const downloadValue = url.searchParams.get("download")?.trim().toLowerCase();

  return downloadValue === "excel" || downloadValue === "xlsx";
}

function shouldSendCotizacionByEmail(urlValue?: string) {
  const url = new URL(urlValue ?? "/", "http://localhost");
  const sendValue = url.searchParams.get("send")?.trim().toLowerCase();
  const actionValue = url.searchParams.get("action")?.trim().toLowerCase();

  return sendValue === "email" || actionValue === "send";
}

function shouldPrepareCotizacionWhatsapp(urlValue?: string) {
  const url = new URL(urlValue ?? "/", "http://localhost");
  const sendValue = url.searchParams.get("send")?.trim().toLowerCase();
  const actionValue = url.searchParams.get("action")?.trim().toLowerCase();

  return sendValue === "whatsapp" || actionValue === "whatsapp";
}

export function getCotizacionIdFromRequestUrl(urlValue?: string) {
  const match = getPathname(urlValue).match(/^\/api\/cotizaciones\/([^/]+)\/?$/);
  return match ? decodeURIComponent(match[1]) : null;
}

async function listCotizaciones() {
  logCotizacionesInfo("listCotizaciones:start");

  try {
    const sql = getSql();
    const rows = (await sql`
      SELECT
        c.id,
        c.numero,
        c.cliente_id,
        cl.email AS cliente_email,
        cl.nombre AS cliente_nombre,
        cl.empresa AS cliente_empresa,
        c.fecha,
        c.fecha_vencimiento,
        c.estado,
        c.subtotal,
        c.impuesto,
        c.descuento_global,
        c.total,
        c.moneda,
        c.condiciones_pago,
        c.notas,
        COALESCE(
          JSON_AGG(
            JSON_BUILD_OBJECT(
              'id', ci.id,
              'descripcion', ci.descripcion,
              'cantidad', ci.cantidad,
              'precioUnitario', ci.precio_unitario,
              'descuento', ci.descuento,
              'subtotal', ci.subtotal
            )
            ORDER BY ci.orden, ci.id
          ) FILTER (WHERE ci.id IS NOT NULL),
          '[]'::json
        ) AS items
      FROM cotizaciones c
      LEFT JOIN clientes cl ON cl.id = c.cliente_id
      LEFT JOIN cotizacion_items ci ON ci.cotizacion_id = c.id
      GROUP BY
        c.id,
        c.numero,
        c.cliente_id,
        cl.email,
        cl.nombre,
        cl.empresa,
        c.fecha,
        c.fecha_vencimiento,
        c.estado,
        c.subtotal,
        c.impuesto,
        c.descuento_global,
        c.total,
        c.moneda,
        c.condiciones_pago,
        c.notas
      ORDER BY c.fecha DESC, c.id DESC
    `) as CotizacionRow[];

    logCotizacionesInfo("listCotizaciones:success", { count: rows.length });
    return rows.map(mapCotizacionRow);
  } catch (error) {
    logCotizacionesError("listCotizaciones:error", error);
    throw error;
  }
}

async function findCotizacionById(id: string) {
  logCotizacionesInfo("findCotizacionById:start", { id });

  try {
    const sql = getSql();
    const rows = (await sql`
      SELECT
        c.id,
        c.numero,
        c.cliente_id,
        cl.email AS cliente_email,
        cl.nombre AS cliente_nombre,
        cl.empresa AS cliente_empresa,
        c.fecha,
        c.fecha_vencimiento,
        c.estado,
        c.subtotal,
        c.impuesto,
        c.descuento_global,
        c.total,
        c.moneda,
        c.condiciones_pago,
        c.notas,
        COALESCE(
          JSON_AGG(
            JSON_BUILD_OBJECT(
              'id', ci.id,
              'descripcion', ci.descripcion,
              'cantidad', ci.cantidad,
              'precioUnitario', ci.precio_unitario,
              'descuento', ci.descuento,
              'subtotal', ci.subtotal
            )
            ORDER BY ci.orden, ci.id
          ) FILTER (WHERE ci.id IS NOT NULL),
          '[]'::json
        ) AS items
      FROM cotizaciones c
      LEFT JOIN clientes cl ON cl.id = c.cliente_id
      LEFT JOIN cotizacion_items ci ON ci.cotizacion_id = c.id
      WHERE c.id = ${id}
      GROUP BY
        c.id,
        c.numero,
        c.cliente_id,
        cl.email,
        cl.nombre,
        cl.empresa,
        c.fecha,
        c.fecha_vencimiento,
        c.estado,
        c.subtotal,
        c.impuesto,
        c.descuento_global,
        c.total,
        c.moneda,
        c.condiciones_pago,
        c.notas
    `) as CotizacionRow[];

    logCotizacionesInfo("findCotizacionById:success", {
      id,
      found: rows.length > 0,
    });

    return rows[0] ? mapCotizacionRow(rows[0]) : null;
  } catch (error) {
    logCotizacionesError("findCotizacionById:error", error, { id });
    throw error;
  }
}

async function insertCotizacion(payload: unknown) {
  logCotizacionesInfo("insertCotizacion:start", {
    payloadKeys: getPayloadKeys(payload),
  });

  try {
    const cotizacion = await buildCotizacion(payload);
    const sql = getSql();

    await sql.transaction(txn => [
      txn`
        INSERT INTO cotizaciones (
          id,
          numero,
          cliente_id,
          fecha,
          fecha_vencimiento,
          estado,
          subtotal,
          impuesto,
          descuento_global,
          total,
          moneda,
          condiciones_pago,
          notas
        ) VALUES (
          ${cotizacion.id},
          ${cotizacion.numero},
          ${cotizacion.clienteId},
          ${cotizacion.fecha.toISOString()},
          ${cotizacion.fechaVencimiento.toISOString()},
          ${cotizacion.estado},
          ${cotizacion.subtotal},
          ${cotizacion.impuesto},
          ${cotizacion.descuentoGlobal},
          ${cotizacion.total},
          ${cotizacion.moneda},
          ${cotizacion.condicionesPago},
          ${cotizacion.notas ?? null}
        )
      `,
      ...cotizacion.lineas.map(linea => txn`
        INSERT INTO cotizacion_items (
          id,
          cotizacion_id,
          orden,
          descripcion,
          cantidad,
          precio_unitario,
          descuento,
          subtotal
        ) VALUES (
          ${linea.id},
          ${cotizacion.id},
          ${linea.orden},
          ${linea.descripcion},
          ${linea.cantidad},
          ${linea.precioUnitario},
          ${linea.descuento},
          ${linea.subtotal}
        )
      `),
    ]);

    const created = await findCotizacionById(cotizacion.id);

    if (!created) {
      throw new Error("No se pudo recuperar la cotizacion creada");
    }

    logCotizacionesInfo("insertCotizacion:success", {
      id: created.id,
      numero: created.numero,
    });

    return created;
  } catch (error) {
    logCotizacionesError("insertCotizacion:error", error, {
      payloadKeys: getPayloadKeys(payload),
    });
    throw error;
  }
}

async function updateExistingCotizacion(id: string, payload: unknown) {
  logCotizacionesInfo("updateExistingCotizacion:start", {
    id,
    payloadKeys: getPayloadKeys(payload),
  });

  try {
    const existing = await findCotizacionById(id);

    if (!existing) {
      logCotizacionesInfo("updateExistingCotizacion:not-found", { id });
      return null;
    }

    const cotizacion = await buildCotizacion(payload, existing);
    const sql = getSql();

    await sql.transaction(txn => [
      txn`
        UPDATE cotizaciones
        SET
          cliente_id = ${cotizacion.clienteId},
          fecha = ${cotizacion.fecha.toISOString()},
          fecha_vencimiento = ${cotizacion.fechaVencimiento.toISOString()},
          estado = ${cotizacion.estado},
          subtotal = ${cotizacion.subtotal},
          impuesto = ${cotizacion.impuesto},
          descuento_global = ${cotizacion.descuentoGlobal},
          total = ${cotizacion.total},
          moneda = ${cotizacion.moneda},
          condiciones_pago = ${cotizacion.condicionesPago},
          notas = ${cotizacion.notas ?? null},
          updated_at = NOW()
        WHERE id = ${id}
      `,
      txn`
        DELETE FROM cotizacion_items
        WHERE cotizacion_id = ${id}
      `,
      ...cotizacion.lineas.map(linea => txn`
        INSERT INTO cotizacion_items (
          id,
          cotizacion_id,
          orden,
          descripcion,
          cantidad,
          precio_unitario,
          descuento,
          subtotal
        ) VALUES (
          ${linea.id},
          ${id},
          ${linea.orden},
          ${linea.descripcion},
          ${linea.cantidad},
          ${linea.precioUnitario},
          ${linea.descuento},
          ${linea.subtotal}
        )
      `),
    ]);

    const updated = await findCotizacionById(id);

    if (!updated) {
      throw new Error("No se pudo recuperar la cotizacion actualizada");
    }

    logCotizacionesInfo("updateExistingCotizacion:success", { id });
    return updated;
  } catch (error) {
    logCotizacionesError("updateExistingCotizacion:error", error, {
      id,
      payloadKeys: getPayloadKeys(payload),
    });
    throw error;
  }
}

async function removeCotizacion(id: string) {
  logCotizacionesInfo("removeCotizacion:start", { id });

  try {
    const sql = getSql();
    const rows = (await sql`
      DELETE FROM cotizaciones
      WHERE id = ${id}
      RETURNING id
    `) as Array<{ id: string }>;

    logCotizacionesInfo("removeCotizacion:success", {
      id,
      deleted: rows.length > 0,
    });

    return rows.length > 0;
  } catch (error) {
    logCotizacionesError("removeCotizacion:error", error, { id });
    throw error;
  }
}

function formatCotizacionMoney(
  value: number,
  moneda: CotizacionMonedaValue
) {
  return new Intl.NumberFormat("es-CO", {
    currency: moneda,
    maximumFractionDigits: 0,
    style: "currency",
  }).format(value);
}

function normalizeWhatsAppPhone(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  let digits = value.replace(/\D/g, "");

  if (!digits) {
    return null;
  }

  if (digits.startsWith("00")) {
    digits = digits.slice(2);
  }

  if (digits.length === 11 && digits.startsWith("0")) {
    digits = digits.slice(1);
  }

  if (digits.length === 10) {
    return `57${digits}`;
  }

  if (digits.length >= 10 && digits.length <= 15) {
    return digits;
  }

  return null;
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
    return null;
  }

  const protocol = protocolHeader ?? "http";
  return `${protocol}://${hostHeader}`.replace(/\/+$/, "");
}

function resolveCotizacionPublicUrl(req: NodeRequest, cotizacionId: string) {
  const configuredBaseUrl = readString(process.env.PUBLIC_APP_URL);
  const baseUrl = configuredBaseUrl ?? resolveRequestOrigin(req);

  if (!baseUrl) {
    return null;
  }

  return `${baseUrl}/api/cotizaciones/${encodeURIComponent(
    cotizacionId
  )}?download=excel`;
}

function buildCotizacionWhatsappMessage(input: {
  clienteNombre?: string;
  moneda: CotizacionMonedaValue;
  numero: string;
  total: number;
  urlCotizacion?: string | null;
}) {
  const clienteLabel =
    input.clienteNombre?.trim() || "cliente";
  const lines = [
    `Hola ${clienteLabel},`,
    `Te comparto la cotizacion ${input.numero} por un valor total de ${formatCotizacionMoney(
      input.total,
      input.moneda
    )}.`,
    "Quedo atento a tus comentarios y a cualquier ajuste que necesites.",
  ];

  if (input.urlCotizacion) {
    lines.push(`Puedes revisarla aqui: ${input.urlCotizacion}`);
  }

  return lines.join("\n");
}

async function insertCotizacionWhatsappHistorial(input: {
  cotizacionId: string;
  mensaje: string;
  telefonoDestino: string;
  urlCotizacion?: string | null;
  urlWhatsapp: string;
  usuarioPreparo?: string;
}) {
  logCotizacionesInfo("insertCotizacionWhatsappHistorial:start", {
    cotizacionId: input.cotizacionId,
    telefonoDestino: input.telefonoDestino,
    usuarioPreparo: input.usuarioPreparo ?? null,
  });

  try {
    const sql = getSql();
    const id = `cw-${nanoid(10)}`;
    const rows = (await sql`
      INSERT INTO cotizacion_whatsapp_historial (
        id,
        cotizacion_id,
        telefono_destino,
        mensaje,
        url_whatsapp,
        url_cotizacion,
        fecha_preparado,
        usuario_preparo,
        estado
      ) VALUES (
        ${id},
        ${input.cotizacionId},
        ${input.telefonoDestino},
        ${input.mensaje},
        ${input.urlWhatsapp},
        ${input.urlCotizacion ?? null},
        NOW(),
        ${input.usuarioPreparo ?? null},
        'preparado'
      )
      RETURNING
        id,
        cotizacion_id,
        telefono_destino,
        mensaje,
        url_whatsapp,
        url_cotizacion,
        fecha_preparado,
        usuario_preparo,
        estado
    `) as CotizacionWhatsappRow[];

    const historial = rows[0];

    if (!historial) {
      throw new Error(
        "No se pudo registrar la preparacion de WhatsApp para la cotizacion"
      );
    }

    logCotizacionesInfo("insertCotizacionWhatsappHistorial:success", {
      cotizacionId: input.cotizacionId,
      historialId: historial.id,
    });

    return mapCotizacionWhatsappRow(historial);
  } catch (error) {
    logCotizacionesError("insertCotizacionWhatsappHistorial:error", error, {
      cotizacionId: input.cotizacionId,
      telefonoDestino: input.telefonoDestino,
    });
    throw error;
  }
}

function buildCotizacionEmailDraft(
  payload: unknown,
  cotizacion: CotizacionApiRecord,
  cliente: ClienteExcelRow | null,
  usuarioNombre?: string
): CotizacionEmailDraft {
  assertPayload(payload);

  const destinatario = normalizeEmail(
    readString(payload.destinatario) ??
      cliente?.email ??
      cotizacion.clienteEmail ??
      ""
  );

  if (!destinatario || !isValidEmail(destinatario)) {
    throw new Error("Debes indicar un correo valido para el destinatario");
  }

  const asunto =
    readString(payload.asunto) ??
    buildDefaultCotizacionEmailSubject(
      cotizacion.numero,
      cotizacion.clienteNombre,
      cotizacion.clienteEmpresa
    );

  if (!asunto) {
    throw new Error("El asunto del correo es obligatorio");
  }

  const mensaje =
    readString(payload.mensaje) ??
    buildDefaultCotizacionEmailMessage({
      clienteEmpresa: cotizacion.clienteEmpresa,
      clienteNombre: cotizacion.clienteNombre,
      fecha: cotizacion.fecha,
      numero: cotizacion.numero,
      usuarioNombre,
    });

  return {
    asunto,
    destinatario,
    mensaje,
  };
}

async function insertCotizacionEnvio(input: {
  asunto: string;
  cotizacionId: string;
  destinatario: string;
  detalleError?: string;
  estado: CotizacionEnvioEstado;
  usuarioEnvio?: string;
}) {
  logCotizacionesInfo("insertCotizacionEnvio:start", {
    cotizacionId: input.cotizacionId,
    destinatario: input.destinatario,
    estado: input.estado,
    usuarioEnvio: input.usuarioEnvio ?? null,
  });

  try {
    const sql = getSql();
    const id = `ce-${nanoid(10)}`;
    const rows = (await sql`
      INSERT INTO cotizacion_envios (
        id,
        cotizacion_id,
        destinatario,
        asunto,
        fecha_envio,
        usuario_envio,
        estado,
        detalle_error
      ) VALUES (
        ${id},
        ${input.cotizacionId},
        ${input.destinatario},
        ${input.asunto},
        NOW(),
        ${input.usuarioEnvio ?? null},
        ${input.estado},
        ${input.detalleError ?? null}
      )
      RETURNING
        id,
        cotizacion_id,
        destinatario,
        asunto,
        fecha_envio,
        usuario_envio,
        estado
    `) as CotizacionEnvioRow[];

    const envio = rows[0];

    if (!envio) {
      throw new Error("No se pudo registrar el envio de la cotizacion");
    }

    logCotizacionesInfo("insertCotizacionEnvio:success", {
      cotizacionId: input.cotizacionId,
      envioId: envio.id,
      estado: envio.estado,
    });

    return mapCotizacionEnvioRow(envio);
  } catch (error) {
    logCotizacionesError("insertCotizacionEnvio:error", error, {
      cotizacionId: input.cotizacionId,
      destinatario: input.destinatario,
      estado: input.estado,
    });
    throw error;
  }
}

async function updateCotizacionEstadoEnviadaSiAplica(id: string) {
  logCotizacionesInfo("updateCotizacionEstadoEnviadaSiAplica:start", { id });

  try {
    const sql = getSql();
    await sql`
      UPDATE cotizaciones
      SET
        estado = 'enviada',
        updated_at = NOW()
      WHERE id = ${id}
        AND estado = 'borrador'
    `;

    logCotizacionesInfo("updateCotizacionEstadoEnviadaSiAplica:success", { id });
  } catch (error) {
    logCotizacionesError("updateCotizacionEstadoEnviadaSiAplica:error", error, {
      id,
    });
    throw error;
  }
}

async function sendCotizacionByEmail(
  req: NodeRequest,
  id: string
): Promise<CotizacionSendResponse | null> {
  logCotizacionesInfo("sendCotizacionByEmail:start", {
    id,
    method: req.method,
    url: req.url,
  });

  const cotizacion = await findCotizacionById(id);

  if (!cotizacion) {
    logCotizacionesInfo("sendCotizacionByEmail:not-found", { id });
    return null;
  }

  const usuario = await getAuthenticatedUser(req);

  if (!usuario) {
    throw new Error("Debes iniciar sesion para enviar la cotizacion");
  }

  const cliente = cotizacion.clienteId
    ? await findClienteExcelById(cotizacion.clienteId)
    : null;
  const payload = await readJsonBody(req);
  const emailDraft = buildCotizacionEmailDraft(
    payload,
    cotizacion,
    cliente,
    usuario.nombre
  );
  const excel = await generateCotizacionExcel(cotizacion, cliente ?? undefined);

  try {
    await sendCotizacionEmail({
      attachment: {
        contentBase64: excel.buffer.toString("base64"),
        contentType: excel.contentType,
        fileName: excel.fileName,
      },
      message: emailDraft.mensaje,
      subject: emailDraft.asunto,
      to: emailDraft.destinatario,
    });

    const envio = await insertCotizacionEnvio({
      asunto: emailDraft.asunto,
      cotizacionId: cotizacion.id,
      destinatario: emailDraft.destinatario,
      estado: "enviado",
      usuarioEnvio: usuario.id,
    });

    if (cotizacion.estado === "borrador") {
      await updateCotizacionEstadoEnviadaSiAplica(cotizacion.id);
    }

    const updatedCotizacion = await findCotizacionById(cotizacion.id);

    if (!updatedCotizacion) {
      throw new Error("No se pudo recuperar la cotizacion despues del envio");
    }

    logCotizacionesInfo("sendCotizacionByEmail:success", {
      id,
      destinatario: emailDraft.destinatario,
      estadoAnterior: cotizacion.estado,
      estadoActual: updatedCotizacion.estado,
    });

    return {
      cotizacion: updatedCotizacion,
      envio,
    };
  } catch (error) {
    try {
      await insertCotizacionEnvio({
        asunto: emailDraft.asunto,
        cotizacionId: cotizacion.id,
        destinatario: emailDraft.destinatario,
        detalleError: getErrorMessage(error, "No se pudo enviar el correo"),
        estado: "error",
        usuarioEnvio: usuario.id,
      });
    } catch (trackingError) {
      logCotizacionesError(
        "sendCotizacionByEmail:tracking-error",
        trackingError,
        {
          id,
          destinatario: emailDraft.destinatario,
        }
      );
    }

    logCotizacionesError("sendCotizacionByEmail:error", error, {
      id,
      destinatario: emailDraft.destinatario,
    });
    throw error;
  }
}

async function prepareCotizacionWhatsapp(
  req: NodeRequest,
  id: string
): Promise<CotizacionWhatsappResponse | null> {
  logCotizacionesInfo("prepareCotizacionWhatsapp:start", {
    id,
    method: req.method,
    url: req.url,
  });

  const cotizacion = await findCotizacionById(id);

  if (!cotizacion) {
    logCotizacionesInfo("prepareCotizacionWhatsapp:not-found", { id });
    return null;
  }

  const usuario = await getAuthenticatedUser(req);

  if (!usuario) {
    throw new Error("Debes iniciar sesion para preparar el envio por WhatsApp");
  }

  if (!cotizacion.clienteId) {
    throw new Error("La cotizacion no tiene un cliente asociado");
  }

  const cliente = await findClienteExcelById(cotizacion.clienteId);

  if (!cliente) {
    throw new Error("No se encontro el cliente asociado a la cotizacion");
  }

  const telefonoDestino = normalizeWhatsAppPhone(cliente.telefono);

  if (!telefonoDestino) {
    throw new Error(
      "El cliente asociado no tiene un celular valido para WhatsApp"
    );
  }

  const urlCotizacion = resolveCotizacionPublicUrl(req, cotizacion.id);
  const mensaje = buildCotizacionWhatsappMessage({
    clienteNombre: cotizacion.clienteNombre ?? cliente.nombre,
    moneda: cotizacion.moneda,
    numero: cotizacion.numero,
    total: cotizacion.total,
    urlCotizacion,
  });
  const urlWhatsapp = `https://wa.me/${telefonoDestino}?text=${encodeURIComponent(
    mensaje
  )}`;
  const whatsapp = await insertCotizacionWhatsappHistorial({
    cotizacionId: cotizacion.id,
    mensaje,
    telefonoDestino,
    urlCotizacion,
    urlWhatsapp,
    usuarioPreparo: usuario.id,
  });

  logCotizacionesInfo("prepareCotizacionWhatsapp:success", {
    id,
    telefonoDestino,
    historialId: whatsapp.id,
  });

  return {
    cotizacion,
    whatsapp,
  };
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function isValidationError(error: unknown) {
  return (
    error instanceof Error &&
    /invalido|obligatoria|obligatorio|Debe|cantidad|precio|descuento|cliente|linea|impuesto|total|vencimiento|moneda|correo|destinatario|asunto|whatsapp|celular/i.test(
      error.message
    )
  );
}

function getRequestStatusCode(error: unknown) {
  if (isValidationError(error)) {
    return 400;
  }

  if (isCotizacionEmailConfigError(error)) {
    return 503;
  }

  return 500;
}

function getRequestErrorLabel(error: unknown, pathLabel: string) {
  if (isCotizacionEmailConfigError(error)) {
    return "Configuracion de correo incompleta";
  }

  return isValidationError(error)
    ? `Solicitud invalida en ${pathLabel}`
    : `Error interno en ${pathLabel}`;
}

export async function handleCotizacionesCollection(
  req: NodeRequest,
  res: ServerResponse
) {
  logCotizacionesInfo("handleCotizacionesCollection:start", {
    method: req.method,
    url: req.url,
  });

  try {
    if (req.method === "GET") {
      const cotizaciones = await listCotizaciones();
      sendJson(res, 200, cotizaciones);
      logCotizacionesInfo("handleCotizacionesCollection:response", {
        method: req.method,
        url: req.url,
        statusCode: 200,
        count: cotizaciones.length,
      });
      return;
    }

    if (req.method === "POST") {
      const payload = await readJsonBody(req);
      const cotizacion = await insertCotizacion(payload);
      sendJson(res, 201, cotizacion);
      logCotizacionesInfo("handleCotizacionesCollection:response", {
        method: req.method,
        url: req.url,
        statusCode: 201,
        id: cotizacion.id,
      });
      return;
    }

    sendMethodNotAllowed(res, ["GET", "POST"]);
  } catch (error) {
    const statusCode = getRequestStatusCode(error);
    const detail = getErrorMessage(error, "No se pudo procesar la solicitud");

    logCotizacionesError("handleCotizacionesCollection:error", error, {
      method: req.method,
      url: req.url,
      statusCode,
    });

    sendErrorJson(
      res,
      statusCode,
      getRequestErrorLabel(error, "/api/cotizaciones"),
      detail
    );
  }
}

export async function handleCotizacionItem(
  req: NodeRequest,
  res: ServerResponse,
  id: string
) {
  logCotizacionesInfo("handleCotizacionItem:start", {
    method: req.method,
    url: req.url,
    id,
  });

  try {
    if (!id) {
      sendErrorJson(
        res,
        400,
        "Cotizacion invalida",
        "Se recibio un id vacio para /api/cotizaciones/[id]"
      );
      return;
    }

    if (req.method === "GET") {
      const cotizacion = await findCotizacionById(id);

      if (!cotizacion) {
        sendErrorJson(
          res,
          404,
          "Cotizacion no encontrada",
          `No existe una cotizacion con id ${id}`
        );
        return;
      }

      if (shouldDownloadCotizacionExcel(req.url)) {
        const cliente = cotizacion.clienteId
          ? await findClienteExcelById(cotizacion.clienteId)
          : null;
        const excel = await generateCotizacionExcel(cotizacion, cliente ?? undefined);

        sendBuffer(
          res,
          200,
          excel.buffer,
          excel.contentType,
          excel.fileName
        );
        logCotizacionesInfo("handleCotizacionItem:download", {
          method: req.method,
          url: req.url,
          id,
          fileName: excel.fileName,
          templatePath: excel.templatePath,
          statusCode: 200,
        });
        return;
      }

      sendJson(res, 200, cotizacion);
      logCotizacionesInfo("handleCotizacionItem:response", {
        method: req.method,
        url: req.url,
        id,
        statusCode: 200,
      });
      return;
    }

    if (req.method === "PUT") {
      const payload = await readJsonBody(req);
      const cotizacion = await updateExistingCotizacion(id, payload);

      if (!cotizacion) {
        sendErrorJson(
          res,
          404,
          "Cotizacion no encontrada",
          `No existe una cotizacion con id ${id}`
        );
        return;
      }

      sendJson(res, 200, cotizacion);
      logCotizacionesInfo("handleCotizacionItem:response", {
        method: req.method,
        url: req.url,
        id,
        statusCode: 200,
      });
      return;
    }

    if (req.method === "DELETE") {
      const deleted = await removeCotizacion(id);

      if (!deleted) {
        sendErrorJson(
          res,
          404,
          "Cotizacion no encontrada",
          `No existe una cotizacion con id ${id}`
        );
        return;
      }

      sendEmpty(res, 204);
      logCotizacionesInfo("handleCotizacionItem:response", {
        method: req.method,
        url: req.url,
        id,
        statusCode: 204,
      });
      return;
    }

    if (req.method === "POST" && shouldSendCotizacionByEmail(req.url)) {
      const sendResult = await sendCotizacionByEmail(req, id);

      if (!sendResult) {
        sendErrorJson(
          res,
          404,
          "Cotizacion no encontrada",
          `No existe una cotizacion con id ${id}`
        );
        return;
      }

      sendJson(res, 200, sendResult);
      logCotizacionesInfo("handleCotizacionItem:response", {
        method: req.method,
        url: req.url,
        id,
        statusCode: 200,
        action: "send-email",
      });
      return;
    }

    if (req.method === "POST" && shouldPrepareCotizacionWhatsapp(req.url)) {
      const whatsappResult = await prepareCotizacionWhatsapp(req, id);

      if (!whatsappResult) {
        sendErrorJson(
          res,
          404,
          "Cotizacion no encontrada",
          `No existe una cotizacion con id ${id}`
        );
        return;
      }

      sendJson(res, 200, whatsappResult);
      logCotizacionesInfo("handleCotizacionItem:response", {
        action: "prepare-whatsapp",
        method: req.method,
        url: req.url,
        id,
        statusCode: 200,
      });
      return;
    }

    sendMethodNotAllowed(res, ["GET", "POST", "PUT", "DELETE"]);
  } catch (error) {
    const statusCode = getRequestStatusCode(error);
    const detail = getErrorMessage(error, "No se pudo procesar la solicitud");

    logCotizacionesError("handleCotizacionItem:error", error, {
      method: req.method,
      url: req.url,
      id,
      statusCode,
    });

    sendErrorJson(
      res,
      statusCode,
      getRequestErrorLabel(error, "/api/cotizaciones/[id]"),
      detail
    );
  }
}

export function createCotizacionesDevMiddleware() {
  return (req: NodeRequest, res: ServerResponse, next: ConnectNext) => {
    const pathname = getPathname(req.url);

    if (pathname === "/api/cotizaciones" || pathname === "/api/cotizaciones/") {
      void handleCotizacionesCollection(req, res).catch(next);
      return;
    }

    const cotizacionId = getCotizacionIdFromRequestUrl(req.url);

    if (cotizacionId) {
      void handleCotizacionItem(req, res, cotizacionId).catch(next);
      return;
    }

    next();
  };
}
