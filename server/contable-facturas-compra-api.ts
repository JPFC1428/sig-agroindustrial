import type { IncomingMessage, ServerResponse } from "node:http";
import { nanoid } from "nanoid";
import {
  ContableFacturaCompraEstado,
  type ContableFacturaCompra,
  type ContableTercero,
} from "../client/src/lib/types.js";
import { getSql } from "./neon.js";

type NodeRequest = IncomingMessage & {
  body?: unknown;
};

type ConnectNext = (error?: unknown) => void;

type ContableFacturaCompraApiRecord = Omit<
  ContableFacturaCompra,
  "createdAt" | "updatedAt" | "fechaFactura" | "fechaVencimiento"
> & {
  fechaFactura: string;
  fechaVencimiento: string;
  createdAt: string;
  updatedAt: string;
};

type ContableFacturaCompraRow = {
  id: string;
  numero_factura: string;
  tercero_id: string;
  tercero_nombre_razon_social: string;
  tercero_documento_nit: string;
  fecha_factura: string | Date;
  fecha_vencimiento: string | Date;
  subtotal: number | string;
  iva: number | string;
  total: number | string;
  saldo: number | string;
  estado: ContableFacturaCompra["estado"];
  observaciones: string | null;
  soporte_url: string | null;
  created_at: string | Date;
  updated_at: string | Date;
};

type ContableFacturaCompraPayload = {
  numeroFactura?: string;
  terceroId?: string;
  fechaFactura?: string;
  fechaVencimiento?: string;
  subtotal?: number | string;
  iva?: number | string;
  total?: number | string;
  saldo?: number | string;
  estado?: string;
  observaciones?: string;
  soporteUrl?: string;
};

type ContableFacturaCompraFilters = {
  estado?: ContableFacturaCompra["estado"];
  q?: string;
  terceroId?: string;
};

type BuiltContableFacturaCompra = {
  id: string;
  numeroFactura: string;
  terceroId: string;
  fechaFactura: string;
  fechaVencimiento: string;
  subtotal: number;
  iva: number;
  total: number;
  saldo: number;
  estado: ContableFacturaCompra["estado"];
  observaciones?: string;
  soporteUrl?: string;
};

type ProveedorRow = {
  id: string;
  tipo_tercero: ContableTercero["tipoTercero"];
  nombre_razon_social: string;
  documento_nit: string;
  estado: ContableTercero["estado"];
};

const FACTURA_COMPRA_ESTADOS = new Set<ContableFacturaCompra["estado"]>([
  ContableFacturaCompraEstado.PENDIENTE,
  ContableFacturaCompraEstado.PARCIAL,
  ContableFacturaCompraEstado.PAGADA,
  ContableFacturaCompraEstado.VENCIDA,
  ContableFacturaCompraEstado.ANULADA,
] as ContableFacturaCompra["estado"][]);

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

function sendEmpty(res: ServerResponse, statusCode = 204) {
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

function readOptionalString(value: unknown, fallback?: string) {
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

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function isValidationError(error: unknown) {
  return (
    error instanceof Error &&
    /obligatorio|invalido|saldo|total|proveedor|solicitud|fecha|soporte/i.test(
      error.message
    )
  );
}

function isConflictError(error: unknown) {
  return (
    error instanceof Error &&
    /duplicate key value|ya existe|unique/i.test(error.message)
  );
}

function normalizeDatabaseError(error: unknown) {
  if (
    error instanceof Error &&
    /idx_contable_facturas_compra_tercero_numero_unique|duplicate key value/i.test(
      error.message
    )
  ) {
    return new Error(
      "Ya existe una factura de compra con ese numero para el proveedor seleccionado"
    );
  }

  if (
    error instanceof Error &&
    /contable_egreso_detalle_factura_id_fkey|violates foreign key constraint/i.test(
      error.message
    )
  ) {
    return new Error(
      "No se puede eliminar la factura porque tiene comprobantes de egreso asociados"
    );
  }

  return error;
}

function parseDateOnlyInput(
  value: string | Date | undefined,
  fallback?: string
): string | undefined {
  if (value === undefined) {
    return fallback;
  }

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw new Error("Fecha invalida");
    }

    return value.toISOString().slice(0, 10);
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return undefined;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    throw new Error("Las fechas deben tener formato YYYY-MM-DD");
  }

  return trimmed;
}

