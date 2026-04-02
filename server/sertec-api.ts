import type { IncomingMessage, ServerResponse } from "node:http";
import { nanoid } from "nanoid";
import { getAuthenticatedUser } from "./auth-api.js";
import type {
  SertecComercialOrigen,
  SertecOrden,
  SertecOrdenAdjunto,
  SertecGarantia,
  SertecOrdenHistorial,
} from "../client/src/lib/types.js";
import { SertecOrdenEstado } from "../client/src/lib/types.js";
import { getSql } from "./neon.js";

type NodeRequest = IncomingMessage & {
  body?: unknown;
};

type ConnectNext = (error?: unknown) => void;

type SertecOrdenApiRecord = Omit<
  SertecOrden,
  | "fechaIngreso"
  | "fechaReparacion"
  | "fechaSalida"
  | "createdAt"
  | "updatedAt"
  | "historial"
  | "adjuntos"
  | "garantia"
> & {
  fechaIngreso: string;
  fechaReparacion?: string;
  fechaSalida?: string;
  createdAt: string;
  updatedAt: string;
  garantia?: SertecGarantiaApiRecord;
  historial?: SertecOrdenHistorialApiRecord[];
  adjuntos?: SertecOrdenAdjuntoApiRecord[];
};

type SertecOrdenHistorialApiRecord = Omit<SertecOrdenHistorial, "createdAt"> & {
  createdAt: string;
};

type SertecOrdenAdjuntoApiRecord = Omit<SertecOrdenAdjunto, "createdAt"> & {
  createdAt: string;
};

type SertecGarantiaApiRecord = Omit<
  SertecGarantia,
  "fechaVenta" | "vigenteHasta"
> & {
  fechaVenta?: string;
  vigenteHasta?: string;
};

type SertecComercialOrigenApiRecord = Omit<
  SertecComercialOrigen,
  "fechaVenta"
> & {
  fechaVenta: string;
};

type SertecOrdenRow = {
  id: string;
  numero: string;
  estado: SertecOrdenEstado;
  fecha_ingreso: string | Date;
  fecha_reparacion: string | Date | null;
  fecha_salida: string | Date | null;
  cliente_id: string | null;
  cliente_nombre: string;
  cliente_documento: string | null;
  cliente_telefono: string | null;
  cotizacion_id: string | null;
  cotizacion_numero: string | null;
  cotizacion_item_id: string | null;
  equipo_vendido_descripcion: string | null;
  origen_comercial_tipo: "cotizacion" | null;
  fecha_venta: string | Date | null;
  garantia_meses: number | string | null;
  equipo_tipo: string;
  equipo_marca: string | null;
  equipo_modelo: string | null;
  equipo_serial: string | null;
  falla_reportada: string;
  diagnostico: string | null;
  trabajo_realizado: string | null;
  observaciones: string | null;
  created_at: string | Date;
  updated_at: string | Date;
};

type SertecOrdenHistorialRow = {
  id: string;
  orden_id: string;
  estado: SertecOrdenEstado;
  movimiento: SertecOrdenHistorial["movimiento"];
  detalle: string | null;
  usuario_id: string | null;
  usuario_nombre: string | null;
  created_at: string | Date;
};

type SertecOrdenAdjuntoRow = {
  id: string;
  orden_id: string;
  nombre_archivo: string;
  tipo_mime: SertecOrdenAdjunto["tipoMime"];
  tamano: number | string;
  contenido_base64?: string;
  descripcion: string | null;
  usuario_id: string | null;
  usuario_nombre: string | null;
  created_at: string | Date;
};

type SertecComercialOrigenRow = {
  cliente_empresa: string | null;
  cliente_id: string | null;
  cliente_nombre: string | null;
  cliente_telefono: string | null;
  cotizacion_id: string;
  cotizacion_numero: string;
  fecha_venta: string | Date;
  items: unknown;
  moneda: "COP" | "USD";
  total: number | string;
};

type SertecClienteRow = {
  id: string;
  nit: string | null;
  nombre: string;
  telefono: string | null;
};

type SertecComercialOrigenSelectionRow = {
  cliente_documento: string | null;
  cliente_id: string | null;
  cliente_nombre: string | null;
  cliente_telefono: string | null;
  cotizacion_fecha: string | Date;
  cotizacion_id: string;
  cotizacion_item_descripcion: string;
  cotizacion_numero: string;
};

type SertecAdjuntoPayload = {
  contentBase64?: string;
  descripcion?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
};

type SertecOrdenPayload = {
  clienteId?: string;
  clienteDocumento?: string;
  clienteNombre?: string;
  clienteTelefono?: string;
  cotizacionId?: string;
  cotizacionItemId?: string;
  diagnostico?: string;
  equipoMarca?: string;
  equipoModelo?: string;
  equipoSerial?: string;
  equipoTipo?: string;
  fallaReportada?: string;
  fechaVenta?: string;
  garantiaMeses?: number;
  observaciones?: string;
  trabajoRealizado?: string;
  adjuntos?: SertecAdjuntoPayload[];
};

type SertecTransitionPayload = {
  detalle?: string;
  diagnostico?: string;
  observaciones?: string;
  trabajoRealizado?: string;
};

type SertecAdjuntosMutationPayload = {
  adjuntos?: SertecAdjuntoPayload[];
};

type SertecCollectionFilters = {
  cliente?: string;
  estado?: SertecOrdenEstado;
  numero?: string;
  serial?: string;
};

