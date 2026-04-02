import type { IncomingMessage, ServerResponse } from "node:http";
import { nanoid } from "nanoid";
import {
  ContableCuentaBancariaTipo,
  type ContableCuentaBancaria,
  type ContableConciliacionBancaria,
  type ContableCuentaBancariaMovimientos,
  type ContableMovimientoBancario,
} from "../client/src/lib/types.js";
import { getSql } from "./neon.js";

type NodeRequest = IncomingMessage & {
  body?: unknown;
};

type ConnectNext = (error?: unknown) => void;

type ContableCuentaBancariaApiRecord = Omit<
  ContableCuentaBancaria,
  "createdAt" | "updatedAt"
> & {
  createdAt: string;
  updatedAt: string;
};

type ContableMovimientoBancarioApiRecord = Omit<
  ContableMovimientoBancario,
  "createdAt" | "fecha" | "fechaConciliacion"
> & {
  createdAt: string;
  fecha: string;
  fechaConciliacion?: string;
};

type ContableCuentaBancariaMovimientosApiRecord = Omit<
  ContableCuentaBancariaMovimientos,
  "cuenta" | "fechaDesde" | "fechaHasta" | "movimientos"
> & {
  cuenta: ContableCuentaBancariaApiRecord;
  fechaDesde?: string;
  fechaHasta?: string;
  movimientos: ContableMovimientoBancarioApiRecord[];
};

type ContableConciliacionBancariaApiRecord = Omit<
  ContableConciliacionBancaria,
  "cuenta" | "fechaDesde" | "fechaHasta" | "movimientos"
> & {
  cuenta: ContableCuentaBancariaApiRecord;
  fechaDesde?: string;
  fechaHasta?: string;
  movimientos: ContableMovimientoBancarioApiRecord[];
};

type ContableCuentaBancariaRow = {
  id: string;
  nombre_banco: string;
  nombre_cuenta: string;
  tipo_cuenta: ContableCuentaBancariaTipo;
  numero_cuenta: string;
  titular: string;
  saldo_inicial: number | string;
  activa: boolean;
  observaciones: string | null;
  created_at: string | Date;
  updated_at: string | Date;
};

type ContableMovimientoBancarioRow = {
  id: string;
  cuenta_bancaria_id: string;
  fecha: string | Date;
  tipo_movimiento: ContableMovimientoBancario["tipo"];
  referencia_tipo: ContableMovimientoBancario["referenciaTipo"];
  referencia_id: string;
  referencia_numero: string;
  tercero_id: string;
  tercero_nombre_razon_social: string;
  tercero_documento_nit: string;
  valor: number | string;
  conciliado: boolean;
  fecha_conciliacion: string | Date | null;
  metodo_pago: ContableMovimientoBancario["metodoPago"];
  created_at: string | Date;
  saldo_acumulado: number | string;
};

type ContableCuentaBancariaPayload = {
  nombreBanco?: string;
  nombreCuenta?: string;
  tipoCuenta?: string;
  numeroCuenta?: string;
  titular?: string;
  saldoInicial?: number | string;
  activa?: boolean;
  observaciones?: string | null;
};

type ContableCuentasBancariasFilters = {
  activa?: boolean;
  q?: string;
};

type ContableCuentaBancariaMovimientosFilters = {
  fechaDesde?: string;
  fechaHasta?: string;
};

type ConciliacionMovimientoPayload = {
  conciliado?: boolean;
  referenciaId?: string;
  referenciaTipo?: string;
};

type BuiltContableCuentaBancaria = {
  id: string;
  nombreBanco: string;
  nombreCuenta: string;
  tipoCuenta: ContableCuentaBancariaTipo;
  numeroCuenta: string;
  titular: string;
  saldoInicial: number;
  activa: boolean;
  observaciones?: string;
};

const CONTABLE_CUENTA_BANCARIA_TIPOS = new Set<ContableCuentaBancariaTipo>([
  ContableCuentaBancariaTipo.AHORROS,
  ContableCuentaBancariaTipo.CORRIENTE,
  ContableCuentaBancariaTipo.OTRA,
]);