function isPastDate(dateValue: string) {
  const today = new Date();
  const todayOnly = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  return dateValue < todayOnly;
}

function validateSupportUrl(urlValue: string | undefined) {
  if (!urlValue) {
    return;
  }

  try {
    const parsed = new URL(urlValue);

    if (!["http:", "https:"].includes(parsed.protocol)) {
      throw new Error("El soporte URL debe usar http o https");
    }
  } catch (error) {
    if (error instanceof Error && /http o https/i.test(error.message)) {
      throw error;
    }

    throw new Error("El soporte URL no es valido");
  }
}

function resolveEstado(
  requestedEstado: ContableFacturaCompra["estado"] | undefined,
  total: number,
  saldo: number,
  fechaVencimiento: string
): ContableFacturaCompra["estado"] {
  if (requestedEstado === ContableFacturaCompraEstado.ANULADA) {
    return ContableFacturaCompraEstado.ANULADA;
  }

  if (saldo <= 0) {
    return ContableFacturaCompraEstado.PAGADA;
  }

  if (saldo < total) {
    return ContableFacturaCompraEstado.PARCIAL;
  }

  if (isPastDate(fechaVencimiento)) {
    return ContableFacturaCompraEstado.VENCIDA;
  }

  if (requestedEstado && FACTURA_COMPRA_ESTADOS.has(requestedEstado)) {
    return requestedEstado;
  }

  return ContableFacturaCompraEstado.PENDIENTE;
}

function mapFacturaCompraRow(
  row: ContableFacturaCompraRow
): ContableFacturaCompraApiRecord {
  const createdAt = row.created_at instanceof Date
    ? row.created_at.toISOString()
    : new Date(row.created_at).toISOString();
  const updatedAt = row.updated_at instanceof Date
    ? row.updated_at.toISOString()
    : new Date(row.updated_at).toISOString();
  const fechaFactura = row.fecha_factura instanceof Date
    ? row.fecha_factura.toISOString().slice(0, 10)
    : String(row.fecha_factura).slice(0, 10);
  const fechaVencimiento = row.fecha_vencimiento instanceof Date
    ? row.fecha_vencimiento.toISOString().slice(0, 10)
    : String(row.fecha_vencimiento).slice(0, 10);

  return {
    id: row.id,
    numeroFactura: row.numero_factura,
    terceroId: row.tercero_id,
    terceroNombreRazonSocial: row.tercero_nombre_razon_social,
    terceroDocumentoNit: row.tercero_documento_nit,
    fechaFactura,
    fechaVencimiento,
    subtotal: readNumber(row.subtotal, 0),
    iva: readNumber(row.iva, 0),
    total: readNumber(row.total, 0),
    saldo: readNumber(row.saldo, 0),
    estado: row.estado,
    observaciones: row.observaciones ?? undefined,
    soporteUrl: row.soporte_url ?? undefined,
    createdAt,
    updatedAt,
  };
}

async function findProveedorById(id: string) {
  const sql = getSql();
  const rows = (await sql`
    SELECT
      id,
      tipo_tercero,
      nombre_razon_social,
      documento_nit,
      estado
    FROM contable_terceros
    WHERE id = ${id}
    LIMIT 1
  `) as ProveedorRow[];

  return rows[0] ?? null;
}

