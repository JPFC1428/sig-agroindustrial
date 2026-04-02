import type { IncomingMessage, ServerResponse } from "node:http";
import { nanoid } from "nanoid";
import {
  type ContableCuadreCaja,
  type ContableCuadreCajaMovimiento,
  type ContableCuadreCajaResumen,
  type ContableMetodoPago,
} from "../client/src/lib/types.js";
import { getSql } from "./neon.js";

type NodeRequest = IncomingMessage & {
  body?: unknown;
};

type ConnectNext = (error?: unknown) => void;

type ContableCuadreCajaMovimientoApiRecord = Omit<
  ContableCuadreCajaMovimiento,
  "fecha"
> & {
  fecha: string;
};

type ContableCuadreCajaApiRecord = Omit<
  ContableCuadreCaja,
  "fechaDesde" | "fechaHasta" | "createdAt" | "updatedAt"
> & {
  fechaDesde: string;
  fechaHasta: string;
  createdAt: string;
  updatedAt: string;
};

type ContableCuadreCajaResumenApiRecord = Omit<
  ContableCuadreCajaResumen,
  "fechaDesde" | "fechaHasta" | "ingresos" | "salidas"
> & {
  fechaDesde: string;
  fechaHasta: string;
  ingresos: ContableCuadreCajaMovimientoApiRecord[];
  salidas: ContableCuadreCajaMovimientoApiRecord[];
};

type ContableCuadreCajaRow = {
  id: string;
  fecha_desde: string | Date;
  fecha_hasta: string | Date;
  cantidad_ingresos: number | string;
  cantidad_salidas: number | string;
  total_ingresos: number | string;
  total_salidas: number | string;
  saldo_esperado: number | string;
  observaciones: string | null;
  created_at: string | Date;
  updated_at: string | Date;
};

type ContableCuadreCajaMovimientoRow = {
  id: string;
  tipo: ContableCuadreCajaMovimiento["tipo"];
  numero: string;
  tercero_nombre_razon_social: string;
  tercero_documento_nit: string;
  fecha: string | Date;
  valor: number | string;
  metodo_pago: ContableMetodoPago;
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

function readOptionalString(value: unknown) {
  if (value === undefined || value === null) {
    return undefined;
  }

  return readString(value);
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
    /fecha|rango|cierre|cuadre|observaciones|solicitud/i.test(error.message)
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
    /contable_cuadres_caja_rango_unique|duplicate key value/i.test(error.message)
  ) {
    return new Error("Ya existe un cierre de caja registrado para ese rango");
  }

  return error;
}

function parseDateOnlyInput(value: string | Date | undefined) {
  if (value === undefined) {
    return undefined;
  }

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      return undefined;
    }

    return value.toISOString().slice(0, 10);
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return undefined;
  }

  const parsed = new Date(`${trimmed}T00:00:00`);

  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }

  return trimmed.slice(0, 10);
}

function parseDateOnlyOutput(value: string | Date) {
  const parsed =
    value instanceof Date ? new Date(value) : new Date(`${value}T00:00:00`);

  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Fecha invalida en la base de datos");
  }

  return parsed;
}

function assertPayload(
  payload: unknown
): asserts payload is Record<string, unknown> {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Cuerpo de solicitud invalido");
  }
}

function buildDateRange(fechaDesdeValue: string | Date | undefined, fechaHastaValue: string | Date | undefined) {
  const fechaDesde = parseDateOnlyInput(fechaDesdeValue);
  const fechaHasta = parseDateOnlyInput(fechaHastaValue);

  if (!fechaDesde) {
    throw new Error("La fecha inicial es obligatoria");
  }

  if (!fechaHasta) {
    throw new Error("La fecha final es obligatoria");
  }

  if (fechaDesde > fechaHasta) {
    throw new Error("La fecha inicial no puede ser mayor que la fecha final");
  }

  return { fechaDesde, fechaHasta };
}