function setJsonHeaders(res: ServerResponse) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
}

function sendJson(res: ServerResponse, statusCode: number, payload: unknown) {
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

function parseDateValue(value: string | Date) {
  const parsed = value instanceof Date ? new Date(value) : new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Fecha invalida en la base de datos");
  }

  return parsed;
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

function parseBooleanParam(value: string | null) {
  if (value === null || value.trim() === "") {
    return undefined;
  }

  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  throw new Error("El filtro de estado debe ser true o false");
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function isValidationError(error: unknown) {
  return (
    error instanceof Error &&
    /obligatorio|invalido|numero|saldo|fecha|cuenta|banco|titular|estado|filtro/i.test(
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
    /idx_contable_cuentas_bancarias_numero_unique|duplicate key value/i.test(
      error.message
    )
  ) {
    return new Error("Ya existe una cuenta bancaria con ese numero");
  }

  return error;
}

function mapCuentaBancariaRow(
  row: ContableCuentaBancariaRow
): ContableCuentaBancariaApiRecord {
  const createdAt = parseDateValue(row.created_at);
  const updatedAt = parseDateValue(row.updated_at);

  return {
    id: row.id,
    nombreBanco: row.nombre_banco,
    nombreCuenta: row.nombre_cuenta,
    tipoCuenta: row.tipo_cuenta,
    numeroCuenta: row.numero_cuenta,
    titular: row.titular,
    saldoInicial: readNumber(row.saldo_inicial, 0),
    activa: row.activa,
    observaciones: row.observaciones ?? undefined,
    createdAt: createdAt.toISOString(),
    updatedAt: updatedAt.toISOString(),
  };
}

function mapMovimientoRow(
  row: ContableMovimientoBancarioRow
): ContableMovimientoBancarioApiRecord {
  return {
    id: row.id,
    cuentaBancariaId: row.cuenta_bancaria_id,
    fecha: formatDateOnly(row.fecha),
    tipo: row.tipo_movimiento,
    referenciaTipo: row.referencia_tipo,
    referenciaId: row.referencia_id,
    referenciaNumero: row.referencia_numero,
    terceroId: row.tercero_id,
    terceroNombreRazonSocial: row.tercero_nombre_razon_social,
    terceroDocumentoNit: row.tercero_documento_nit,
    valor: readNumber(row.valor, 0),
    saldoAcumulado: readNumber(row.saldo_acumulado, 0),
    conciliado: row.conciliado,
    fechaConciliacion: row.fecha_conciliacion
      ? parseDateValue(row.fecha_conciliacion).toISOString()
      : undefined,
    metodoPago: row.metodo_pago,
    createdAt:
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : new Date(row.created_at).toISOString(),
  };
}

function buildCuentaBancaria(
  payload: unknown,
  existing?: ContableCuentaBancariaApiRecord
): BuiltContableCuentaBancaria {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Cuerpo de solicitud invalido");
  }

  const data = payload as ContableCuentaBancariaPayload;
  const nombreBanco = readString(data.nombreBanco) ?? existing?.nombreBanco ?? "";
  const nombreCuenta =
    readString(data.nombreCuenta) ?? existing?.nombreCuenta ?? "";
  const tipoCuentaRaw = readString(data.tipoCuenta) ?? existing?.tipoCuenta ?? "";
  const numeroCuenta =
    readString(data.numeroCuenta) ?? existing?.numeroCuenta ?? "";
  const titular = readString(data.titular) ?? existing?.titular ?? "";
  const saldoInicial = roundMoney(
    readNumber(data.saldoInicial, existing?.saldoInicial ?? 0)
  );
  const observaciones = readOptionalString(
    data.observaciones,
    existing?.observaciones
  );
  const activa =
    typeof data.activa === "boolean" ? data.activa : existing?.activa ?? true;

  if (!nombreBanco) {
    throw new Error("El nombre del banco es obligatorio");
  }

  if (!nombreCuenta) {
    throw new Error("El nombre de la cuenta es obligatorio");
  }

  if (
    !CONTABLE_CUENTA_BANCARIA_TIPOS.has(
      tipoCuentaRaw as ContableCuentaBancariaTipo
    )
  ) {
    throw new Error("El tipo de cuenta es invalido");
  }

  if (!numeroCuenta) {
    throw new Error("El numero de cuenta es obligatorio");
  }

  if (!titular) {
    throw new Error("El titular de la cuenta es obligatorio");
  }

  if (!Number.isFinite(saldoInicial) || saldoInicial < 0) {
    throw new Error("El saldo inicial debe ser un valor valido mayor o igual a cero");
  }

  return {
    id: existing?.id ?? `cbk-${nanoid(8)}`,
    nombreBanco,
    nombreCuenta,
    tipoCuenta: tipoCuentaRaw as ContableCuentaBancariaTipo,
    numeroCuenta,
    titular,
    saldoInicial,
    activa,
    observaciones,
  };
}

async function listCuentasBancarias(filters: ContableCuentasBancariasFilters = {}) {
  const sql = getSql();
  const whereClauses: string[] = [];
  const params: unknown[] = [];

  if (filters.q) {
    params.push(`%${filters.q}%`);
    whereClauses.push(`(
      c.nombre_banco ILIKE $${params.length}
      OR c.nombre_cuenta ILIKE $${params.length}
      OR c.numero_cuenta ILIKE $${params.length}
      OR c.titular ILIKE $${params.length}
    )`);
  }

  if (filters.activa !== undefined) {
    params.push(filters.activa);
    whereClauses.push(`c.activa = $${params.length}`);
  }

  const query = `
    SELECT
      c.id,
      c.nombre_banco,
      c.nombre_cuenta,
      c.tipo_cuenta,
      c.numero_cuenta,
      c.titular,
      c.saldo_inicial,
      c.activa,
      c.observaciones,
      c.created_at,
      c.updated_at
    FROM contable_cuentas_bancarias c
    ${
      whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : ""
    }
    ORDER BY c.activa DESC, c.nombre_banco ASC, c.nombre_cuenta ASC
  `;

  const rows = (await sql.query(query, params)) as ContableCuentaBancariaRow[];
  return rows.map(mapCuentaBancariaRow);
}

export async function findContableCuentaBancariaById(id: string) {
  const sql = getSql();
  const rows = (await sql`
    SELECT
      c.id,
      c.nombre_banco,
      c.nombre_cuenta,
      c.tipo_cuenta,
      c.numero_cuenta,
      c.titular,
      c.saldo_inicial,
      c.activa,
      c.observaciones,
      c.created_at,
      c.updated_at
    FROM contable_cuentas_bancarias c
    WHERE c.id = ${id}
    LIMIT 1
  `) as ContableCuentaBancariaRow[];

  return rows[0] ? mapCuentaBancariaRow(rows[0]) : null;
}

export async function ensureContableCuentaBancariaDisponible(
  cuentaId: string,
  options: { requireActive?: boolean } = {}
) {
  const cuenta = await findContableCuentaBancariaById(cuentaId);

  if (!cuenta) {
    throw new Error("La cuenta bancaria seleccionada no existe");
  }

  if (options.requireActive !== false && !cuenta.activa) {
    throw new Error("La cuenta bancaria seleccionada esta inactiva");
  }

  return cuenta;
}

async function insertCuentaBancaria(payload: unknown) {
  const cuenta = buildCuentaBancaria(payload);
  const sql = getSql();

  try {
    const rows = (await sql`
      INSERT INTO contable_cuentas_bancarias (
        id,
        nombre_banco,
        nombre_cuenta,
        tipo_cuenta,
        numero_cuenta,
        titular,
        saldo_inicial,
        activa,
        observaciones
      )
      VALUES (
        ${cuenta.id},
        ${cuenta.nombreBanco},
        ${cuenta.nombreCuenta},
        ${cuenta.tipoCuenta},
        ${cuenta.numeroCuenta},
        ${cuenta.titular},
        ${cuenta.saldoInicial},
        ${cuenta.activa},
        ${cuenta.observaciones ?? null}
      )
      RETURNING
        id,
        nombre_banco,
        nombre_cuenta,
        tipo_cuenta,
        numero_cuenta,
        titular,
        saldo_inicial,
        activa,
        observaciones,
        created_at,
        updated_at
    `) as ContableCuentaBancariaRow[];

    return mapCuentaBancariaRow(rows[0]);
  } catch (error) {
    throw normalizeDatabaseError(error);
  }
}

async function updateCuentaBancaria(id: string, payload: unknown) {
  const existing = await findContableCuentaBancariaById(id);

  if (!existing) {
    return null;
  }

  const cuenta = buildCuentaBancaria(payload, existing);
  const sql = getSql();

  try {
    const rows = (await sql`
      UPDATE contable_cuentas_bancarias
      SET
        nombre_banco = ${cuenta.nombreBanco},
        nombre_cuenta = ${cuenta.nombreCuenta},
        tipo_cuenta = ${cuenta.tipoCuenta},
        numero_cuenta = ${cuenta.numeroCuenta},
        titular = ${cuenta.titular},
        saldo_inicial = ${cuenta.saldoInicial},
        activa = ${cuenta.activa},
        observaciones = ${cuenta.observaciones ?? null},
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING
        id,
        nombre_banco,
        nombre_cuenta,
        tipo_cuenta,
        numero_cuenta,
        titular,
        saldo_inicial,
        activa,
        observaciones,
        created_at,
        updated_at
    `) as ContableCuentaBancariaRow[];

    return rows[0] ? mapCuentaBancariaRow(rows[0]) : null;
  } catch (error) {
    throw normalizeDatabaseError(error);
  }
}

async function getSaldoInicialPeriodo(
  cuentaId: string,
  saldoInicial: number,
  fechaDesde?: string
) {
  if (!fechaDesde) {
    return roundMoney(saldoInicial);
  }

  const sql = getSql();
  const rows = (await sql.query(
    `
      WITH movimientos_previos AS (
        SELECT r.valor_total AS valor_signed
        FROM contable_recibos_caja r
        WHERE r.cuenta_bancaria_id = $1
          AND r.fecha < $2

        UNION ALL

        SELECT (e.valor_total * -1) AS valor_signed
        FROM contable_egresos e
        WHERE e.cuenta_bancaria_id = $1
          AND e.fecha < $2
      )
      SELECT COALESCE(SUM(valor_signed), 0) AS total
      FROM movimientos_previos
    `,
    [cuentaId, fechaDesde]
  )) as Array<{ total: number | string }>;

  return roundMoney(saldoInicial + readNumber(rows[0]?.total, 0));
}

async function listMovimientosCuentaBancaria(
  cuentaId: string,
  filters: ContableCuentaBancariaMovimientosFilters
) {
  const cuenta = await findContableCuentaBancariaById(cuentaId);

  if (!cuenta) {
    return null;
  }

  const fechaDesde = filters.fechaDesde;
  const fechaHasta = filters.fechaHasta;
  const saldoInicialPeriodo = await getSaldoInicialPeriodo(
    cuentaId,
    cuenta.saldoInicial,
    fechaDesde
  );
  const sql = getSql();
  const params: unknown[] = [cuentaId, saldoInicialPeriodo];
  const whereClauses: string[] = [];

  if (fechaDesde) {
    params.push(fechaDesde);
    whereClauses.push(`m.fecha >= $${params.length}`);
  }

  if (fechaHasta) {
    params.push(fechaHasta);
    whereClauses.push(`m.fecha <= $${params.length}`);
  }

  const query = `
    WITH movimientos AS (
      SELECT
        r.id,
        r.cuenta_bancaria_id,
        r.fecha,
        'ingreso' AS tipo_movimiento,
        'recibo_caja' AS referencia_tipo,
        r.id AS referencia_id,
        r.numero_recibo AS referencia_numero,
        r.tercero_id,
        t.nombre_razon_social AS tercero_nombre_razon_social,
        t.documento_nit AS tercero_documento_nit,
        r.valor_total AS valor,
        r.valor_total AS valor_signed,
        r.conciliado,
        r.fecha_conciliacion,
        r.metodo_pago,
        r.created_at
      FROM contable_recibos_caja r
      INNER JOIN contable_terceros t ON t.id = r.tercero_id
      WHERE r.cuenta_bancaria_id = $1

      UNION ALL

      SELECT
        e.id,
        e.cuenta_bancaria_id,
        e.fecha,
        'egreso' AS tipo_movimiento,
        'egreso' AS referencia_tipo,
        e.id AS referencia_id,
        e.numero_comprobante AS referencia_numero,
        e.tercero_id,
        t.nombre_razon_social AS tercero_nombre_razon_social,
        t.documento_nit AS tercero_documento_nit,
        e.valor_total AS valor,
        (e.valor_total * -1) AS valor_signed,
        e.conciliado,
        e.fecha_conciliacion,
        e.metodo_pago,
        e.created_at
      FROM contable_egresos e
      INNER JOIN contable_terceros t ON t.id = e.tercero_id
      WHERE e.cuenta_bancaria_id = $1
    )
    SELECT
      m.id,
      m.cuenta_bancaria_id,
      m.fecha,
      m.tipo_movimiento,
      m.referencia_tipo,
      m.referencia_id,
      m.referencia_numero,
      m.tercero_id,
      m.tercero_nombre_razon_social,
      m.tercero_documento_nit,
      m.valor,
      m.conciliado,
      m.fecha_conciliacion,
      m.metodo_pago,
      m.created_at,
      (
        $2 + SUM(m.valor_signed) OVER (
          ORDER BY
            m.fecha ASC,
            m.created_at ASC,
            m.referencia_tipo ASC,
            m.referencia_numero ASC,
            m.referencia_id ASC
        )
      ) AS saldo_acumulado
    FROM movimientos m
    ${
      whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : ""
    }
    ORDER BY
      m.fecha DESC,
      m.created_at DESC,
      m.referencia_tipo DESC,
      m.referencia_numero DESC,
      m.referencia_id DESC
  `;

  const rows = (await sql.query(query, params)) as ContableMovimientoBancarioRow[];
  const movimientos = rows.map(mapMovimientoRow);
  const totalIngresos = roundMoney(
    movimientos
      .filter(movimiento => movimiento.tipo === "ingreso")
      .reduce((accumulator, movimiento) => accumulator + movimiento.valor, 0)
  );
  const totalEgresos = roundMoney(
    movimientos
      .filter(movimiento => movimiento.tipo === "egreso")
      .reduce((accumulator, movimiento) => accumulator + movimiento.valor, 0)
  );
  const saldoFinal = movimientos[0]?.saldoAcumulado ?? saldoInicialPeriodo;

  return {
    cuenta,
    ...(fechaDesde ? { fechaDesde } : {}),
    ...(fechaHasta ? { fechaHasta } : {}),
    saldoInicialPeriodo,
    saldoFinal,
    totalIngresos,
    totalEgresos,
    movimientos,
  } satisfies ContableCuentaBancariaMovimientosApiRecord;
}

function buildConciliacionBancariaRecord(
  movimientosCuenta: ContableCuentaBancariaMovimientosApiRecord
) {
  const saldoSistema = movimientosCuenta.saldoFinal;
  const saldoConciliado = roundMoney(
    movimientosCuenta.saldoInicialPeriodo +
      movimientosCuenta.movimientos.reduce((accumulator, movimiento) => {
        if (!movimiento.conciliado) {
          return accumulator;
        }

        return (
          accumulator +
          (movimiento.tipo === "ingreso" ? movimiento.valor : movimiento.valor * -1)
        );
      }, 0)
  );
  const diferencia = roundMoney(saldoSistema - saldoConciliado);

  return {
    cuenta: movimientosCuenta.cuenta,
    ...(movimientosCuenta.fechaDesde ? { fechaDesde: movimientosCuenta.fechaDesde } : {}),
    ...(movimientosCuenta.fechaHasta ? { fechaHasta: movimientosCuenta.fechaHasta } : {}),
    totalIngresos: movimientosCuenta.totalIngresos,
    totalEgresos: movimientosCuenta.totalEgresos,
    saldoSistema,
    saldoConciliado,
    diferencia,
    movimientos: movimientosCuenta.movimientos,
  } satisfies ContableConciliacionBancariaApiRecord;
}

async function updateMovimientoConciliacion(
  cuentaId: string,
  payload: unknown
) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Cuerpo de solicitud invalido");
  }

  const data = payload as ConciliacionMovimientoPayload;
  const referenciaTipo = readString(data.referenciaTipo) ?? "";
  const referenciaId = readString(data.referenciaId) ?? "";
  const conciliado = data.conciliado;

  if (!referenciaId) {
    throw new Error("Debes indicar el movimiento a conciliar");
  }

  if (referenciaTipo !== "egreso" && referenciaTipo !== "recibo_caja") {
    throw new Error("El tipo de movimiento de conciliacion es invalido");
  }

  if (typeof conciliado !== "boolean") {
    throw new Error("Debes indicar el estado de conciliacion");
  }

  await ensureContableCuentaBancariaDisponible(cuentaId, { requireActive: false });
  const sql = getSql();

  if (referenciaTipo === "egreso") {
    const rows = (await sql`
      UPDATE contable_egresos
      SET
        conciliado = ${conciliado},
        fecha_conciliacion = ${conciliado ? new Date().toISOString() : null}
      WHERE id = ${referenciaId}
        AND cuenta_bancaria_id = ${cuentaId}
      RETURNING
        id,
        conciliado,
        fecha_conciliacion
    `) as Array<{
      id: string;
      conciliado: boolean;
      fecha_conciliacion: string | Date | null;
    }>;

    if (!rows[0]) {
      throw new Error("El movimiento seleccionado no existe para esa cuenta bancaria");
    }

    return {
      referenciaId: rows[0].id,
      referenciaTipo,
      conciliado: rows[0].conciliado,
      fechaConciliacion: rows[0].fecha_conciliacion
        ? parseDateValue(rows[0].fecha_conciliacion).toISOString()
        : undefined,
    };
  }

  const rows = (await sql`
    UPDATE contable_recibos_caja
    SET
      conciliado = ${conciliado},
      fecha_conciliacion = ${conciliado ? new Date().toISOString() : null}
    WHERE id = ${referenciaId}
      AND cuenta_bancaria_id = ${cuentaId}
    RETURNING
      id,
      conciliado,
      fecha_conciliacion
  `) as Array<{
    id: string;
    conciliado: boolean;
    fecha_conciliacion: string | Date | null;
  }>;

  if (!rows[0]) {
    throw new Error("El movimiento seleccionado no existe para esa cuenta bancaria");
  }

  return {
    referenciaId: rows[0].id,
    referenciaTipo,
    conciliado: rows[0].conciliado,
    fechaConciliacion: rows[0].fecha_conciliacion
      ? parseDateValue(rows[0].fecha_conciliacion).toISOString()
      : undefined,
  };
}

