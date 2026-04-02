import type { IncomingMessage, ServerResponse } from "node:http";
import { nanoid } from "nanoid";
import {
  ContableFacturaCompraEstado,
  ContableMetodoPago,
  type ContableEgreso,
  type ContableEgresoDetalle,
  type ContableFacturaCompra,
  type ContableTercero,
} from "../client/src/lib/types.js";
import { ensureContableCuentaBancariaDisponible } from "./contable-bancos-api.js";
import { getSql } from "./neon.js";

type NodeRequest = IncomingMessage & {
  body?: unknown;
};

type ConnectNext = (error?: unknown) => void;

type ContableEgresoApiRecord = Omit<
  ContableEgreso,
  "createdAt" | "fecha" | "detalles"
> & {
  fecha: string;
  createdAt: string;
  detalles?: ContableEgresoDetalleApiRecord[];
};

type ContableEgresoDetalleApiRecord = Omit<
  ContableEgresoDetalle,
  "createdAt" | "facturaFecha" | "facturaFechaVencimiento"
> & {
  createdAt: string;
  facturaFecha: string;
  facturaFechaVencimiento: string;
};

type ContableEgresoRow = {
  id: string;
  numero_comprobante: string;
  tercero_id: string;
  tercero_nombre_razon_social: string;
  tercero_documento_nit: string;
  cuenta_bancaria_id: string | null;
  cuenta_bancaria_nombre: string | null;
  cuenta_bancaria_numero: string | null;
  cuenta_bancaria_banco: string | null;
  fecha: string | Date;
  valor_total: number | string;
  metodo_pago: ContableMetodoPago;
  observaciones: string | null;
  soporte_url: string | null;
  created_at: string | Date;
};

type ContableEgresoDetalleRow = {
  id: string;
  egreso_id: string;
  factura_id: string;
  factura_numero: string;
  factura_fecha: string | Date;
  factura_fecha_vencimiento: string | Date;
  factura_total: number | string;
  factura_saldo_actual: number | string;
  valor_pagado: number | string;
  created_at: string | Date;
};

type EgresoProveedorRow = {
  id: string;
  tipo_tercero: ContableTercero["tipoTercero"];
  nombre_razon_social: string;
  documento_nit: string;
  estado: ContableTercero["estado"];
};

type EgresoFacturaDisponibleRow = {
  id: string;
  numero_factura: string;
  tercero_id: string;
  fecha_factura: string | Date;
  fecha_vencimiento: string | Date;
  total: number | string;
  saldo: number | string;
  estado: ContableFacturaCompra["estado"];
  created_at: string | Date;
  updated_at: string | Date;
};

type ContableEgresoPayload = {
  numeroComprobante?: string;
  terceroId?: string;
  cuentaBancariaId?: string;
  fecha?: string;
  valorTotal?: number | string;
  metodoPago?: string;
  observaciones?: string;
  soporteUrl?: string;
  detalles?: Array<{
    facturaId?: string;
    valorPagado?: number | string;
  }>;
};

type ContableEgresoFilters = {
  q?: string;
  terceroId?: string;
};

type BuiltContableEgresoDetalle = {
  id: string;
  facturaId: string;
  valorPagado: number;
};

type BuiltContableEgreso = {
  id: string;
  numeroComprobante: string;
  terceroId: string;
  cuentaBancariaId?: string;
  fecha: string;
  valorTotal: number;
  metodoPago: ContableMetodoPago;
  observaciones?: string;
  soporteUrl?: string;
  detalles: BuiltContableEgresoDetalle[];
};

const METODOS_PAGO = new Set<ContableMetodoPago>([
  ContableMetodoPago.EFECTIVO,
  ContableMetodoPago.TRANSFERENCIA,
  ContableMetodoPago.CHEQUE,
  ContableMetodoPago.TARJETA,
  ContableMetodoPago.OTRO,
] as ContableMetodoPago[]);

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

function parseDateOnlyInput(value: string | undefined, fallback?: string) {
  if (value === undefined) {
    return fallback;
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
    /obligatorio|invalido|proveedor|factura|saldo|pago|duplic|fecha|metodo|detalle|solicitud|soporte/i.test(
      error.message
    )
  );
}

function isConflictError(error: unknown) {
  return (
    error instanceof Error &&
    /duplicate key value|ya existe|unique|referenc|restric/i.test(error.message)
  );
}