type BuiltSertecAdjunto = {
  contentBase64: string;
  descripcion?: string;
  fileName: string;
  fileSize: number;
  id: string;
  mimeType: SertecOrdenAdjunto["tipoMime"];
};

type BuiltSertecOrden = {
  clienteId?: string;
  clienteDocumento?: string;
  clienteNombre: string;
  clienteTelefono?: string;
  cotizacionId?: string;
  cotizacionItemId?: string;
  diagnostico?: string;
  equipoMarca?: string;
  equipoModelo?: string;
  equipoSerial?: string;
  fechaVenta?: Date;
  garantiaMeses?: number;
  equipoTipo: string;
  equipoVendidoDescripcion?: string;
  fallaReportada: string;
  id: string;
  numero: string;
  observaciones?: string;
  origenComercialTipo?: "cotizacion";
  trabajoRealizado?: string;
  adjuntos: BuiltSertecAdjunto[];
};

const SERTEC_API_LOG_PREFIX = "[server/sertec-api]";
const SERTEC_ESTADOS = new Set<SertecOrdenEstado>([
  SertecOrdenEstado.ENTRADA,
  SertecOrdenEstado.REPARACION,
  SertecOrdenEstado.SALIDA,
] as SertecOrdenEstado[]);
const SERTEC_ADJUNTO_MIME_TYPES = new Set<SertecOrdenAdjunto["tipoMime"]>([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const MAX_ADJUNTO_FILE_SIZE = 5 * 1024 * 1024;
const DEFAULT_GARANTIA_MESES = 12;

function logSertecInfo(message: string, metadata?: Record<string, unknown>) {
  if (metadata) {
    console.info(SERTEC_API_LOG_PREFIX, message, metadata);
    return;
  }

  console.info(SERTEC_API_LOG_PREFIX, message);
}

function logSertecError(
  message: string,
  error: unknown,
  metadata?: Record<string, unknown>
) {
  console.error(SERTEC_API_LOG_PREFIX, message, {
    ...(metadata ?? {}),
    detail: getErrorMessage(error, "Error desconocido"),
    ...(error instanceof Error && error.stack ? { stack: error.stack } : {}),
  });
}

function setJsonHeaders(res: ServerResponse) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
}

function sendJson(
  res: ServerResponse,
  statusCode: number,
  payload: unknown
) {
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
    const rawBody = req.body.toString("utf-8").trim();
    return rawBody ? JSON.parse(rawBody) : {};
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

function getSearchParams(urlValue?: string) {
  return new URL(urlValue ?? "/", "http://localhost").searchParams;
}

function readString(value: unknown) {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function readNumber(value: unknown, fallback: number) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readInteger(
  value: unknown,
  fallback?: number
): number | undefined {
  if (value === undefined) {
    return fallback;
  }

  if (value === null || value === "") {
    return undefined;
  }

  const parsed = typeof value === "number" ? value : Number(value);

  if (!Number.isInteger(parsed)) {
    throw new Error("La garantia debe expresarse en meses enteros");
  }

  if (parsed < 0) {
    throw new Error("La garantia no puede ser negativa");
  }

  return parsed;
}

function readDateInput(value: unknown, fallback?: Date) {
  if (value === undefined) {
    return fallback;
  }

  if (value === null || value === "") {
    return undefined;
  }

  const parsed = new Date(String(value));

  if (Number.isNaN(parsed.getTime())) {
    throw new Error("La fecha de venta es invalida");
  }

  return parsed;
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function isValidBase64(value: string) {
  return /^[A-Za-z0-9+/]+={0,2}$/.test(value);
}

function parseDateValue(value: string | Date) {
  const parsed = value instanceof Date ? new Date(value) : new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Fecha invalida en la base de datos");
  }

  return parsed;
}

function addMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function calculateWarranty(
  fechaIngreso: Date,
  fechaVenta?: Date,
  garantiaMeses?: number
): SertecGarantia | undefined {
  if (!fechaVenta || garantiaMeses === undefined) {
    return undefined;
  }

  const vigenteHasta = addMonths(fechaVenta, garantiaMeses);
  const diffMs = vigenteHasta.getTime() - fechaIngreso.getTime();
  const diasRestantes = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  return {
    aplica: diffMs >= 0,
    diasRestantes,
    fechaVenta,
    garantiaMeses,
    vigenteHasta,
  };
}

function buildSertecNumero() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `SER-${year}${month}${day}-${nanoid(4).toUpperCase()}`;
}

function mapSertecOrdenRow(row: SertecOrdenRow): SertecOrdenApiRecord {
  const fechaIngreso = parseDateValue(row.fecha_ingreso);
  const fechaVenta = row.fecha_venta
    ? parseDateValue(row.fecha_venta)
    : undefined;
  const garantiaMeses =
    row.garantia_meses === null || row.garantia_meses === undefined
      ? undefined
      : readNumber(row.garantia_meses, 0);
  const garantia = calculateWarranty(fechaIngreso, fechaVenta, garantiaMeses);

  return {
    id: row.id,
    numero: row.numero,
    estado: row.estado,
    fechaIngreso: fechaIngreso.toISOString(),
    fechaReparacion: row.fecha_reparacion
      ? parseDateValue(row.fecha_reparacion).toISOString()
      : undefined,
    fechaSalida: row.fecha_salida
      ? parseDateValue(row.fecha_salida).toISOString()
      : undefined,
    clienteId: row.cliente_id ?? undefined,
    clienteNombre: row.cliente_nombre,
    clienteDocumento: row.cliente_documento ?? undefined,
    clienteTelefono: row.cliente_telefono ?? undefined,
    cotizacionId: row.cotizacion_id ?? undefined,
    cotizacionNumero: row.cotizacion_numero ?? undefined,
    cotizacionItemId: row.cotizacion_item_id ?? undefined,
    equipoTipo: row.equipo_tipo,
    equipoMarca: row.equipo_marca ?? undefined,
    equipoModelo: row.equipo_modelo ?? undefined,
    equipoSerial: row.equipo_serial ?? undefined,
    equipoVendidoDescripcion: row.equipo_vendido_descripcion ?? undefined,
    fallaReportada: row.falla_reportada,
    diagnostico: row.diagnostico ?? undefined,
    garantia: garantia
      ? {
          ...garantia,
          fechaVenta: garantia.fechaVenta?.toISOString(),
          vigenteHasta: garantia.vigenteHasta?.toISOString(),
        }
      : undefined,
    origenComercialTipo: row.origen_comercial_tipo ?? undefined,
    trabajoRealizado: row.trabajo_realizado ?? undefined,
    observaciones: row.observaciones ?? undefined,
    createdAt: parseDateValue(row.created_at).toISOString(),
    updatedAt: parseDateValue(row.updated_at).toISOString(),
  };
}

function parseSertecComercialItems(itemsValue: unknown) {
  const rawItems =
    typeof itemsValue === "string" ? JSON.parse(itemsValue) : itemsValue;

  if (!Array.isArray(rawItems)) {
    return [];
  }

  return rawItems
    .map(item => {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        return null;
      }

      const record = item as Record<string, unknown>;
      const id = readString(record.id);
      const descripcion = readString(record.descripcion);

      if (!id || !descripcion) {
        return null;
      }

      return { id, descripcion };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);
}

function mapSertecComercialOrigenRow(
  row: SertecComercialOrigenRow
): SertecComercialOrigenApiRecord {
  return {
    clienteEmpresa: row.cliente_empresa ?? undefined,
    clienteId: row.cliente_id ?? undefined,
    clienteNombre: row.cliente_nombre ?? "Cliente sin nombre",
    clienteTelefono: row.cliente_telefono ?? undefined,
    cotizacionId: row.cotizacion_id,
    cotizacionNumero: row.cotizacion_numero,
    fechaVenta: parseDateValue(row.fecha_venta).toISOString(),
    garantiaMesesSugerida: DEFAULT_GARANTIA_MESES,
    items: parseSertecComercialItems(row.items),
    moneda: row.moneda,
    total: readNumber(row.total, 0),
  };
}

function mapSertecHistorialRow(
  row: SertecOrdenHistorialRow
): SertecOrdenHistorialApiRecord {
  return {
    id: row.id,
    ordenId: row.orden_id,
    estado: row.estado,
    movimiento: row.movimiento,
    detalle: row.detalle ?? undefined,
    usuarioId: row.usuario_id ?? undefined,
    usuarioNombre: row.usuario_nombre ?? undefined,
    createdAt: parseDateValue(row.created_at).toISOString(),
  };
}

function mapSertecAdjuntoRow(
  row: SertecOrdenAdjuntoRow
): SertecOrdenAdjuntoApiRecord {
  return {
    id: row.id,
    ordenId: row.orden_id,
    nombreArchivo: row.nombre_archivo,
    tipoMime: row.tipo_mime,
    tamano: readNumber(row.tamano, 0),
    descripcion: row.descripcion ?? undefined,
    usuarioId: row.usuario_id ?? undefined,
    usuarioNombre: row.usuario_nombre ?? undefined,
    createdAt: parseDateValue(row.created_at).toISOString(),
  };
}

function getPayloadKeys(payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return [];
  }

  return Object.keys(payload as Record<string, unknown>);
}

function parseAdjuntos(
  value: unknown,
  allowEmpty = true
): BuiltSertecAdjunto[] {
  if (value === undefined || value === null) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new Error("Los adjuntos deben enviarse como arreglo");
  }

  if (!allowEmpty && value.length === 0) {
    throw new Error("Debes adjuntar al menos un archivo valido");
  }

  return value.map((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new Error(`Adjunto invalido en la posicion ${index + 1}`);
    }

    const record = item as SertecAdjuntoPayload;
    const fileName = readString(record.fileName);
    const mimeType = readString(record.mimeType) as SertecOrdenAdjunto["tipoMime"] | undefined;
    const contentBase64 = readString(record.contentBase64);
    const descripcion = readString(record.descripcion);
    const fileSize = readNumber(record.fileSize, 0);

    if (!fileName || !mimeType || !contentBase64) {
      throw new Error("Cada adjunto debe incluir nombre, tipo y contenido");
    }

    if (!SERTEC_ADJUNTO_MIME_TYPES.has(mimeType)) {
      throw new Error("Los adjuntos solo permiten PDF, JPG, PNG o WEBP");
    }

    if (!isValidBase64(contentBase64)) {
      throw new Error("El contenido del adjunto no tiene formato base64 valido");
    }

    if (fileSize <= 0 || fileSize > MAX_ADJUNTO_FILE_SIZE) {
      throw new Error("Cada adjunto debe ser mayor a 0 y menor o igual a 5 MB");
    }

    return {
      contentBase64,
      descripcion,
      fileName,
      fileSize,
      id: `sadj-${nanoid(10)}`,
      mimeType,
    };
  });
}