function readCollectionFilters(urlValue?: string): ContableCuentasBancariasFilters {
  const searchParams = getSearchParams(urlValue);
  const q = readString(searchParams.get("q"));
  const activa = parseBooleanParam(searchParams.get("activa"));

  return {
    ...(q ? { q } : {}),
    ...(activa !== undefined ? { activa } : {}),
  };
}

function readMovimientosFilters(
  urlValue?: string
): ContableCuentaBancariaMovimientosFilters {
  const searchParams = getSearchParams(urlValue);
  const fechaDesde = parseDateOnlyInput(readString(searchParams.get("fechaDesde")));
  const fechaHasta = parseDateOnlyInput(readString(searchParams.get("fechaHasta")));

  if (fechaDesde && fechaHasta && fechaDesde > fechaHasta) {
    throw new Error("La fecha desde no puede ser mayor a la fecha hasta");
  }

  return {
    ...(fechaDesde ? { fechaDesde } : {}),
    ...(fechaHasta ? { fechaHasta } : {}),
  };
}

function shouldListMovimientos(urlValue?: string) {
  return getSearchParams(urlValue).get("resource") === "movimientos";
}

function shouldHandleConciliacion(urlValue?: string) {
  return getSearchParams(urlValue).get("resource") === "conciliacion";
}