function buildFacturaCompra(
  payload: unknown,
  existing?: ContableFacturaCompraApiRecord
): BuiltContableFacturaCompra {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Cuerpo de solicitud invalido");
  }

  const data = payload as ContableFacturaCompraPayload;
  const numeroFactura =
    readString(data.numeroFactura) ?? existing?.numeroFactura ?? "";
  const terceroId = readString(data.terceroId) ?? existing?.terceroId ?? "";
  const fechaFactura =
    parseDateOnlyInput(data.fechaFactura, existing?.fechaFactura) ?? "";
  const fechaVencimiento =
    parseDateOnlyInput(data.fechaVencimiento, existing?.fechaVencimiento) ?? "";
  const subtotal = roundMoney(readNumber(data.subtotal, existing?.subtotal ?? 0));
  const iva = roundMoney(readNumber(data.iva, existing?.iva ?? 0));
  const total = roundMoney(subtotal + iva);
  const saldo = roundMoney(readNumber(data.saldo, existing?.saldo ?? total));
  const soporteUrl = readOptionalString(data.soporteUrl, existing?.soporteUrl);
  const observaciones = readOptionalString(
    data.observaciones,
    existing?.observaciones
  );
  const requestedEstado = readString(data.estado) as
    | ContableFacturaCompra["estado"]
    | undefined;

  if (!numeroFactura) {
    throw new Error("El numero de factura es obligatorio");
  }

  if (!terceroId) {
    throw new Error("Debes seleccionar un proveedor");
  }

  if (!fechaFactura || !fechaVencimiento) {
    throw new Error("La fecha de factura y la fecha de vencimiento son obligatorias");
  }

  if (subtotal < 0 || iva < 0 || total < 0 || saldo < 0) {
    throw new Error("Los valores monetarios no pueden ser negativos");
  }

  if (saldo > total) {
    throw new Error("El saldo no puede ser mayor al total");
  }

  if (requestedEstado && !FACTURA_COMPRA_ESTADOS.has(requestedEstado)) {
    throw new Error("El estado de la factura es invalido");
  }

  validateSupportUrl(soporteUrl);

  return {
    id: existing?.id ?? `fcp-${nanoid(8)}`,
    numeroFactura,
    terceroId,
    fechaFactura,
    fechaVencimiento,
    subtotal,
    iva,
    total,
    saldo,
    estado: resolveEstado(requestedEstado, total, saldo, fechaVencimiento),
    observaciones,
    soporteUrl,
  };
}

async function ensureProveedorDisponible(terceroId: string) {
  const proveedor = await findProveedorById(terceroId);

  if (!proveedor) {
    throw new Error("El proveedor seleccionado no existe");
  }

  if (proveedor.tipo_tercero !== "proveedor") {
    throw new Error("La factura solo se puede relacionar con terceros tipo proveedor");
  }

  return proveedor;
}

async function listFacturasCompra(filters: ContableFacturaCompraFilters = {}) {
  const sql = getSql();
  const whereClauses: string[] = [];
  const params: unknown[] = [];

  if (filters.q) {
    params.push(`%${filters.q}%`);
    whereClauses.push(`(
      f.numero_factura ILIKE $${params.length}
      OR t.nombre_razon_social ILIKE $${params.length}
      OR t.documento_nit ILIKE $${params.length}
    )`);
  }

  if (filters.estado) {
    params.push(filters.estado);
    whereClauses.push(`f.estado = $${params.length}`);
  }

  if (filters.terceroId) {
    params.push(filters.terceroId);
    whereClauses.push(`f.tercero_id = $${params.length}`);
  }

  const query = `
    SELECT
      f.id,
      f.numero_factura,
      f.tercero_id,
      t.nombre_razon_social AS tercero_nombre_razon_social,
      t.documento_nit AS tercero_documento_nit,
      f.fecha_factura,
      f.fecha_vencimiento,
      f.subtotal,
      f.iva,
      f.total,
      f.saldo,
      f.estado,
      f.observaciones,
      f.soporte_url,
      f.created_at,
      f.updated_at
    FROM contable_facturas_compra f
    INNER JOIN contable_terceros t ON t.id = f.tercero_id
    ${
      whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : ""
    }
    ORDER BY f.fecha_factura DESC, f.created_at DESC
  `;

  const rows = (await sql.query(query, params)) as ContableFacturaCompraRow[];
  return rows.map(mapFacturaCompraRow);
}