async function buildSertecOrden(payload: unknown): Promise<BuiltSertecOrden> {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Cuerpo de solicitud invalido");
  }

  const record = payload as SertecOrdenPayload;
  const clienteId = readString(record.clienteId);
  const cotizacionId = readString(record.cotizacionId);
  const cotizacionItemId = readString(record.cotizacionItemId);
  const clienteNombre = readString(record.clienteNombre);
  const clienteDocumento = readString(record.clienteDocumento);
  const clienteTelefono = readString(record.clienteTelefono);
  const equipoTipo = readString(record.equipoTipo);
  const equipoMarca = readString(record.equipoMarca);
  const equipoModelo = readString(record.equipoModelo);
  const equipoSerial = readString(record.equipoSerial);
  const fallaReportada = readString(record.fallaReportada);
  const diagnostico = readString(record.diagnostico);
  const trabajoRealizado = readString(record.trabajoRealizado);
  const observaciones = readString(record.observaciones);
  const fechaVentaInput = readDateInput(record.fechaVenta);
  const garantiaMesesInput = readInteger(record.garantiaMeses);
  const adjuntos = parseAdjuntos(record.adjuntos);

  if ((cotizacionId && !cotizacionItemId) || (!cotizacionId && cotizacionItemId)) {
    throw new Error(
      "Debes seleccionar la cotizacion y el equipo vendido para asociar el origen comercial"
    );
  }

  const [cliente, origenComercial] = await Promise.all([
    clienteId ? findSertecClienteById(clienteId) : Promise.resolve(null),
    cotizacionId && cotizacionItemId
      ? findSertecComercialSelection(cotizacionId, cotizacionItemId)
      : Promise.resolve(null),
  ]);

  if (clienteId && !cliente) {
    throw new Error("El cliente seleccionado no existe");
  }

  if (cotizacionId && cotizacionItemId && !origenComercial) {
    throw new Error(
      "La cotizacion aprobada o el equipo vendido seleccionado no existen"
    );
  }

  if (
    origenComercial?.cliente_id &&
    clienteId &&
    origenComercial.cliente_id !== clienteId
  ) {
    throw new Error(
      "El cliente seleccionado no coincide con el origen comercial elegido"
    );
  }

  const clienteNombreFinal =
    clienteNombre ?? origenComercial?.cliente_nombre ?? cliente?.nombre;
  const clienteDocumentoFinal =
    clienteDocumento ?? origenComercial?.cliente_documento ?? cliente?.nit ?? undefined;
  const clienteTelefonoFinal =
    clienteTelefono ?? origenComercial?.cliente_telefono ?? cliente?.telefono ?? undefined;
  const equipoVendidoDescripcion = origenComercial?.cotizacion_item_descripcion;
  const equipoTipoFinal = equipoTipo ?? equipoVendidoDescripcion;
  const fechaVenta =
    fechaVentaInput ??
    (origenComercial
      ? parseDateValue(origenComercial.cotizacion_fecha)
      : undefined);
  const garantiaMeses =
    garantiaMesesInput ??
    (origenComercial ? DEFAULT_GARANTIA_MESES : undefined);

  if (!clienteNombreFinal) {
    throw new Error("El nombre del cliente es obligatorio");
  }

  if (!equipoTipoFinal) {
    throw new Error("El tipo de equipo es obligatorio");
  }

  if (!fallaReportada) {
    throw new Error("La falla reportada es obligatoria");
  }

  return {
    clienteDocumento: clienteDocumentoFinal,
    clienteId: origenComercial?.cliente_id ?? cliente?.id ?? undefined,
    clienteNombre: clienteNombreFinal,
    clienteTelefono: clienteTelefonoFinal,
    cotizacionId: origenComercial?.cotizacion_id ?? undefined,
    cotizacionItemId: cotizacionItemId ?? undefined,
    diagnostico,
    equipoMarca,
    equipoModelo,
    equipoSerial,
    equipoTipo: equipoTipoFinal,
    equipoVendidoDescripcion,
    fechaVenta,
    garantiaMeses,
    fallaReportada,
    id: `sord-${nanoid(12)}`,
    numero: buildSertecNumero(),
    observaciones,
    origenComercialTipo: origenComercial ? "cotizacion" : undefined,
    trabajoRealizado,
    adjuntos,
  };
}