export function getContableCuentaBancariaIdFromRequestUrl(urlValue?: string) {
  const match = getPathname(urlValue).match(/^\/api\/contable\/bancos\/([^/]+)\/?$/);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

export async function handleContableBancosCollection(
  req: NodeRequest,
  res: ServerResponse
) {
  try {
    if (req.method === "GET") {
      const cuentas = await listCuentasBancarias(readCollectionFilters(req.url));
      sendJson(res, 200, cuentas);
      return;
    }

    if (req.method === "POST") {
      const payload = await readJsonBody(req);
      const cuenta = await insertCuentaBancaria(payload);
      sendJson(res, 201, cuenta);
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
      getErrorMessage(normalizedError, "No se pudo procesar la cuenta bancaria")
    );
  }
}

export async function handleContableBancoItem(
  req: NodeRequest,
  res: ServerResponse,
  id: string
) {
  try {
    if (req.method === "GET") {
      if (shouldHandleConciliacion(req.url)) {
        const movimientos = await listMovimientosCuentaBancaria(
          id,
          readMovimientosFilters(req.url)
        );

        if (!movimientos) {
          sendErrorJson(
            res,
            404,
            "Cuenta bancaria no encontrada",
            `No existe una cuenta bancaria con id ${id}`
          );
          return;
        }

        sendJson(res, 200, buildConciliacionBancariaRecord(movimientos));
        return;
      }

      if (shouldListMovimientos(req.url)) {
        const movimientos = await listMovimientosCuentaBancaria(
          id,
          readMovimientosFilters(req.url)
        );

        if (!movimientos) {
          sendErrorJson(
            res,
            404,
            "Cuenta bancaria no encontrada",
            `No existe una cuenta bancaria con id ${id}`
          );
          return;
        }

        sendJson(res, 200, movimientos);
        return;
      }

      const cuenta = await findContableCuentaBancariaById(id);

      if (!cuenta) {
        sendErrorJson(
          res,
          404,
          "Cuenta bancaria no encontrada",
          `No existe una cuenta bancaria con id ${id}`
        );
        return;
      }

      sendJson(res, 200, cuenta);
      return;
    }

    if (req.method === "PUT") {
      if (shouldHandleConciliacion(req.url)) {
        const payload = await readJsonBody(req);
        const result = await updateMovimientoConciliacion(id, payload);
        sendJson(res, 200, result);
        return;
      }

      const payload = await readJsonBody(req);
      const cuenta = await updateCuentaBancaria(id, payload);

      if (!cuenta) {
        sendErrorJson(
          res,
          404,
          "Cuenta bancaria no encontrada",
          `No existe una cuenta bancaria con id ${id}`
        );
        return;
      }

      sendJson(res, 200, cuenta);
      return;
    }

    sendMethodNotAllowed(res, ["GET", "PUT"]);
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
      getErrorMessage(normalizedError, "No se pudo procesar la cuenta bancaria")
    );
  }
}

export function createContableBancosDevMiddleware() {
  return (req: NodeRequest, res: ServerResponse, next: ConnectNext) => {
    const pathname = getPathname(req.url);

    if (pathname === "/api/contable/bancos" || pathname === "/api/contable/bancos/") {
      void handleContableBancosCollection(req, res).catch(next);
      return;
    }

    const cuentaId = getContableCuentaBancariaIdFromRequestUrl(req.url);

    if (cuentaId) {
      void handleContableBancoItem(req, res, cuentaId).catch(next);
      return;
    }

    next();
  };
}