async function findFacturaCompraById(id: string) {
  const sql = getSql();
  const rows = (await sql`
    SELECT
      f.id,
      f.numero_factura,
      f.tercero_id,
      t.nombre_razon_social AS tercero_nombre_razon_social,
      t.documento_nit AS tercero_documento_nit,
      f.fecha_factura,
      f.fecha_vencimiento,
      f.subtotal,
      f.iva,
      f.total,
      f.saldo,
      f.estado,
      f.observaciones,
      f.soporte_url,
      f.created_at,
      f.updated_at
    FROM contable_facturas_compra f
    INNER JOIN contable_terceros t ON t.id = f.tercero_id
    WHERE f.id = ${id}
    LIMIT 1
  `) as ContableFacturaCompraRow[];

  return rows[0] ? mapFacturaCompraRow(rows[0]) : null;
}

async function insertFacturaCompra(payload: unknown) {
  const factura = buildFacturaCompra(payload);
  await ensureProveedorDisponible(factura.terceroId);
  const sql = getSql();

  try {
    const rows = (await sql`
      INSERT INTO contable_facturas_compra (
        id,
        numero_factura,
        tercero_id,
        fecha_factura,
        fecha_vencimiento,
        subtotal,
        iva,
        total,
        saldo,
        estado,
        observaciones,
        soporte_url
      )
      VALUES (
        ${factura.id},
        ${factura.numeroFactura},
        ${factura.terceroId},
        ${factura.fechaFactura},
        ${factura.fechaVencimiento},
        ${factura.subtotal},
        ${factura.iva},
        ${factura.total},
        ${factura.saldo},
        ${factura.estado},
        ${factura.observaciones ?? null},
        ${factura.soporteUrl ?? null}
      )
      RETURNING
        id,
        numero_factura,
        tercero_id,
        fecha_factura,
        fecha_vencimiento,
        subtotal,
        iva,
        total,
        saldo,
        estado,
        observaciones,
        soporte_url,
        created_at,
        updated_at
    `) as Array<
      Omit<ContableFacturaCompraRow, "tercero_nombre_razon_social" | "tercero_documento_nit"> & {
        tercero_nombre_razon_social?: string;
        tercero_documento_nit?: string;
      }
    >;

    const saved = await findFacturaCompraById(rows[0].id);

    if (!saved) {
      throw new Error("No se pudo recuperar la factura creada");
    }

    return saved;
  } catch (error) {
    throw normalizeDatabaseError(error);
  }
}

async function updateFacturaCompra(id: string, payload: unknown) {
  const existing = await findFacturaCompraById(id);

  if (!existing) {
    return null;
  }

  const factura = buildFacturaCompra(payload, existing);
  await ensureProveedorDisponible(factura.terceroId);
  const sql = getSql();

  try {
    const rows = (await sql`
      UPDATE contable_facturas_compra
      SET
        numero_factura = ${factura.numeroFactura},
        tercero_id = ${factura.terceroId},
        fecha_factura = ${factura.fechaFactura},
        fecha_vencimiento = ${factura.fechaVencimiento},
        subtotal = ${factura.subtotal},
        iva = ${factura.iva},
        total = ${factura.total},
        saldo = ${factura.saldo},
        estado = ${factura.estado},
        observaciones = ${factura.observaciones ?? null},
        soporte_url = ${factura.soporteUrl ?? null},
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING id
    `) as Array<{ id: string }>;

    if (!rows[0]) {
      return null;
    }

    const saved = await findFacturaCompraById(rows[0].id);

    if (!saved) {
      throw new Error("No se pudo recuperar la factura actualizada");
    }

    return saved;
  } catch (error) {
    throw normalizeDatabaseError(error);
  }
}

async function removeFacturaCompra(id: string) {
  const sql = getSql();
  const rows = (await sql`
    DELETE FROM contable_facturas_compra
    WHERE id = ${id}
    RETURNING id
  `) as Array<{ id: string }>;

  return rows.length > 0;
}