function buildTransitionPayload(payload: unknown): SertecTransitionPayload {
  if (payload === undefined || payload === null) {
    return {};
  }

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Cuerpo de solicitud invalido");
  }

  const record = payload as SertecTransitionPayload;

  return {
    detalle: readString(record.detalle),
    diagnostico: readString(record.diagnostico),
    observaciones: readString(record.observaciones),
    trabajoRealizado: readString(record.trabajoRealizado),
  };
}

function getSertecTransition(urlValue?: string) {
  const transition = readString(getSearchParams(urlValue).get("transition"));

  if (!transition || !SERTEC_ESTADOS.has(transition as SertecOrdenEstado)) {
    return null;
  }

  return transition as SertecOrdenEstado;
}

function readSertecCollectionFilters(
  urlValue?: string
): SertecCollectionFilters {
  const params = getSearchParams(urlValue);
  const estado = readString(params.get("estado"));

  return {
    cliente: readString(params.get("cliente")),
    estado:
      estado && SERTEC_ESTADOS.has(estado as SertecOrdenEstado)
        ? (estado as SertecOrdenEstado)
        : undefined,
    numero: readString(params.get("numero")),
    serial: readString(params.get("serial")),
  };
}

function isAdjuntosResourceRequest(urlValue?: string) {
  return getSearchParams(urlValue).get("resource") === "adjuntos";
}

