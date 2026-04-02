import type { IncomingMessage, ServerResponse } from "node:http";
import { nanoid } from "nanoid";
import {
  ContableMetodoPago,
  ContableReciboDocumentoTipo,
  type ContableReciboCaja,
  type ContableReciboCajaDetalle,
  type ContableTercero,
} from "../client/src/lib/types.js";
import { ensureContableCuentaBancariaDisponible } from "./contable-bancos-api.js";
import { getSql } from "./neon.js";

type NodeRequest = IncomingMessage & {
  body?: unknown;
};

type ConnectNext = (error?: unknown) => void;

type ContableReciboCajaApiRecord = Omit<
  ContableReciboCaja,
  "createdAt" | "fecha" | "detalles"
> & {
  fecha: string;
  createdAt: string;
  detalles?: ContableReciboCajaDetalleApiRecord[];
};

type ContableReciboCajaDetalleApiRecord = Omit<
  ContableReciboCajaDetalle,
  "createdAt"
> & {
  createdAt: string;
};

type ContableReciboCajaRow = {
  id: string;
  numero_recibo: string;
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

type ContableReciboCajaDetalleRow = {
  id: string;
  recibo_id: string;
  documento_tipo: ContableReciboDocumentoTipo;
  documento_id: string | null;
  documento_referencia: string | null;
  valor_documento: number | string | null;
  valor_pagado: number | string;
  created_at: string | Date;
};

type ReciboClienteRow = {
  id: string;
  tipo_tercero: ContableTercero["tipoTercero"];
  nombre_razon_social: string;
  documento_nit: string;
  estado: ContableTercero["estado"];
};

type ContableReciboCajaPayload = {
  numeroRecibo?: string;
  terceroId?: string;
  cuentaBancariaId?: string;
  fecha?: string;
  valorTotal?: number | string;
  metodoPago?: string;
  observaciones?: string;
  soporteUrl?: string;
  detalles?: Array<{
    documentoTipo?: string;
    documentoId?: string;
    documentoReferencia?: string;
    valorDocumento?: number | string;
    valorPagado?: number | string;
  }>;
};

type ContableReciboCajaFilters = {
  fecha?: string;
  q?: string;
  terceroId?: string;
};

type BuiltContableReciboCajaDetalle = {
  documentoId?: string;
  documentoReferencia?: string;
  documentoTipo: ContableReciboDocumentoTipo;
  id: string;
  valorDocumento: number;
  valorPagado: number;
};

type ExistingReciboDocumentoRow = {
  documento_id: string | null;
  documento_referencia: string | null;
  documento_tipo: ContableReciboDocumentoTipo;
  valor_documento: number | string | null;
};

type BuiltContableReciboCaja = {
  createdAt?: string;
  detalles: BuiltContableReciboCajaDetalle[];
  fecha: string;
  id: string;
  metodoPago: ContableMetodoPago;
  numeroRecibo: string;
  observaciones?: string;
  soporteUrl?: string;
  cuentaBancariaId?: string;
  terceroId: string;
  valorTotal: number;
};

const METODOS_PAGO = new Set<ContableMetodoPago>([
  ContableMetodoPago.EFECTIVO,
  ContableMetodoPago.TRANSFERENCIA,
  ContableMetodoPago.CHEQUE,
  ContableMetodoPago.TARJETA,
  ContableMetodoPago.OTRO,
] as ContableMetodoPago[]);

const DOCUMENTO_TIPOS = new Set<ContableReciboDocumentoTipo>([
  ContableReciboDocumentoTipo.CUENTA_POR_COBRAR,
  ContableReciboDocumentoTipo.OTRO,
] as ContableReciboDocumentoTipo[]);

function setJsonHeaders(res: ServerResponse) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
}