function normalizeDatabaseError(error: unknown) {
  if (
    error instanceof Error &&
    /contable_egresos_numero_comprobante_key|duplicate key value/i.test(
      error.message
    )
  ) {
    return new Error("Ya existe un comprobante de egreso con ese numero");
  }

  if (
    error instanceof Error &&
    /idx_contable_egreso_detalle_egreso_factura_unique|duplicate key value/i.test(
      error.message
    )
  ) {
    return new Error("No se puede repetir la misma factura dentro del mismo egreso");
  }

  return error;
}

function mapEgresoDetalleRow(
  row: ContableEgresoDetalleRow
): ContableEgresoDetalleApiRecord {
  return {
    id: row.id,
    egresoId: row.egreso_id,
    facturaId: row.factura_id,
    facturaNumero: row.factura_numero,
    facturaFecha: formatDateOnly(row.factura_fecha),
    facturaFechaVencimiento: formatDateOnly(row.factura_fecha_vencimiento),
    facturaTotal: readNumber(row.factura_total, 0),
    facturaSaldoActual: readNumber(row.factura_saldo_actual, 0),
    valorPagado: readNumber(row.valor_pagado, 0),
    createdAt:
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : new Date(row.created_at).toISOString(),
  };
}

function mapEgresoRow(
  row: ContableEgresoRow,
  detalles?: ContableEgresoDetalleRow[]
): ContableEgresoApiRecord {
  return {
    id: row.id,
    numeroComprobante: row.numero_comprobante,
    terceroId: row.tercero_id,
    terceroNombreRazonSocial: row.tercero_nombre_razon_social,
    terceroDocumentoNit: row.tercero_documento_nit,
    cuentaBancariaId: row.cuenta_bancaria_id ?? undefined,
    cuentaBancariaNombre: row.cuenta_bancaria_nombre ?? undefined,
    cuentaBancariaNumero: row.cuenta_bancaria_numero ?? undefined,
    cuentaBancariaBanco: row.cuenta_bancaria_banco ?? undefined,
    fecha: formatDateOnly(row.fecha),
    valorTotal: readNumber(row.valor_total, 0),
    metodoPago: row.metodo_pago,
    observaciones: row.observaciones ?? undefined,
    soporteUrl: row.soporte_url ?? undefined,
    createdAt:
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : new Date(row.created_at).toISOString(),
    ...(detalles ? { detalles: detalles.map(mapEgresoDetalleRow) } : {}),
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
  `) as EgresoProveedorRow[];

  return rows[0] ?? null;
}

async function ensureProveedorDisponible(terceroId: string) {
  const proveedor = await findProveedorById(terceroId);

  if (!proveedor) {
    throw new Error("El proveedor seleccionado no existe");
  }

  if (proveedor.tipo_tercero !== "proveedor") {
    throw new Error("El egreso solo se puede relacionar con terceros tipo proveedor");
  }

  return proveedor;
}

async function listFacturasDisponiblesPorProveedor(terceroId: string) {
  const sql = getSql();
  const rows = (await sql`
    SELECT
      id,
      numero_factura,
      tercero_id,
      fecha_factura,
      fecha_vencimiento,
      total,
      saldo,
      estado,
      created_at,
      updated_at
    FROM contable_facturas_compra
    WHERE tercero_id = ${terceroId}
      AND saldo > 0
      AND estado <> ${ContableFacturaCompraEstado.ANULADA}
      AND estado <> ${ContableFacturaCompraEstado.PAGADA}
    ORDER BY fecha_factura ASC, numero_factura ASC
  `) as EgresoFacturaDisponibleRow[];

  return rows.map(row => ({
    id: row.id,
    numeroFactura: row.numero_factura,
    terceroId: row.tercero_id,
    terceroNombreRazonSocial: "",
    terceroDocumentoNit: "",
    fechaFactura: formatDateOnly(row.fecha_factura),
    fechaVencimiento: formatDateOnly(row.fecha_vencimiento),
    subtotal: 0,
    iva: 0,
    total: readNumber(row.total, 0),
    saldo: readNumber(row.saldo, 0),
    estado: row.estado,
    createdAt:
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : new Date(row.created_at).toISOString(),
    updatedAt:
      row.updated_at instanceof Date
        ? row.updated_at.toISOString()
        : new Date(row.updated_at).toISOString(),
  })) satisfies Array<{
    id: string;
    numeroFactura: string;
    terceroId: string;
    terceroNombreRazonSocial: string;
    terceroDocumentoNit: string;
    fechaFactura: string;
    fechaVencimiento: string;
    subtotal: number;
    iva: number;
    total: number;
    saldo: number;
    estado: ContableFacturaCompra["estado"];
    createdAt: string;
    updatedAt: string;
  }>;
}

async function findFacturaDisponibleParaPago(
  facturaId: string,
  terceroId: string
) {
  const sql = getSql();
  const rows = (await sql`
    SELECT
      id,
      numero_factura,
      tercero_id,
      fecha_factura,
      fecha_vencimiento,
      total,
      saldo,
      estado
    FROM contable_facturas_compra
    WHERE id = ${facturaId}
      AND tercero_id = ${terceroId}
    LIMIT 1
  `) as EgresoFacturaDisponibleRow[];

  return rows[0] ?? null;
}

function buildEgreso(payload: unknown): BuiltContableEgreso {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Cuerpo de solicitud invalido");
  }

  const data = payload as ContableEgresoPayload;
  const numeroComprobante = readString(data.numeroComprobante) ?? "";
  const terceroId = readString(data.terceroId) ?? "";
  const fecha = parseDateOnlyInput(data.fecha) ?? "";
  const metodoPagoRaw = readString(data.metodoPago) ?? "";
  const observaciones = readOptionalString(data.observaciones);
  const cuentaBancariaId = readString(data.cuentaBancariaId);
  const soporteUrl = readOptionalString(data.soporteUrl);
  const detallesPayload = Array.isArray(data.detalles) ? data.detalles : [];

  if (!numeroComprobante) {
    throw new Error("El numero de comprobante es obligatorio");
  }

  if (!terceroId) {
    throw new Error("Debes seleccionar un proveedor");
  }

  if (!fecha) {
    throw new Error("La fecha del egreso es obligatoria");
  }

  if (!METODOS_PAGO.has(metodoPagoRaw as ContableMetodoPago)) {
    throw new Error("El metodo de pago es invalido");
  }

  if (detallesPayload.length === 0) {
    throw new Error("Debes registrar al menos una factura en el detalle del egreso");
  }

  const detalles = detallesPayload.map((detalle, index) => {
    const facturaId = readString(detalle?.facturaId) ?? "";
    const valorPagado = roundMoney(readNumber(detalle?.valorPagado, NaN));

    if (!facturaId) {
      throw new Error(`La factura del detalle ${index + 1} es obligatoria`);
    }

    if (!Number.isFinite(valorPagado) || valorPagado <= 0) {
      throw new Error(`El valor pagado del detalle ${index + 1} debe ser mayor a cero`);
    }

    return {
      id: `egd-${nanoid(8)}`,
      facturaId,
      valorPagado,
    };
  });

  const uniqueFacturaIds = new Set(detalles.map(detalle => detalle.facturaId));

  if (uniqueFacturaIds.size !== detalles.length) {
    throw new Error("No se puede repetir la misma factura dentro del mismo egreso");
  }

  validateSupportUrl(soporteUrl);

  const valorTotal = roundMoney(
    detalles.reduce((accumulator, detalle) => accumulator + detalle.valorPagado, 0)
  );

  return {
    id: `egr-${nanoid(8)}`,
    numeroComprobante,
    terceroId,
    cuentaBancariaId,
    fecha,
    valorTotal,
    metodoPago: metodoPagoRaw as ContableMetodoPago,
    observaciones,
    soporteUrl,
    detalles,
  };
}

async function validateEgresoDetails(
  terceroId: string,
  detalles: BuiltContableEgresoDetalle[]
) {
  for (const detalle of detalles) {
    const factura = await findFacturaDisponibleParaPago(detalle.facturaId, terceroId);

    if (!factura) {
      throw new Error("Una de las facturas seleccionadas no existe o no pertenece al proveedor");
    }

    const saldoActual = readNumber(factura.saldo, 0);

    if (factura.estado === ContableFacturaCompraEstado.ANULADA) {
      throw new Error(`La factura ${factura.numero_factura} esta anulada`);
    }

    if (saldoActual <= 0) {
      throw new Error(`La factura ${factura.numero_factura} ya no tiene saldo disponible`);
    }

    if (detalle.valorPagado > saldoActual) {
      throw new Error(
        `El valor pagado para la factura ${factura.numero_factura} supera el saldo disponible`
      );
    }
  }
}

async function listEgresos(filters: ContableEgresoFilters = {}) {
  const sql = getSql();
  const whereClauses: string[] = [];
  const params: unknown[] = [];

  if (filters.q) {
    params.push(`%${filters.q}%`);
    whereClauses.push(`(
      e.numero_comprobante ILIKE $${params.length}
      OR t.nombre_razon_social ILIKE $${params.length}
      OR t.documento_nit ILIKE $${params.length}
    )`);
  }

  if (filters.terceroId) {
    params.push(filters.terceroId);
    whereClauses.push(`e.tercero_id = $${params.length}`);
  }

  const query = `
    SELECT
      e.id,
      e.numero_comprobante,
      e.tercero_id,
      t.nombre_razon_social AS tercero_nombre_razon_social,
      t.documento_nit AS tercero_documento_nit,
      e.cuenta_bancaria_id,
      c.nombre_cuenta AS cuenta_bancaria_nombre,
      c.numero_cuenta AS cuenta_bancaria_numero,
      c.nombre_banco AS cuenta_bancaria_banco,
      e.fecha,
      e.valor_total,
      e.metodo_pago,
      e.observaciones,
      e.soporte_url,
      e.created_at
    FROM contable_egresos e
    INNER JOIN contable_terceros t ON t.id = e.tercero_id
    LEFT JOIN contable_cuentas_bancarias c ON c.id = e.cuenta_bancaria_id
    ${
      whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : ""
    }
    ORDER BY e.fecha DESC, e.created_at DESC
  `;

  const rows = (await sql.query(query, params)) as ContableEgresoRow[];
  return rows.map(row => mapEgresoRow(row));
}

async function listEgresoDetalles(egresoId: string) {
  const sql = getSql();
  const rows = (await sql`
    SELECT
      d.id,
      d.egreso_id,
      d.factura_id,
      f.numero_factura AS factura_numero,
      f.fecha_factura AS factura_fecha,
      f.fecha_vencimiento AS factura_fecha_vencimiento,
      f.total AS factura_total,
      f.saldo AS factura_saldo_actual,
      d.valor_pagado,
      d.created_at
    FROM contable_egreso_detalle d
    INNER JOIN contable_facturas_compra f ON f.id = d.factura_id
    WHERE d.egreso_id = ${egresoId}
    ORDER BY f.fecha_factura ASC, f.numero_factura ASC
  `) as ContableEgresoDetalleRow[];

  return rows;
}

async function findEgresoById(id: string) {
  const sql = getSql();
  const rows = (await sql`
    SELECT
      e.id,
      e.numero_comprobante,
      e.tercero_id,
      t.nombre_razon_social AS tercero_nombre_razon_social,
      t.documento_nit AS tercero_documento_nit,
      e.cuenta_bancaria_id,
      c.nombre_cuenta AS cuenta_bancaria_nombre,
      c.numero_cuenta AS cuenta_bancaria_numero,
      c.nombre_banco AS cuenta_bancaria_banco,
      e.fecha,
      e.valor_total,
      e.metodo_pago,
      e.observaciones,
      e.soporte_url,
      e.created_at
    FROM contable_egresos e
    INNER JOIN contable_terceros t ON t.id = e.tercero_id
    LEFT JOIN contable_cuentas_bancarias c ON c.id = e.cuenta_bancaria_id
    WHERE e.id = ${id}
    LIMIT 1
  `) as ContableEgresoRow[];

  if (!rows[0]) {
    return null;
  }

  const detalles = await listEgresoDetalles(id);
  return mapEgresoRow(rows[0], detalles);
}

function shouldListFacturasDisponibles(urlValue?: string) {
  return getSearchParams(urlValue).get("resource") === "facturas-disponibles";
}

function readCollectionFilters(urlValue?: string): ContableEgresoFilters {
  const searchParams = getSearchParams(urlValue);
  const q = readString(searchParams.get("q"));
  const terceroId = readString(searchParams.get("terceroId"));

  return {
    ...(q ? { q } : {}),
    ...(terceroId ? { terceroId } : {}),
  };
}

export function getEgresoIdFromRequestUrl(urlValue?: string) {
  const match = getPathname(urlValue).match(/^\/api\/contable\/egresos\/([^/]+)\/?$/);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

async function insertEgreso(payload: unknown) {
  const egreso = buildEgreso(payload);
  await ensureProveedorDisponible(egreso.terceroId);
  if (egreso.cuentaBancariaId) {
    await ensureContableCuentaBancariaDisponible(egreso.cuentaBancariaId);
  }
  await validateEgresoDetails(egreso.terceroId, egreso.detalles);
  const sql = getSql();

  try {
    await sql.transaction(txn => [
      txn`
        INSERT INTO contable_egresos (
          id,
          numero_comprobante,
          tercero_id,
          cuenta_bancaria_id,
          fecha,
          valor_total,
          metodo_pago,
          observaciones,
          soporte_url
        ) VALUES (
          ${egreso.id},
          ${egreso.numeroComprobante},
          ${egreso.terceroId},
          ${egreso.cuentaBancariaId ?? null},
          ${egreso.fecha},
          ${egreso.valorTotal},
          ${egreso.metodoPago},
          ${egreso.observaciones ?? null},
          ${egreso.soporteUrl ?? null}
        )
      `,
      ...egreso.detalles.map(detalle => txn`
        INSERT INTO contable_egreso_detalle (
          id,
          egreso_id,
          factura_id,
          valor_pagado
        ) VALUES (
          ${detalle.id},
          ${egreso.id},
          ${detalle.facturaId},
          ${detalle.valorPagado}
        )
      `),
    ]);

    const created = await findEgresoById(egreso.id);

    if (!created) {
      throw new Error("No se pudo recuperar el egreso creado");
    }

    return created;
  } catch (error) {
    throw normalizeDatabaseError(error);
  }
}

async function deleteEgreso(id: string) {
  const existing = await findEgresoById(id);

  if (!existing) {
    return null;
  }

  const sql = getSql();

  try {
    const rows = (await sql`
      DELETE FROM contable_egresos
      WHERE id = ${id}
      RETURNING id
    `) as Array<{ id: string }>;

    return rows[0] ? existing : null;
  } catch (error) {
    throw normalizeDatabaseError(error);
  }
}

export async function handleEgresosCollection(
  req: NodeRequest,
  res: ServerResponse
) {
  try {
    if (req.method === "GET") {
      if (shouldListFacturasDisponibles(req.url)) {
        const terceroId = readString(getSearchParams(req.url).get("terceroId"));

        if (!terceroId) {
          sendErrorJson(
            res,
            400,
            "Solicitud invalida",
            "Debes indicar un proveedor para consultar facturas disponibles"
          );
          return;
        }

        await ensureProveedorDisponible(terceroId);
        const facturas = await listFacturasDisponiblesPorProveedor(terceroId);
        sendJson(res, 200, facturas);
        return;
      }

      const egresos = await listEgresos(readCollectionFilters(req.url));
      sendJson(res, 200, egresos);
      return;
    }

    if (req.method === "POST") {
      const payload = await readJsonBody(req);
      const egreso = await insertEgreso(payload);
      sendJson(res, 201, egreso);
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
      getErrorMessage(normalizedError, "No se pudo procesar el egreso")
    );
  }
}

export async function handleEgresoItem(
  req: NodeRequest,
  res: ServerResponse,
  id: string
) {
  try {
    if (req.method === "GET") {
      const egreso = await findEgresoById(id);

      if (!egreso) {
        sendErrorJson(
          res,
          404,
          "Egreso no encontrado",
          `No existe un egreso con id ${id}`
        );
        return;
      }

      sendJson(res, 200, egreso);
      return;
    }

    if (req.method === "DELETE") {
      const deleted = await deleteEgreso(id);

      if (!deleted) {
        sendErrorJson(
          res,
          404,
          "Egreso no encontrado",
          `No existe un egreso con id ${id}`
        );
        return;
      }

      sendEmpty(res, 204);
      return;
    }

    sendMethodNotAllowed(res, ["GET", "DELETE"]);
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
      getErrorMessage(normalizedError, "No se pudo procesar el egreso")
    );
  }
}

export function createEgresosDevMiddleware() {
  return (req: NodeRequest, res: ServerResponse, next: ConnectNext) => {
    const pathname = getPathname(req.url);

    if (pathname === "/api/contable/egresos" || pathname === "/api/contable/egresos/") {
      void handleEgresosCollection(req, res).catch(next);
      return;
    }

    const egresoId = getEgresoIdFromRequestUrl(req.url);

    if (egresoId) {
      void handleEgresoItem(req, res, egresoId).catch(next);
      return;
    }

    next();
  };
}