function shouldDownloadAdjunto(urlValue?: string) {
  return getSearchParams(urlValue).get("download") === "1";
}

function getAdjuntoIdFromRequestUrl(urlValue?: string) {
  return readString(getSearchParams(urlValue).get("adjuntoId"));
}

export function getSertecIdFromRequestUrl(urlValue?: string) {
  const match = getPathname(urlValue).match(/^\/api\/sertec\/([^/]+)\/?$/);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

function shouldListSertecComercialOrigenes(urlValue?: string) {
  return getSearchParams(urlValue).get("resource") === "comercial-origenes";
}

async function findSertecClienteById(id: string) {
  const sql = getSql();
  const rows = (await sql`
    SELECT
      id,
      nombre,
      nit,
      telefono
    FROM clientes
    WHERE id = ${id}
    LIMIT 1
  `) as SertecClienteRow[];

  return rows[0] ?? null;
}

async function findSertecComercialSelection(
  cotizacionId: string,
  cotizacionItemId: string
) {
  const sql = getSql();
  const rows = (await sql`
    SELECT
      c.id AS cotizacion_id,
      c.numero AS cotizacion_numero,
      c.fecha AS cotizacion_fecha,
      c.cliente_id,
      cl.nombre AS cliente_nombre,
      cl.telefono AS cliente_telefono,
      cl.nit AS cliente_documento,
      ci.descripcion AS cotizacion_item_descripcion
    FROM cotizaciones c
    LEFT JOIN clientes cl ON cl.id = c.cliente_id
    INNER JOIN cotizacion_items ci
      ON ci.id = ${cotizacionItemId}
      AND ci.cotizacion_id = c.id
    WHERE c.id = ${cotizacionId}
      AND c.estado = 'aprobada'
    LIMIT 1
  `) as SertecComercialOrigenSelectionRow[];

  return rows[0] ?? null;
}

async function listSertecComercialOrigenes() {
  const sql = getSql();
  const rows = (await sql`
    SELECT
      c.id AS cotizacion_id,
      c.numero AS cotizacion_numero,
      c.fecha AS fecha_venta,
      c.total,
      c.moneda,
      c.cliente_id,
      cl.nombre AS cliente_nombre,
      cl.empresa AS cliente_empresa,
      cl.telefono AS cliente_telefono,
      COALESCE(
        JSON_AGG(
          JSON_BUILD_OBJECT(
            'id', ci.id,
            'descripcion', ci.descripcion
          )
          ORDER BY ci.orden, ci.id
        ) FILTER (WHERE ci.id IS NOT NULL),
        '[]'::json
      ) AS items
    FROM cotizaciones c
    LEFT JOIN clientes cl ON cl.id = c.cliente_id
    LEFT JOIN cotizacion_items ci ON ci.cotizacion_id = c.id
    WHERE c.estado = 'aprobada'
    GROUP BY
      c.id,
      c.numero,
      c.fecha,
      c.total,
      c.moneda,
      c.cliente_id,
      cl.nombre,
      cl.empresa,
      cl.telefono
    ORDER BY c.fecha DESC, c.numero DESC
  `) as SertecComercialOrigenRow[];

  return rows
    .map(mapSertecComercialOrigenRow)
    .filter(origen => origen.items.length > 0);
}

async function listSertecOrdenes(filters: SertecCollectionFilters = {}) {
  logSertecInfo("listSertecOrdenes:start");

  try {
    const sql = getSql();
    const whereClauses: string[] = [];
    const params: unknown[] = [];

    if (filters.numero) {
      params.push(`%${filters.numero}%`);
      whereClauses.push(`o.numero ILIKE $${params.length}`);
    }

    if (filters.cliente) {
      params.push(`%${filters.cliente}%`);
      whereClauses.push(`o.cliente_nombre ILIKE $${params.length}`);
    }

    if (filters.serial) {
      params.push(`%${filters.serial}%`);
      whereClauses.push(`o.equipo_serial ILIKE $${params.length}`);
    }

    if (filters.estado) {
      params.push(filters.estado);
      whereClauses.push(`o.estado = $${params.length}`);
    }

    const query = `
      SELECT
        o.id,
        o.numero,
        o.estado,
        o.fecha_ingreso,
        o.fecha_reparacion,
        o.fecha_salida,
        o.cliente_id,
        o.cliente_nombre,
        o.cliente_documento,
        o.cliente_telefono,
        o.cotizacion_id,
        c.numero AS cotizacion_numero,
        o.cotizacion_item_id,
        ci.descripcion AS equipo_vendido_descripcion,
        o.origen_comercial_tipo,
        o.fecha_venta,
        o.garantia_meses,
        o.equipo_tipo,
        o.equipo_marca,
        o.equipo_modelo,
        o.equipo_serial,
        o.falla_reportada,
        o.diagnostico,
        o.trabajo_realizado,
        o.observaciones,
        o.created_at,
        o.updated_at
      FROM sertec_ordenes o
      LEFT JOIN cotizaciones c ON c.id = o.cotizacion_id
      LEFT JOIN cotizacion_items ci ON ci.id = o.cotizacion_item_id
      ${
        whereClauses.length > 0
          ? `WHERE ${whereClauses.join(" AND ")}`
          : ""
      }
      ORDER BY o.fecha_ingreso DESC, o.created_at DESC
    `;

    const rows = (await sql.query(query, params)) as SertecOrdenRow[];

    return rows.map(mapSertecOrdenRow);
  } catch (error) {
    logSertecError("listSertecOrdenes:error", error, { filters });
    throw error;
  }
}

async function listSertecHistorial(ordenId: string) {
  const sql = getSql();
  const rows = (await sql`
    SELECT
      h.id,
      h.orden_id,
      h.estado,
      h.movimiento,
      h.detalle,
      h.usuario_id,
      u.nombre AS usuario_nombre,
      h.created_at
    FROM sertec_orden_historial h
    LEFT JOIN users u ON u.id = h.usuario_id
    WHERE h.orden_id = ${ordenId}
    ORDER BY h.created_at ASC, h.id ASC
  `) as SertecOrdenHistorialRow[];

  return rows.map(mapSertecHistorialRow);
}

async function listSertecAdjuntos(ordenId: string) {
  const sql = getSql();
  const rows = (await sql`
    SELECT
      a.id,
      a.orden_id,
      a.nombre_archivo,
      a.tipo_mime,
      a.tamano,
      a.descripcion,
      a.usuario_id,
      u.nombre AS usuario_nombre,
      a.created_at
    FROM sertec_orden_adjuntos a
    LEFT JOIN users u ON u.id = a.usuario_id
    WHERE a.orden_id = ${ordenId}
    ORDER BY a.created_at DESC, a.id DESC
  `) as SertecOrdenAdjuntoRow[];

  return rows.map(mapSertecAdjuntoRow);
}

async function findSertecOrdenById(id: string) {
  logSertecInfo("findSertecOrdenById:start", { id });

  try {
    const sql = getSql();
    const rows = (await sql`
      SELECT
        o.id,
        o.numero,
        o.estado,
        o.fecha_ingreso,
        o.fecha_reparacion,
        o.fecha_salida,
        o.cliente_id,
        o.cliente_nombre,
        o.cliente_documento,
        o.cliente_telefono,
        o.cotizacion_id,
        c.numero AS cotizacion_numero,
        o.cotizacion_item_id,
        ci.descripcion AS equipo_vendido_descripcion,
        o.origen_comercial_tipo,
        o.fecha_venta,
        o.garantia_meses,
        o.equipo_tipo,
        o.equipo_marca,
        o.equipo_modelo,
        o.equipo_serial,
        o.falla_reportada,
        o.diagnostico,
        o.trabajo_realizado,
        o.observaciones,
        o.created_at,
        o.updated_at
      FROM sertec_ordenes o
      LEFT JOIN cotizaciones c ON c.id = o.cotizacion_id
      LEFT JOIN cotizacion_items ci ON ci.id = o.cotizacion_item_id
      WHERE o.id = ${id}
      LIMIT 1
    `) as SertecOrdenRow[];

    if (!rows[0]) {
      return null;
    }

    const orden = mapSertecOrdenRow(rows[0]);
    const [historial, adjuntos] = await Promise.all([
      listSertecHistorial(id),
      listSertecAdjuntos(id),
    ]);

    return {
      ...orden,
      historial,
      adjuntos,
    };
  } catch (error) {
    logSertecError("findSertecOrdenById:error", error, { id });
    throw error;
  }
}

async function recordSertecHistorial(
  ordenId: string,
  estado: SertecOrdenEstado,
  movimiento: SertecOrdenHistorial["movimiento"],
  usuarioId: string | undefined,
  detalle?: string
) {
  const sql = getSql();
  await sql`
    INSERT INTO sertec_orden_historial (
      id,
      orden_id,
      estado,
      movimiento,
      detalle,
      usuario_id
    ) VALUES (
      ${`shis-${nanoid(12)}`},
      ${ordenId},
      ${estado},
      ${movimiento},
      ${detalle ?? null},
      ${usuarioId ?? null}
    )
  `;
}

async function insertSertecAdjuntos(
  ordenId: string,
  usuarioId: string | undefined,
  adjuntos: BuiltSertecAdjunto[]
) {
  if (adjuntos.length === 0) {
    return;
  }

  const sql = getSql();

  for (const adjunto of adjuntos) {
    await sql`
      INSERT INTO sertec_orden_adjuntos (
        id,
        orden_id,
        nombre_archivo,
        tipo_mime,
        tamano,
        contenido_base64,
        descripcion,
        usuario_id
      ) VALUES (
        ${adjunto.id},
        ${ordenId},
        ${adjunto.fileName},
        ${adjunto.mimeType},
        ${adjunto.fileSize},
        ${adjunto.contentBase64},
        ${adjunto.descripcion ?? null},
        ${usuarioId ?? null}
      )
    `;
  }
}

async function appendSertecAdjuntosToOrden(
  req: NodeRequest,
  ordenId: string,
  payload: unknown
) {
  const usuario = await getAuthenticatedUser(req);

  if (!usuario) {
    throw new Error("Debes iniciar sesion para adjuntar archivos a la orden");
  }

  const existing = await findSertecOrdenById(ordenId);

  if (!existing) {
    return null;
  }

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Cuerpo de solicitud invalido");
  }

  const record = payload as SertecAdjuntosMutationPayload;
  const adjuntos = parseAdjuntos(record.adjuntos, false);

  if (adjuntos.length === 0) {
    throw new Error("Debes adjuntar al menos un archivo valido");
  }

  await insertSertecAdjuntos(ordenId, usuario.id, adjuntos);
  await recordSertecHistorial(
    ordenId,
    existing.estado,
    "adjunto",
    usuario.id,
    `Adjunto(s) agregados: ${adjuntos.map(adjunto => adjunto.fileName).join(", ")}`
  );

  return findSertecOrdenById(ordenId);
}

