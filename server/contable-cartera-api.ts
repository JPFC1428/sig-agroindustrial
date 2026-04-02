import type { IncomingMessage, ServerResponse } from "node:http";
import {
  ContableCarteraEstado,
  ContableReciboDocumentoTipo,
  type ContableCarteraClienteItem,
  type ContableCarteraProveedorItem,
} from "../client/src/lib/types.js";
import { getSql } from "./neon.js";

type NodeRequest = IncomingMessage & {
  body?: unknown;
};

type ConnectNext = (error?: unknown) => void;

type ContableCarteraProveedorApiRecord = Omit<
  ContableCarteraProveedorItem,
  "fechaFactura" | "fechaVencimiento"
> & {
  fechaFactura: string;
  fechaVencimiento: string;
};

type ContableCarteraClienteApiRecord = Omit<
  ContableCarteraClienteItem,
  "fechaUltimoMovimiento"
> & {
  fechaUltimoMovimiento: string;
};

type CarteraProveedorRow = {
  estado: ContableCarteraEstado;
  fecha_factura: string | Date;
  fecha_vencimiento: string | Date;
  id: string;
  numero_factura: string;
  proveedor_documento_nit: string;
  proveedor_nombre_razon_social: string;
  saldo: number | string;
  tercero_id: string;
  total: number | string;
  valor_pagado: number | string;
  vencida: boolean;
};

type CarteraClienteRow = {
  cliente_documento_nit: string;
  cliente_nombre_razon_social: string;
  documento_id: string | null;
  documento_referencia: string | null;
  documento_tipo: ContableReciboDocumentoTipo;
  estado: ContableCarteraEstado;
  fecha_ultimo_movimiento: string | Date;
  id: string;
  saldo: number | string;
  tercero_id: string;
  total: number | string;
  valor_recibido: number | string;
};

type CarteraFilters = {
  estado?: ContableCarteraEstado;
  fechaDesde?: string;
  fechaHasta?: string;
  q?: string;
  terceroId?: string;
};

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