function readCollectionFilters(urlValue?: string): ContableFacturaCompraFilters {
  const searchParams = getSearchParams(urlValue);
  const q = readString(searchParams.get("q"));
  const estado = readString(searchParams.get("estado"));
  const terceroId = readString(searchParams.get("terceroId"));

  return {
    ...(q ? { q } : {}),
    ...(estado && FACTURA_COMPRA_ESTADOS.has(estado as ContableFacturaCompra["estado"])
      ? { estado: estado as ContableFacturaCompra["estado"] }
      : {}),
    ...(terceroId ? { terceroId } : {}),
  };
}

export function getFacturaCompraIdFromRequestUrl(urlValue?: string) {
  const match = getPathname(urlValue).match(
    /^\/api\/contable\/facturas-compra\/([^/]+)\/?$/
  );

  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

export async function handleFacturasCompraCollection(
  req: NodeRequest,
  res: ServerResponse
) {
  try {
    if (req.method === "GET") {
      const facturas = await listFacturasCompra(readCollectionFilters(req.url));
      sendJson(res, 200, facturas);
      return;
    }

    if (req.method === "POST") {
      const payload = await readJsonBody(req);
      const factura = await insertFacturaCompra(payload);
      sendJson(res, 201, factura);
      return;
    }

    sendMethodNotAllowed(res, ["GET", "POST"]);
  } catch (error) {
    const normalizedError = normalizeDatabaseError(error);
    const statusCode = isConflictError(normalizedError)
      ? 409
      : isValidationError(normalizedError)
        ? 400
        : 500;

    sendErrorJson(
      res,
      statusCode,
      statusCode === 409
        ? "Conflicto"
        : statusCode === 400
          ? "Solicitud invalida"
          : "Error interno",
      getErrorMessage(
        normalizedError,
        "No se pudo procesar la factura de compra"
      )
    );
  }
}

export async function handleFacturaCompraItem(
  req: NodeRequest,
  res: ServerResponse,
  id: string
) {
  try {
    if (req.method === "GET") {
      const factura = await findFacturaCompraById(id);

      if (!factura) {
        sendErrorJson(
          res,
          404,
          "Factura de compra no encontrada",
          `No existe una factura de compra con id ${id}`
        );
        return;
      }

      sendJson(res, 200, factura);
      return;
    }

    if (req.method === "PUT") {
      const payload = await readJsonBody(req);
      const factura = await updateFacturaCompra(id, payload);

      if (!factura) {
        sendErrorJson(
          res,
          404,
          "Factura de compra no encontrada",
          `No existe una factura de compra con id ${id}`
        );
        return;
      }

      sendJson(res, 200, factura);
      return;
    }

    if (req.method === "DELETE") {
      const deleted = await removeFacturaCompra(id);

      if (!deleted) {
        sendErrorJson(
          res,
          404,
          "Factura de compra no encontrada",
          `No existe una factura de compra con id ${id}`
        );
        return;
      }

      sendEmpty(res, 204);
      return;
    }

    sendMethodNotAllowed(res, ["GET", "PUT", "DELETE"]);
  } catch (error) {
    const normalizedError = normalizeDatabaseError(error);
    const statusCode = isConflictError(normalizedError)
      ? 409
      : isValidationError(normalizedError)
        ? 400
        : 500;

    sendErrorJson(
      res,
      statusCode,
      statusCode === 409
        ? "Conflicto"
        : statusCode === 400
          ? "Solicitud invalida"
          : "Error interno",
      getErrorMessage(
        normalizedError,
        "No se pudo procesar la factura de compra"
      )
    );
  }
}

export function createFacturasCompraDevMiddleware() {
  return (req: NodeRequest, res: ServerResponse, next: ConnectNext) => {
    const pathname = getPathname(req.url);

    if (
      pathname === "/api/contable/facturas-compra" ||
      pathname === "/api/contable/facturas-compra/"
    ) {
      void handleFacturasCompraCollection(req, res).catch(next);
      return;
    }

    const facturaId = getFacturaCompraIdFromRequestUrl(req.url);

    if (facturaId) {
      void handleFacturaCompraItem(req, res, facturaId).catch(next);
      return;
    }

    next();
  };
}