async function createSertecOrden(req: NodeRequest, payload: unknown) {
  logSertecInfo("createSertecOrden:start", {
    payloadKeys: getPayloadKeys(payload),
  });

  const usuario = await getAuthenticatedUser(req);

  if (!usuario) {
    throw new Error("Debes iniciar sesion para registrar ordenes SERTEC");
  }

  const orden = await buildSertecOrden(payload);
  const sql = getSql();

  await sql`
    INSERT INTO sertec_ordenes (
      id,
      numero,
      estado,
      fecha_ingreso,
      cliente_id,
      cliente_nombre,
      cliente_documento,
      cliente_telefono,
      cotizacion_id,
      cotizacion_item_id,
      origen_comercial_tipo,
      fecha_venta,
      garantia_meses,
      equipo_tipo,
      equipo_marca,
      equipo_modelo,
      equipo_serial,
      falla_reportada,
      diagnostico,
      trabajo_realizado,
      observaciones,
      created_by,
      updated_by
    ) VALUES (
      ${orden.id},
      ${orden.numero},
      ${"entrada"},
      ${new Date().toISOString()},
      ${orden.clienteId ?? null},
      ${orden.clienteNombre},
      ${orden.clienteDocumento ?? null},
      ${orden.clienteTelefono ?? null},
      ${orden.cotizacionId ?? null},
      ${orden.cotizacionItemId ?? null},
      ${orden.origenComercialTipo ?? null},
      ${orden.fechaVenta?.toISOString() ?? null},
      ${orden.garantiaMeses ?? null},
      ${orden.equipoTipo},
      ${orden.equipoMarca ?? null},
      ${orden.equipoModelo ?? null},
      ${orden.equipoSerial ?? null},
      ${orden.fallaReportada},
      ${orden.diagnostico ?? null},
      ${orden.trabajoRealizado ?? null},
      ${orden.observaciones ?? null},
      ${usuario.id},
      ${usuario.id}
    )
  `;

  await recordSertecHistorial(
    orden.id,
    SertecOrdenEstado.ENTRADA,
    "entrada",
    usuario.id,
    "Orden de entrada registrada"
  );
  await insertSertecAdjuntos(orden.id, usuario.id, orden.adjuntos);

  const created = await findSertecOrdenById(orden.id);

  if (!created) {
    throw new Error("No se pudo recuperar la orden creada");
  }

  return created;
}