function sendErrorJson(
  res: ServerResponse,
  statusCode: number,
  error: string,
  detail: string
) {
  sendJson(res, statusCode, { detail, error });
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

function parseDateOnlyInput(value: string | undefined) {
  if (value === undefined) {
    return undefined;
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

function formatDateOnly(value: string | Date) {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  return String(value).slice(0, 10);
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function isValidationError(error: unknown) {
  return (
    error instanceof Error &&
    /fecha|invalido|solicitud/i.test(error.message)
  );
}

function mapProveedorRow(
  row: CarteraProveedorRow
): ContableCarteraProveedorApiRecord {
  return {
    estado: row.estado,
    fechaFactura: formatDateOnly(row.fecha_factura),
    fechaVencimiento: formatDateOnly(row.fecha_vencimiento),
    id: row.id,
    numeroFactura: row.numero_factura,
    proveedorDocumentoNit: row.proveedor_documento_nit,
    proveedorNombreRazonSocial: row.proveedor_nombre_razon_social,
    saldo: readNumber(row.saldo, 0),
    terceroId: row.tercero_id,
    total: readNumber(row.total, 0),
    valorPagado: readNumber(row.valor_pagado, 0),
    vencida: Boolean(row.vencida),
  };
}

function mapClienteRow(
  row: CarteraClienteRow
): ContableCarteraClienteApiRecord {
  return {
    clienteDocumentoNit: row.cliente_documento_nit,
    clienteNombreRazonSocial: row.cliente_nombre_razon_social,
    documentoId: row.documento_id ?? undefined,
    documentoReferencia: row.documento_referencia ?? undefined,
    documentoTipo: row.documento_tipo,
    estado: row.estado,
    fechaUltimoMovimiento: formatDateOnly(row.fecha_ultimo_movimiento),
    id: row.id,
    saldo: readNumber(row.saldo, 0),
    terceroId: row.tercero_id,
    total: readNumber(row.total, 0),
    valorRecibido: readNumber(row.valor_recibido, 0),
  };
}

function readFilters(urlValue?: string): CarteraFilters {
  const searchParams = getSearchParams(urlValue);
  const estado = readString(searchParams.get("estado"));
  const fechaDesde = parseDateOnlyInput(readString(searchParams.get("fechaDesde")));
  const fechaHasta = parseDateOnlyInput(readString(searchParams.get("fechaHasta")));
  const q = readString(searchParams.get("q"));
  const terceroId = readString(searchParams.get("terceroId"));

  return {
    ...(estado &&
    Object.values(ContableCarteraEstado).includes(estado as ContableCarteraEstado)
      ? { estado: estado as ContableCarteraEstado }
      : {}),
    ...(fechaDesde ? { fechaDesde } : {}),
    ...(fechaHasta ? { fechaHasta } : {}),
    ...(q ? { q } : {}),
    ...(terceroId ? { terceroId } : {}),
  };
}

async function listCarteraProveedores(filters: CarteraFilters = {}) {
  const sql = getSql();
  const whereClauses: string[] = ["f.estado <> 'anulada'"];
  const params: unknown[] = [];

  if (filters.q) {
    params.push(`%${filters.q}%`);
    whereClauses.push(`(
      f.numero_factura ILIKE $${params.length}
      OR t.nombre_razon_social ILIKE $${params.length}
      OR t.documento_nit ILIKE $${params.length}
    )`);
  }

  if (filters.terceroId) {
    params.push(filters.terceroId);
    whereClauses.push(`f.tercero_id = $${params.length}`);
  }

  if (filters.fechaDesde) {
    params.push(filters.fechaDesde);
    whereClauses.push(`f.fecha_factura >= $${params.length}`);
  }

  if (filters.fechaHasta) {
    params.push(filters.fechaHasta);
    whereClauses.push(`f.fecha_factura <= $${params.length}`);
  }

  if (filters.estado) {
    params.push(filters.estado);
    whereClauses.push(`(
      CASE
        WHEN f.saldo <= 0 THEN 'pagado'
        WHEN f.saldo < f.total THEN 'parcial'
        ELSE 'pendiente'
      END
    ) = $${params.length}`);
  }

  const query = `
    SELECT
      f.id,
      f.tercero_id,
      t.nombre_razon_social AS proveedor_nombre_razon_social,
      t.documento_nit AS proveedor_documento_nit,
      f.numero_factura,
      f.fecha_factura,
      f.fecha_vencimiento,
      f.total,
      COALESCE(SUM(ed.valor_pagado), 0) AS valor_pagado,
      f.saldo,
      CASE
        WHEN f.saldo <= 0 THEN 'pagado'
        WHEN f.saldo < f.total THEN 'parcial'
        ELSE 'pendiente'
      END AS estado,
      (f.fecha_vencimiento < CURRENT_DATE AND f.saldo > 0) AS vencida
    FROM contable_facturas_compra f
    INNER JOIN contable_terceros t ON t.id = f.tercero_id
    LEFT JOIN contable_egreso_detalle ed ON ed.factura_id = f.id
    ${whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : ""}
    GROUP BY
      f.id,
      f.tercero_id,
      t.nombre_razon_social,
      t.documento_nit,
      f.numero_factura,
      f.fecha_factura,
      f.fecha_vencimiento,
      f.total,
      f.saldo
    ORDER BY f.fecha_vencimiento ASC, f.fecha_factura DESC, f.numero_factura ASC
  `;

  const rows = (await sql.query(query, params)) as CarteraProveedorRow[];
  return rows.map(mapProveedorRow);
}

async function listCarteraClientes(filters: CarteraFilters = {}) {
  const sql = getSql();
  const whereClauses: string[] = [];
  const params: unknown[] = [];

  if (filters.q) {
    params.push(`%${filters.q}%`);
    whereClauses.push(`(
      t.nombre_razon_social ILIKE $${params.length}
      OR t.documento_nit ILIKE $${params.length}
      OR COALESCE(d.documento_referencia, '') ILIKE $${params.length}
      OR COALESCE(d.documento_id, '') ILIKE $${params.length}
    )`);
  }

  if (filters.terceroId) {
    params.push(filters.terceroId);
    whereClauses.push(`r.tercero_id = $${params.length}`);
  }

  if (filters.fechaDesde) {
    params.push(filters.fechaDesde);
    whereClauses.push(`r.fecha >= $${params.length}`);
  }

  if (filters.fechaHasta) {
    params.push(filters.fechaHasta);
    whereClauses.push(`r.fecha <= $${params.length}`);
  }

  if (filters.estado) {
    params.push(filters.estado);
    whereClauses.push(`(
      CASE
        WHEN GREATEST(COALESCE(MAX(d.valor_documento), SUM(d.valor_pagado)) - SUM(d.valor_pagado), 0) <= 0 THEN 'pagado'
        WHEN SUM(d.valor_pagado) > 0 THEN 'parcial'
        ELSE 'pendiente'
      END
    ) = $${params.length}`);
  }

  const query = `
    SELECT
      CONCAT(
        r.tercero_id,
        '::',
        d.documento_tipo,
        '::',
        COALESCE(d.documento_id, ''),
        '::',
        COALESCE(d.documento_referencia, '')
      ) AS id,
      r.tercero_id,
      t.nombre_razon_social AS cliente_nombre_razon_social,
      t.documento_nit AS cliente_documento_nit,
      d.documento_tipo,
      d.documento_id,
      d.documento_referencia,
      MAX(r.fecha) AS fecha_ultimo_movimiento,
      COALESCE(MAX(d.valor_documento), SUM(d.valor_pagado)) AS total,
      SUM(d.valor_pagado) AS valor_recibido,
      GREATEST(COALESCE(MAX(d.valor_documento), SUM(d.valor_pagado)) - SUM(d.valor_pagado), 0) AS saldo,
      CASE
        WHEN GREATEST(COALESCE(MAX(d.valor_documento), SUM(d.valor_pagado)) - SUM(d.valor_pagado), 0) <= 0 THEN 'pagado'
        WHEN SUM(d.valor_pagado) > 0 THEN 'parcial'
        ELSE 'pendiente'
      END AS estado
    FROM contable_recibo_detalle d
    INNER JOIN contable_recibos_caja r ON r.id = d.recibo_id
    INNER JOIN contable_terceros t ON t.id = r.tercero_id
    ${whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : ""}
    GROUP BY
      r.tercero_id,
      t.nombre_razon_social,
      t.documento_nit,
      d.documento_tipo,
      d.documento_id,
      d.documento_referencia
    ORDER BY MAX(r.fecha) DESC, t.nombre_razon_social ASC
  `;

  const rows = (await sql.query(query, params)) as CarteraClienteRow[];
  return rows.map(mapClienteRow);
}

export async function handleCarteraProveedoresCollection(
  req: NodeRequest,
  res: ServerResponse
) {
  try {
    if (req.method !== "GET") {
      sendMethodNotAllowed(res, ["GET"]);
      return;
    }

    const cartera = await listCarteraProveedores(readFilters(req.url));
    sendJson(res, 200, cartera);
  } catch (error) {
    const statusCode = isValidationError(error) ? 400 : 500;
    sendErrorJson(
      res,
      statusCode,
      statusCode === 400 ? "Solicitud invalida" : "Error interno",
      getErrorMessage(error, "No se pudo consultar la cartera de proveedores")
    );
  }
}

export async function handleCarteraClientesCollection(
  req: NodeRequest,
  res: ServerResponse
) {
  try {
    if (req.method !== "GET") {
      sendMethodNotAllowed(res, ["GET"]);
      return;
    }

    const cartera = await listCarteraClientes(readFilters(req.url));
    sendJson(res, 200, cartera);
  } catch (error) {
    const statusCode = isValidationError(error) ? 400 : 500;
    sendErrorJson(
      res,
      statusCode,
      statusCode === 400 ? "Solicitud invalida" : "Error interno",
      getErrorMessage(error, "No se pudo consultar la cartera de clientes")
    );
  }
}

export function createCarteraDevMiddleware() {
  return (req: NodeRequest, res: ServerResponse, next: ConnectNext) => {
    const pathname = getPathname(req.url);

    if (
      pathname === "/api/contable/cartera-proveedores" ||
      pathname === "/api/contable/cartera-proveedores/"
    ) {
      void handleCarteraProveedoresCollection(req, res).catch(next);
      return;
    }

    if (
      pathname === "/api/contable/cartera-clientes" ||
      pathname === "/api/contable/cartera-clientes/"
    ) {
      void handleCarteraClientesCollection(req, res).catch(next);
      return;
    }

    next();
  };
}