function mapMovimientoRow(
  row: ContableCuadreCajaMovimientoRow
): ContableCuadreCajaMovimientoApiRecord {
  return {
    id: row.id,
    tipo: row.tipo,
    numero: row.numero,
    terceroNombreRazonSocial: row.tercero_nombre_razon_social,
    terceroDocumentoNit: row.tercero_documento_nit,
    fecha: parseDateOnlyOutput(row.fecha).toISOString().slice(0, 10),
    valor: Number(row.valor),
    metodoPago: row.metodo_pago,
  };
}

function mapCuadreCajaRow(
  row: ContableCuadreCajaRow
): ContableCuadreCajaApiRecord {
  return {
    id: row.id,
    fechaDesde: parseDateOnlyOutput(row.fecha_desde).toISOString().slice(0, 10),
    fechaHasta: parseDateOnlyOutput(row.fecha_hasta).toISOString().slice(0, 10),
    cantidadIngresos: Number(row.cantidad_ingresos),
    cantidadSalidas: Number(row.cantidad_salidas),
    totalIngresos: Number(row.total_ingresos),
    totalSalidas: Number(row.total_salidas),
    saldoEsperado: Number(row.saldo_esperado),
    observaciones: row.observaciones ?? undefined,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

async function listCuadreCajaIngresos(fechaDesde: string, fechaHasta: string) {
  const sql = getSql();
  const rows = (await sql`
    SELECT
      r.id,
      'ingreso' AS tipo,
      r.numero_recibo AS numero,
      t.nombre_razon_social AS tercero_nombre_razon_social,
      t.documento_nit AS tercero_documento_nit,
      r.fecha,
      r.valor_total AS valor,
      r.metodo_pago
    FROM contable_recibos_caja r
    INNER JOIN contable_terceros t ON t.id = r.tercero_id
    WHERE r.fecha BETWEEN ${fechaDesde} AND ${fechaHasta}
    ORDER BY r.fecha DESC, r.created_at DESC
  `) as ContableCuadreCajaMovimientoRow[];

  return rows.map(mapMovimientoRow);
}

async function listCuadreCajaSalidas(fechaDesde: string, fechaHasta: string) {
  const sql = getSql();
  const rows = (await sql`
    SELECT
      e.id,
      'salida' AS tipo,
      e.numero_comprobante AS numero,
      t.nombre_razon_social AS tercero_nombre_razon_social,
      t.documento_nit AS tercero_documento_nit,
      e.fecha,
      e.valor_total AS valor,
      e.metodo_pago
    FROM contable_egresos e
    INNER JOIN contable_terceros t ON t.id = e.tercero_id
    WHERE e.fecha BETWEEN ${fechaDesde} AND ${fechaHasta}
    ORDER BY e.fecha DESC, e.created_at DESC
  `) as ContableCuadreCajaMovimientoRow[];

  return rows.map(mapMovimientoRow);
}

async function buildCuadreCajaResumen(
  fechaDesde: string,
  fechaHasta: string
): Promise<ContableCuadreCajaResumenApiRecord> {
  const [ingresos, salidas] = await Promise.all([
    listCuadreCajaIngresos(fechaDesde, fechaHasta),
    listCuadreCajaSalidas(fechaDesde, fechaHasta),
  ]);

  const totalIngresos = roundMoney(
    ingresos.reduce((accumulator, item) => accumulator + item.valor, 0)
  );
  const totalSalidas = roundMoney(
    salidas.reduce((accumulator, item) => accumulator + item.valor, 0)
  );

  return {
    fechaDesde,
    fechaHasta,
    cantidadIngresos: ingresos.length,
    cantidadSalidas: salidas.length,
    totalIngresos,
    totalSalidas,
    saldoEsperado: roundMoney(totalIngresos - totalSalidas),
    ingresos,
    salidas,
  };
}

async function listContableCuadresCaja() {
  const sql = getSql();
  const rows = (await sql`
    SELECT
      id,
      fecha_desde,
      fecha_hasta,
      cantidad_ingresos,
      cantidad_salidas,
      total_ingresos,
      total_salidas,
      saldo_esperado,
      observaciones,
      created_at,
      updated_at
    FROM contable_cuadres_caja
    ORDER BY created_at DESC, fecha_desde DESC
  `) as ContableCuadreCajaRow[];

  return rows.map(mapCuadreCajaRow);
}

async function createContableCuadreCaja(payload: unknown) {
  assertPayload(payload);

  const { fechaDesde, fechaHasta } = buildDateRange(
    payload.fechaDesde as string | Date | undefined,
    payload.fechaHasta as string | Date | undefined
  );
  const observaciones = readOptionalString(payload.observaciones);
  const resumen = await buildCuadreCajaResumen(fechaDesde, fechaHasta);
  const sql = getSql();

  try {
    const rows = (await sql`
      INSERT INTO contable_cuadres_caja (
        id,
        fecha_desde,
        fecha_hasta,
        cantidad_ingresos,
        cantidad_salidas,
        total_ingresos,
        total_salidas,
        saldo_esperado,
        observaciones,
        created_at,
        updated_at
      )
      VALUES (
        ${nanoid()},
        ${fechaDesde},
        ${fechaHasta},
        ${resumen.cantidadIngresos},
        ${resumen.cantidadSalidas},
        ${resumen.totalIngresos},
        ${resumen.totalSalidas},
        ${resumen.saldoEsperado},
        ${observaciones ?? null},
        NOW(),
        NOW()
      )
      RETURNING
        id,
        fecha_desde,
        fecha_hasta,
        cantidad_ingresos,
        cantidad_salidas,
        total_ingresos,
        total_salidas,
        saldo_esperado,
        observaciones,
        created_at,
        updated_at
    `) as ContableCuadreCajaRow[];

    if (!rows[0]) {
      throw new Error("No se pudo recuperar el cierre de caja registrado");
    }

    return mapCuadreCajaRow(rows[0]);
  } catch (error) {
    throw normalizeDatabaseError(error);
  }
}

function shouldReadResumen(urlValue?: string) {
  return getSearchParams(urlValue).get("resource") === "resumen";
}

function readSummaryRange(urlValue?: string) {
  const params = getSearchParams(urlValue);

  return buildDateRange(
    readString(params.get("fechaDesde")),
    readString(params.get("fechaHasta"))
  );
}

export async function handleContableCuadresCajaCollection(
  req: NodeRequest,
  res: ServerResponse
) {
  try {
    if (req.method === "GET") {
      if (shouldReadResumen(req.url)) {
        const { fechaDesde, fechaHasta } = readSummaryRange(req.url);
        const resumen = await buildCuadreCajaResumen(fechaDesde, fechaHasta);
        sendJson(res, 200, resumen);
        return;
      }

      const cuadres = await listContableCuadresCaja();
      sendJson(res, 200, cuadres);
      return;
    }

    if (req.method === "POST") {
      const payload = await readJsonBody(req);
      const cierre = await createContableCuadreCaja(payload);
      sendJson(res, 201, cierre);
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
    const detail = getErrorMessage(
      normalizedError,
      "No se pudo procesar el cuadre de caja"
    );

    sendErrorJson(
      res,
      statusCode,
      statusCode === 409
        ? "Conflicto al registrar el cierre"
        : statusCode === 400
          ? "Solicitud invalida"
          : "Error interno",
      detail
    );
  }
}

export function createContableCuadresCajaDevMiddleware() {
  return (req: NodeRequest, res: ServerResponse, next: ConnectNext) => {
    const pathname = getPathname(req.url);

    if (
      pathname === "/api/contable/cuadres-caja" ||
      pathname === "/api/contable/cuadres-caja/"
    ) {
      void handleContableCuadresCajaCollection(req, res).catch(next);
      return;
    }

    next();
  };
}