function getNextSertecState(current: SertecOrdenEstado, target: SertecOrdenEstado) {
  if (current === "entrada" && target === "reparacion") {
    return true;
  }

  if (current === "reparacion" && target === "salida") {
    return true;
  }

  return false;
}

async function transitionSertecOrden(
  req: NodeRequest,
  id: string,
  targetState: SertecOrdenEstado,
  payload: unknown
) {
  const usuario = await getAuthenticatedUser(req);

  if (!usuario) {
    throw new Error("Debes iniciar sesion para actualizar ordenes SERTEC");
  }

  const existing = await findSertecOrdenById(id);

  if (!existing) {
    return null;
  }

  if (existing.estado === targetState) {
    throw new Error("La orden ya se encuentra en ese estado");
  }

  if (!getNextSertecState(existing.estado, targetState)) {
    throw new Error("La transicion solicitada no es valida para la orden actual");
  }

  const transition = buildTransitionPayload(payload);
  const sql = getSql();
  const nowIso = new Date().toISOString();

  await sql`
    UPDATE sertec_ordenes
    SET
      estado = ${targetState},
      fecha_reparacion = ${
        targetState === SertecOrdenEstado.REPARACION
          ? nowIso
          : existing.fechaReparacion ?? null
      },
      fecha_salida = ${
        targetState === SertecOrdenEstado.SALIDA
          ? nowIso
          : existing.fechaSalida ?? null
      },
      diagnostico = ${transition.diagnostico ?? existing.diagnostico ?? null},
      trabajo_realizado = ${
        transition.trabajoRealizado ?? existing.trabajoRealizado ?? null
      },
      observaciones = ${transition.observaciones ?? existing.observaciones ?? null},
      updated_by = ${usuario.id},
      updated_at = NOW()
    WHERE id = ${id}
  `;

  await recordSertecHistorial(
    id,
    targetState,
    targetState,
    usuario.id,
    transition.detalle ??
      (targetState === "reparacion"
        ? "Orden enviada a reparacion"
        : "Orden registrada como salida")
  );

  return findSertecOrdenById(id);
}