function sendJson(res: ServerResponse, statusCode: number, payload: unknown) {
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

function readNumber(value: unknown, fallback: number) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readString(value: unknown) {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
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
    /obligatorio|invalido|cliente|documento|detalle|fecha|metodo|valor|solicitud|soporte/i.test(
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
    /contable_recibos_caja_numero_recibo_key|duplicate key value/i.test(
      error.message
    )
  ) {
    return new Error("Ya existe un recibo de caja con ese numero");
  }

  if (
    error instanceof Error &&
    /idx_contable_recibo_detalle_documento_unique|duplicate key value/i.test(
      error.message
    )
  ) {
    return new Error("No se puede repetir el mismo documento dentro del mismo recibo");
  }

  return error;
}

function mapReciboDetalleRow(
  row: ContableReciboCajaDetalleRow
): ContableReciboCajaDetalleApiRecord {
  return {
    createdAt:
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : new Date(row.created_at).toISOString(),
    documentoId: row.documento_id ?? undefined,
    documentoReferencia: row.documento_referencia ?? undefined,
    documentoTipo: row.documento_tipo,
    id: row.id,
    reciboId: row.recibo_id,
    valorDocumento:
      row.valor_documento === null ? undefined : readNumber(row.valor_documento, 0),
    valorPagado: readNumber(row.valor_pagado, 0),
  };
}

function mapReciboRow(
  row: ContableReciboCajaRow,
  detalles?: ContableReciboCajaDetalleRow[]
): ContableReciboCajaApiRecord {
  return {
    createdAt:
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : new Date(row.created_at).toISOString(),
    fecha: formatDateOnly(row.fecha),
    id: row.id,
    metodoPago: row.metodo_pago,
    numeroRecibo: row.numero_recibo,
    observaciones: row.observaciones ?? undefined,
    cuentaBancariaId: row.cuenta_bancaria_id ?? undefined,
    cuentaBancariaNombre: row.cuenta_bancaria_nombre ?? undefined,
    cuentaBancariaNumero: row.cuenta_bancaria_numero ?? undefined,
    cuentaBancariaBanco: row.cuenta_bancaria_banco ?? undefined,
    terceroDocumentoNit: row.tercero_documento_nit,
    terceroId: row.tercero_id,
    terceroNombreRazonSocial: row.tercero_nombre_razon_social,
    valorTotal: readNumber(row.valor_total, 0),
    soporteUrl: row.soporte_url ?? undefined,
    ...(detalles ? { detalles: detalles.map(mapReciboDetalleRow) } : {}),
  };
}

async function findClienteById(id: string) {
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
  `) as ReciboClienteRow[];

  return rows[0] ?? null;
}

async function ensureClienteDisponible(terceroId: string) {
  const cliente = await findClienteById(terceroId);

  if (!cliente) {
    throw new Error("El cliente seleccionado no existe");
  }

  if (cliente.tipo_tercero !== "cliente") {
    throw new Error("El recibo de caja solo se puede relacionar con terceros tipo cliente");
  }

  return cliente;
}

async function findExistingDocumentoAplicado(
  terceroId: string,
  detalle: BuiltContableReciboCajaDetalle
) {
  const sql = getSql();
  const documentoId = detalle.documentoId ?? null;
  const documentoReferencia = detalle.documentoReferencia ?? null;
  const rows = (await sql`
    SELECT
      d.documento_tipo,
      d.documento_id,
      d.documento_referencia,
      d.valor_documento
    FROM contable_recibo_detalle d
    INNER JOIN contable_recibos_caja r ON r.id = d.recibo_id
    WHERE r.tercero_id = ${terceroId}
      AND d.documento_tipo = ${detalle.documentoTipo}
      AND COALESCE(d.documento_id, '') = COALESCE(${documentoId}, '')
      AND COALESCE(d.documento_referencia, '') = COALESCE(${documentoReferencia}, '')
    LIMIT 1
  `) as ExistingReciboDocumentoRow[];

  return rows[0] ?? null;
}

function buildRecibo(payload: unknown): BuiltContableReciboCaja {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Cuerpo de solicitud invalido");
  }

  const data = payload as ContableReciboCajaPayload;
  const numeroRecibo = readString(data.numeroRecibo) ?? "";
  const terceroId = readString(data.terceroId) ?? "";
  const fecha = parseDateOnlyInput(readString(data.fecha)) ?? "";
  const metodoPagoRaw = readString(data.metodoPago) ?? "";
  const observaciones = readString(data.observaciones);
  const cuentaBancariaId = readString(data.cuentaBancariaId);
  const soporteUrl = readString(data.soporteUrl);
  const detallesPayload = Array.isArray(data.detalles) ? data.detalles : [];

  if (!numeroRecibo) {
    throw new Error("El numero de recibo es obligatorio");
  }

  if (!terceroId) {
    throw new Error("Debes seleccionar un cliente");
  }

  if (!fecha) {
    throw new Error("La fecha del recibo es obligatoria");
  }

  if (!METODOS_PAGO.has(metodoPagoRaw as ContableMetodoPago)) {
    throw new Error("El metodo de pago es invalido");
  }

  const detalles: BuiltContableReciboCajaDetalle[] = [];

  for (let index = 0; index < detallesPayload.length; index += 1) {
    const detalle = detallesPayload[index];
    const documentoTipo = readString(detalle?.documentoTipo) ?? "";
    const documentoId = readString(detalle?.documentoId);
    const documentoReferencia = readString(detalle?.documentoReferencia);
    const valorDocumento = roundMoney(readNumber(detalle?.valorDocumento, NaN));
    const valorPagado = roundMoney(readNumber(detalle?.valorPagado, NaN));

    if (
      !documentoTipo &&
      !documentoId &&
      !documentoReferencia &&
      !Number.isFinite(valorDocumento) &&
      !Number.isFinite(valorPagado)
    ) {
      continue;
    }

    if (!DOCUMENTO_TIPOS.has(documentoTipo as ContableReciboDocumentoTipo)) {
      throw new Error(`El tipo de documento del detalle ${index + 1} es invalido`);
    }

    if (!documentoId && !documentoReferencia) {
      throw new Error(
        `Debes indicar una referencia o documento en el detalle ${index + 1}`
      );
    }

    if (!Number.isFinite(valorDocumento) || valorDocumento <= 0) {
      throw new Error(
        `El valor total del documento en el detalle ${index + 1} debe ser mayor a cero`
      );
    }

    if (!Number.isFinite(valorPagado) || valorPagado <= 0) {
      throw new Error(
        `El valor aplicado del detalle ${index + 1} debe ser mayor a cero`
      );
    }

    if (valorPagado > valorDocumento) {
      throw new Error(
        `El valor aplicado del detalle ${index + 1} no puede superar el valor total del documento`
      );
    }

    detalles.push({
      documentoId,
      documentoReferencia,
      documentoTipo: documentoTipo as ContableReciboDocumentoTipo,
      id: `rcd-${nanoid(8)}`,
      valorDocumento,
      valorPagado,
    });
  }

  const uniqueDocumentKeys = new Set(
    detalles.map(detalle =>
      `${detalle.documentoTipo}::${detalle.documentoId ?? ""}::${detalle.documentoReferencia ?? ""}`
    )
  );

  if (uniqueDocumentKeys.size !== detalles.length) {
    throw new Error("No se puede repetir el mismo documento dentro del mismo recibo");
  }

  const totalDetalle = roundMoney(
    detalles.reduce((accumulator, detalle) => accumulator + detalle.valorPagado, 0)
  );
  const valorTotalManual = roundMoney(readNumber(data.valorTotal, NaN));
  const valorTotal =
    detalles.length > 0 ? totalDetalle : roundMoney(readNumber(data.valorTotal, NaN));

  if (!Number.isFinite(valorTotal) || valorTotal <= 0) {
    throw new Error("El valor total del recibo debe ser mayor a cero");
  }

  if (
    detalles.length > 0 &&
    Number.isFinite(valorTotalManual) &&
    Math.abs(valorTotalManual - totalDetalle) > 0.009
  ) {
    throw new Error("El valor total debe coincidir con la suma del detalle aplicado");
  }

  validateSupportUrl(soporteUrl);

  return {
    detalles,
    fecha,
    id: `rcj-${nanoid(8)}`,
    metodoPago: metodoPagoRaw as ContableMetodoPago,
    numeroRecibo,
    observaciones,
    soporteUrl,
    cuentaBancariaId,
    terceroId,
    valorTotal,
  };
}

async function validateReciboDetails(
  terceroId: string,
  detalles: BuiltContableReciboCajaDetalle[]
) {
  for (const detalle of detalles) {
    const existing = await findExistingDocumentoAplicado(terceroId, detalle);

    if (!existing) {
      continue;
    }

    const existingValorDocumento =
      existing.valor_documento === null ? null : readNumber(existing.valor_documento, NaN);

    if (
      existingValorDocumento !== null &&
      Number.isFinite(existingValorDocumento) &&
      Math.abs(existingValorDocumento - detalle.valorDocumento) > 0.009
    ) {
      throw new Error(
        `La referencia ${detalle.documentoReferencia ?? detalle.documentoId ?? "sin identificador"} ya existe con un valor total diferente`
      );
    }
  }
}

async function listRecibos(filters: ContableReciboCajaFilters = {}) {
  const sql = getSql();
  const whereClauses: string[] = [];
  const params: unknown[] = [];

  if (filters.q) {
    params.push(`%${filters.q}%`);
    whereClauses.push(`(
      r.numero_recibo ILIKE $${params.length}
      OR t.nombre_razon_social ILIKE $${params.length}
      OR t.documento_nit ILIKE $${params.length}
    )`);
  }

  if (filters.terceroId) {
    params.push(filters.terceroId);
    whereClauses.push(`r.tercero_id = $${params.length}`);
  }

  if (filters.fecha) {
    params.push(filters.fecha);
    whereClauses.push(`r.fecha = $${params.length}`);
  }

  const query = `
    SELECT
      r.id,
      r.numero_recibo,
      r.tercero_id,
      t.nombre_razon_social AS tercero_nombre_razon_social,
      t.documento_nit AS tercero_documento_nit,
      r.cuenta_bancaria_id,
      c.nombre_cuenta AS cuenta_bancaria_nombre,
      c.numero_cuenta AS cuenta_bancaria_numero,
      c.nombre_banco AS cuenta_bancaria_banco,
      r.fecha,
      r.valor_total,
      r.metodo_pago,
      r.observaciones,
      r.soporte_url,
      r.created_at
    FROM contable_recibos_caja r
    INNER JOIN contable_terceros t ON t.id = r.tercero_id
    LEFT JOIN contable_cuentas_bancarias c ON c.id = r.cuenta_bancaria_id
    ${
      whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : ""
    }
    ORDER BY r.fecha DESC, r.created_at DESC
  `;

  const rows = (await sql.query(query, params)) as ContableReciboCajaRow[];
  return rows.map(row => mapReciboRow(row));
}

async function listReciboDetalles(reciboId: string) {
  const sql = getSql();
  const rows = (await sql`
    SELECT
      id,
      recibo_id,
      documento_tipo,
      documento_id,
      documento_referencia,
      valor_documento,
      valor_pagado,
      created_at
    FROM contable_recibo_detalle
    WHERE recibo_id = ${reciboId}
    ORDER BY created_at ASC, documento_referencia ASC
  `) as ContableReciboCajaDetalleRow[];

  return rows;
}

async function findReciboById(id: string) {
  const sql = getSql();
  const rows = (await sql`
    SELECT
      r.id,
      r.numero_recibo,
      r.tercero_id,
      t.nombre_razon_social AS tercero_nombre_razon_social,
      t.documento_nit AS tercero_documento_nit,
      r.cuenta_bancaria_id,
      c.nombre_cuenta AS cuenta_bancaria_nombre,
      c.numero_cuenta AS cuenta_bancaria_numero,
      c.nombre_banco AS cuenta_bancaria_banco,
      r.fecha,
      r.valor_total,
      r.metodo_pago,
      r.observaciones,
      r.soporte_url,
      r.created_at
    FROM contable_recibos_caja r
    INNER JOIN contable_terceros t ON t.id = r.tercero_id
    LEFT JOIN contable_cuentas_bancarias c ON c.id = r.cuenta_bancaria_id
    WHERE r.id = ${id}
    LIMIT 1
  `) as ContableReciboCajaRow[];

  if (!rows[0]) {
    return null;
  }

  const detalles = await listReciboDetalles(id);
  return mapReciboRow(rows[0], detalles);
}

function readCollectionFilters(urlValue?: string): ContableReciboCajaFilters {
  const searchParams = getSearchParams(urlValue);
  const fecha = parseDateOnlyInput(readString(searchParams.get("fecha")));
  const q = readString(searchParams.get("q"));
  const terceroId = readString(searchParams.get("terceroId"));

  return {
    ...(fecha ? { fecha } : {}),
    ...(q ? { q } : {}),
    ...(terceroId ? { terceroId } : {}),
  };
}

export function getReciboCajaIdFromRequestUrl(urlValue?: string) {
  const match = getPathname(urlValue).match(
    /^\/api\/contable\/recibos-caja\/([^/]+)\/?$/
  );
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

async function insertRecibo(payload: unknown) {
  const recibo = buildRecibo(payload);
  await ensureClienteDisponible(recibo.terceroId);
  if (recibo.cuentaBancariaId) {
    await ensureContableCuentaBancariaDisponible(recibo.cuentaBancariaId);
  }
  await validateReciboDetails(recibo.terceroId, recibo.detalles);
  const sql = getSql();

  try {
    await sql.transaction(txn => [
      txn`
        INSERT INTO contable_recibos_caja (
          id,
          numero_recibo,
          tercero_id,
          cuenta_bancaria_id,
          fecha,
          valor_total,
          metodo_pago,
          observaciones,
          soporte_url
        ) VALUES (
          ${recibo.id},
          ${recibo.numeroRecibo},
          ${recibo.terceroId},
          ${recibo.cuentaBancariaId ?? null},
          ${recibo.fecha},
          ${recibo.valorTotal},
          ${recibo.metodoPago},
          ${recibo.observaciones ?? null},
          ${recibo.soporteUrl ?? null}
        )
      `,
      ...recibo.detalles.map(detalle => txn`
        INSERT INTO contable_recibo_detalle (
          id,
          recibo_id,
          documento_tipo,
          documento_id,
          documento_referencia,
          valor_documento,
          valor_pagado
        ) VALUES (
          ${detalle.id},
          ${recibo.id},
          ${detalle.documentoTipo},
          ${detalle.documentoId ?? null},
          ${detalle.documentoReferencia ?? null},
          ${detalle.valorDocumento},
          ${detalle.valorPagado}
        )
      `),
    ]);

    const created = await findReciboById(recibo.id);

    if (!created) {
      throw new Error("No se pudo recuperar el recibo creado");
    }

    return created;
  } catch (error) {
    throw normalizeDatabaseError(error);
  }
}

async function deleteRecibo(id: string) {
  const existing = await findReciboById(id);

  if (!existing) {
    return null;
  }

  const sql = getSql();

  try {
    const rows = (await sql`
      DELETE FROM contable_recibos_caja
      WHERE id = ${id}
      RETURNING id
    `) as Array<{ id: string }>;

    return rows[0] ? existing : null;
  } catch (error) {
    throw normalizeDatabaseError(error);
  }
}

export async function handleRecibosCajaCollection(
  req: NodeRequest,
  res: ServerResponse
) {
  try {
    if (req.method === "GET") {
      const recibos = await listRecibos(readCollectionFilters(req.url));
      sendJson(res, 200, recibos);
      return;
    }

    if (req.method === "POST") {
      const payload = await readJsonBody(req);
      const recibo = await insertRecibo(payload);
      sendJson(res, 201, recibo);
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
      getErrorMessage(normalizedError, "No se pudo procesar el recibo de caja")
    );
  }
}

export async function handleReciboCajaItem(
  req: NodeRequest,
  res: ServerResponse,
  id: string
) {
  try {
    if (req.method === "GET") {
      const recibo = await findReciboById(id);

      if (!recibo) {
        sendErrorJson(
          res,
          404,
          "Recibo no encontrado",
          `No existe un recibo de caja con id ${id}`
        );
        return;
      }

      sendJson(res, 200, recibo);
      return;
    }

    if (req.method === "DELETE") {
      const deleted = await deleteRecibo(id);

      if (!deleted) {
        sendErrorJson(
          res,
          404,
          "Recibo no encontrado",
          `No existe un recibo de caja con id ${id}`
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
      getErrorMessage(normalizedError, "No se pudo procesar el recibo de caja")
    );
  }
}

export function createRecibosCajaDevMiddleware() {
  return (req: NodeRequest, res: ServerResponse, next: ConnectNext) => {
    const pathname = getPathname(req.url);

    if (
      pathname === "/api/contable/recibos-caja" ||
      pathname === "/api/contable/recibos-caja/"
    ) {
      void handleRecibosCajaCollection(req, res).catch(next);
      return;
    }

    const reciboId = getReciboCajaIdFromRequestUrl(req.url);

    if (reciboId) {
      void handleReciboCajaItem(req, res, reciboId).catch(next);
      return;
    }

    next();
  };
}