async function findSertecAdjuntoContent(ordenId: string, adjuntoId: string) {
  const sql = getSql();
  const rows = (await sql`
    SELECT
      a.id,
      a.orden_id,
      a.nombre_archivo,
      a.tipo_mime,
      a.tamano,
      a.contenido_base64,
      a.descripcion,
      a.usuario_id,
      u.nombre AS usuario_nombre,
      a.created_at
    FROM sertec_orden_adjuntos a
    LEFT JOIN users u ON u.id = a.usuario_id
    WHERE a.orden_id = ${ordenId}
      AND a.id = ${adjuntoId}
    LIMIT 1
  `) as SertecOrdenAdjuntoRow[];

  const row = rows[0];

  if (!row?.contenido_base64) {
    return null;
  }

  return {
    buffer: Buffer.from(row.contenido_base64, "base64"),
    fileName: row.nombre_archivo,
    mimeType: row.tipo_mime,
  };
}

function isSertecValidationError(error: unknown) {
  return (
    error instanceof Error &&
    /obligatorio|obligatoria|invalida|invalido|adjunto|transicion|estado|cliente|equipo|falla|sesion|garantia|cotizacion|comercial|venta/i.test(
      error.message
    )
  );
}

export async function handleSertecCollection(
  req: NodeRequest,
  res: ServerResponse
) {
  try {
    if (req.method === "GET") {
      if (shouldListSertecComercialOrigenes(req.url)) {
        const origenes = await listSertecComercialOrigenes();
        sendJson(res, 200, origenes);
        return;
      }

      const ordenes = await listSertecOrdenes(readSertecCollectionFilters(req.url));
      sendJson(res, 200, ordenes);
      return;
    }

    if (req.method === "POST") {
      const payload = await readJsonBody(req);
      const orden = await createSertecOrden(req, payload);
      sendJson(res, 201, orden);
      return;
    }

    sendMethodNotAllowed(res, ["GET", "POST"]);
  } catch (error) {
    const statusCode = isSertecValidationError(error) ? 400 : 500;
    sendErrorJson(
      res,
      statusCode,
      statusCode === 400
        ? "Solicitud invalida en /api/sertec"
        : "Error interno en /api/sertec",
      getErrorMessage(error, "No se pudo procesar la solicitud")
    );
  }
}

export async function handleSertecItem(
  req: NodeRequest,
  res: ServerResponse,
  id: string
) {
  try {
    if (!id) {
      sendErrorJson(
        res,
        400,
        "Orden invalida",
        "Se recibio un id vacio para /api/sertec/[id]"
      );
      return;
    }

    if (req.method === "GET" && isAdjuntosResourceRequest(req.url)) {
      const adjuntoId = getAdjuntoIdFromRequestUrl(req.url);

      if (!adjuntoId) {
        sendErrorJson(
          res,
          400,
          "Adjunto invalido",
          "Debes indicar un adjuntoId valido"
        );
        return;
      }

      const adjunto = await findSertecAdjuntoContent(id, adjuntoId);

      if (!adjunto) {
        sendErrorJson(
          res,
          404,
          "Adjunto no encontrado",
          `No existe adjunto ${adjuntoId} para la orden ${id}`
        );
        return;
      }

      sendBuffer(
        res,
        200,
        adjunto.buffer,
        adjunto.mimeType,
        adjunto.fileName,
        shouldDownloadAdjunto(req.url) ? "attachment" : "inline"
      );
      return;
    }

    if (req.method === "POST" && isAdjuntosResourceRequest(req.url)) {
      const payload = await readJsonBody(req);
      const orden = await appendSertecAdjuntosToOrden(req, id, payload);

      if (!orden) {
        sendErrorJson(
          res,
          404,
          "Orden no encontrada",
          `No existe una orden SERTEC con id ${id}`
        );
        return;
      }

      sendJson(res, 200, orden);
      return;
    }

    if (req.method === "GET") {
      const orden = await findSertecOrdenById(id);

      if (!orden) {
        sendErrorJson(
          res,
          404,
          "Orden no encontrada",
          `No existe una orden SERTEC con id ${id}`
        );
        return;
      }

      sendJson(res, 200, orden);
      return;
    }

    if (req.method === "POST") {
      const transition = getSertecTransition(req.url);

      if (!transition) {
        sendErrorJson(
          res,
          400,
          "Transicion invalida",
          "Debes indicar transition=reparacion o transition=salida"
        );
        return;
      }

      const payload = await readJsonBody(req);
      const orden = await transitionSertecOrden(req, id, transition, payload);

      if (!orden) {
        sendErrorJson(
          res,
          404,
          "Orden no encontrada",
          `No existe una orden SERTEC con id ${id}`
        );
        return;
      }

      sendJson(res, 200, orden);
      return;
    }

    sendMethodNotAllowed(res, ["GET", "POST"]);
  } catch (error) {
    const statusCode = isSertecValidationError(error) ? 400 : 500;
    sendErrorJson(
      res,
      statusCode,
      statusCode === 400
        ? "Solicitud invalida en /api/sertec/[id]"
        : "Error interno en /api/sertec/[id]",
      getErrorMessage(error, "No se pudo procesar la solicitud")
    );
  }
}

export function createSertecDevMiddleware() {
  return (req: NodeRequest, res: ServerResponse, next: ConnectNext) => {
    const pathname = getPathname(req.url);

    if (pathname === "/api/sertec" || pathname === "/api/sertec/") {
      void handleSertecCollection(req, res).catch(next);
      return;
    }

    const sertecId = getSertecIdFromRequestUrl(req.url);

    if (sertecId) {
      void handleSertecItem(req, res, sertecId).catch(next);
      return;
    }

    next();
  };
}
