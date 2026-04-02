import type { IncomingMessage, ServerResponse } from "node:http";
import { nanoid } from "nanoid";
import {
  ContableNominaPeriodoEstado,
  ContableNominaPeriodoTipo,
  ContableNominaTipoContrato,
  ContableTerceroEstado,
  ContableTerceroTipo,
  type ContableNominaEmpleado,
  type ContableNominaLiquidacion,
  type ContableNominaPeriodo,
  type ContableNominaSeguridadSocial,
} from "../client/src/lib/types.js";
import { getSql } from "./neon.js";

type NodeRequest = IncomingMessage & {
  body?: unknown;
};

type ConnectNext = (error?: unknown) => void;

type ContableNominaEmpleadoApiRecord = Omit<
  ContableNominaEmpleado,
  "fechaIngreso" | "createdAt" | "updatedAt"
> & {
  fechaIngreso: string;
  createdAt: string;
  updatedAt: string;
};

type ContableNominaPeriodoApiRecord = Omit<
  ContableNominaPeriodo,
  "fechaInicio" | "fechaFin" | "createdAt" | "updatedAt"
> & {
  fechaInicio: string;
  fechaFin: string;
  createdAt: string;
  updatedAt: string;
};

type ContableNominaLiquidacionApiRecord = Omit<
  ContableNominaLiquidacion,
  "createdAt" | "updatedAt"
> & {
  createdAt: string;
  updatedAt: string;
};

type ContableNominaSeguridadSocialApiRecord = Omit<
  ContableNominaSeguridadSocial,
  "createdAt" | "updatedAt"
> & {
  createdAt: string;
  updatedAt: string;
};

type ContableNominaDataApiRecord = {
  empleados: ContableNominaEmpleadoApiRecord[];
  periodos: ContableNominaPeriodoApiRecord[];
  liquidaciones: ContableNominaLiquidacionApiRecord[];
  seguridadSocial: ContableNominaSeguridadSocialApiRecord[];
};

type NominaEmpleadoRow = {
  id: string;
  tercero_id: string;
  nombre_razon_social: string;
  documento_nit: string;
  contacto: string | null;
  telefono: string | null;
  correo: string | null;
  ciudad: string | null;
  direccion: string | null;
  estado: ContableTerceroEstado;
  tipo_contrato: ContableNominaTipoContrato;
  cargo: string;
  fecha_ingreso: string | Date;
  salario_basico: number | string;
  auxilio_transporte: number | string;
  aplica_auxilio_transporte: boolean;
  eps: string | null;
  fondo_pension: string | null;
  arl: string | null;
  caja_compensacion: string | null;
  porcentaje_arl: number | string;
  created_at: string | Date;
  updated_at: string | Date;
};

type NominaPeriodoRow = {
  id: string;
  codigo_periodo: string;
  tipo: ContableNominaPeriodoTipo;
  fecha_inicio: string | Date;
  fecha_fin: string | Date;
  estado: ContableNominaPeriodoEstado;
  observaciones: string | null;
  created_at: string | Date;
  updated_at: string | Date;
};

type NominaLiquidacionRow = {
  id: string;
  periodo_id: string;
  periodo_codigo: string;
  empleado_id: string;
  tercero_id: string;
  empleado_nombre_razon_social: string;
  empleado_documento_nit: string;
  dias_trabajados: number | string;
  salario_basico_mensual: number | string;
  salario_devengado: number | string;
  auxilio_transporte: number | string;
  devengado: number | string;
  deduccion_salud: number | string;
  deduccion_pension: number | string;
  neto_pagar: number | string;
  ibc_seguridad_social: number | string;
  created_at: string | Date;
  updated_at: string | Date;
};

type NominaSeguridadSocialRow = {
  id: string;
  liquidacion_id: string;
  periodo_id: string;
  periodo_codigo: string;
  empleado_id: string;
  empleado_nombre_razon_social: string;
  ibc: number | string;
  salud_empleado: number | string;
  salud_empresa: number | string;
  pension_empleado: number | string;
  pension_empresa: number | string;
  arl: number | string;
  caja_compensacion: number | string;
  total_aportes: number | string;
  created_at: string | Date;
  updated_at: string | Date;
};

type BuiltNominaEmpleado = {
  id: string;
  terceroId: string;
  nombreRazonSocial: string;
  documentoNit: string;
  contacto?: string;
  telefono?: string;
  correo?: string;
  ciudad?: string;
  direccion?: string;
  estado: ContableTerceroEstado;
  tipoContrato: ContableNominaTipoContrato;
  cargo: string;
  fechaIngreso: string;
  salarioBasico: number;
  auxilioTransporte: number;
  aplicaAuxilioTransporte: boolean;
  eps?: string;
  fondoPension?: string;
  arl?: string;
  cajaCompensacion?: string;
  porcentajeArl: number;
};

type BuiltNominaPeriodo = {
  id: string;
  codigoPeriodo: string;
  tipo: ContableNominaPeriodoTipo;
  fechaInicio: string;
  fechaFin: string;
  estado: ContableNominaPeriodoEstado;
  observaciones?: string;
};

type BuiltNominaLiquidacion = {
  id: string;
  periodoId: string;
  empleadoId: string;
  diasTrabajados: number;
  salarioBasicoMensual: number;
  salarioDevengado: number;
  auxilioTransporte: number;
  devengado: number;
  deduccionSalud: number;
  deduccionPension: number;
  netoPagar: number;
  ibcSeguridadSocial: number;
};

type BuiltNominaSeguridadSocial = {
  id: string;
  liquidacionId: string;
  periodoId: string;
  empleadoId: string;
  ibc: number;
  saludEmpleado: number;
  saludEmpresa: number;
  pensionEmpleado: number;
  pensionEmpresa: number;
  arl: number;
  cajaCompensacion: number;
  totalAportes: number;
};

const NOMINA_TIPO_CONTRATO = new Set<ContableNominaTipoContrato>([
  ContableNominaTipoContrato.INDEFINIDO,
  ContableNominaTipoContrato.FIJO,
  ContableNominaTipoContrato.OTRO,
]);

const NOMINA_TIPO_PERIODO = new Set<ContableNominaPeriodoTipo>([
  ContableNominaPeriodoTipo.MENSUAL,
  ContableNominaPeriodoTipo.QUINCENAL,
]);

const NOMINA_ESTADO_PERIODO = new Set<ContableNominaPeriodoEstado>([
  ContableNominaPeriodoEstado.ABIERTO,
  ContableNominaPeriodoEstado.CERRADO,
]);

const TERCERO_ESTADOS = new Set<ContableTerceroEstado>([
  ContableTerceroEstado.ACTIVO,
  ContableTerceroEstado.INACTIVO,
]);

const NOMINA_RESOURCES = new Set(["empleados", "periodos", "liquidaciones"]);

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

function readOptionalString(value: unknown) {
  if (value === undefined || value === null) {
    return undefined;
  }

  return readString(value);
}

function readNumber(value: unknown, fallback = NaN) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readBoolean(value: unknown, fallback = false) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();

    if (["true", "1", "si", "sí"].includes(normalized)) {
      return true;
    }

    if (["false", "0", "no"].includes(normalized)) {
      return false;
    }
  }

  return fallback;
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
    /empleado|periodo|liquidacion|seguridad|fecha|salario|auxilio|dias|correo|documento|cargo|contrato|solicitud/i.test(
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
    /idx_contable_terceros_documento_nit_unique|duplicate key value/i.test(
      error.message
    )
  ) {
    return new Error("Ya existe un empleado con ese documento");
  }

  if (
    error instanceof Error &&
    /contable_nomina_periodos_codigo_periodo_key|duplicate key value/i.test(
      error.message
    )
  ) {
    return new Error("Ya existe un periodo de nomina con ese codigo");
  }

  if (
    error instanceof Error &&
    /contable_nomina_liquidaciones_periodo_empleado_unique|duplicate key value/i.test(
      error.message
    )
  ) {
    return new Error("Ya existe una liquidacion para ese empleado en ese periodo");
  }

  return error;
}

function validateEmail(correo: string | undefined) {
  if (!correo) {
    return;
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
    throw new Error("El correo ingresado no es valido");
  }
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

function parseDateTimeOutput(value: string | Date) {
  const parsed = value instanceof Date ? new Date(value) : new Date(value);

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

function getResource(urlValue?: string) {
  return readString(getSearchParams(urlValue).get("resource"));
}

function mapNominaEmpleadoRow(row: NominaEmpleadoRow): ContableNominaEmpleadoApiRecord {
  return {
    id: row.id,
    terceroId: row.tercero_id,
    nombreRazonSocial: row.nombre_razon_social,
    documentoNit: row.documento_nit,
    contacto: row.contacto ?? undefined,
    telefono: row.telefono ?? undefined,
    correo: row.correo ?? undefined,
    ciudad: row.ciudad ?? undefined,
    direccion: row.direccion ?? undefined,
    estado: row.estado,
    tipoContrato: row.tipo_contrato,
    cargo: row.cargo,
    fechaIngreso: parseDateOnlyOutput(row.fecha_ingreso).toISOString().slice(0, 10),
    salarioBasico: Number(row.salario_basico),
    auxilioTransporte: Number(row.auxilio_transporte),
    aplicaAuxilioTransporte: row.aplica_auxilio_transporte,
    eps: row.eps ?? undefined,
    fondoPension: row.fondo_pension ?? undefined,
    arl: row.arl ?? undefined,
    cajaCompensacion: row.caja_compensacion ?? undefined,
    porcentajeArl: Number(row.porcentaje_arl),
    createdAt: parseDateTimeOutput(row.created_at).toISOString(),
    updatedAt: parseDateTimeOutput(row.updated_at).toISOString(),
  };
}

function mapNominaPeriodoRow(row: NominaPeriodoRow): ContableNominaPeriodoApiRecord {
  return {
    id: row.id,
    codigoPeriodo: row.codigo_periodo,
    tipo: row.tipo,
    fechaInicio: parseDateOnlyOutput(row.fecha_inicio).toISOString().slice(0, 10),
    fechaFin: parseDateOnlyOutput(row.fecha_fin).toISOString().slice(0, 10),
    estado: row.estado,
    observaciones: row.observaciones ?? undefined,
    createdAt: parseDateTimeOutput(row.created_at).toISOString(),
    updatedAt: parseDateTimeOutput(row.updated_at).toISOString(),
  };
}

function mapNominaLiquidacionRow(
  row: NominaLiquidacionRow
): ContableNominaLiquidacionApiRecord {
  return {
    id: row.id,
    periodoId: row.periodo_id,
    periodoCodigo: row.periodo_codigo,
    empleadoId: row.empleado_id,
    terceroId: row.tercero_id,
    empleadoNombreRazonSocial: row.empleado_nombre_razon_social,
    empleadoDocumentoNit: row.empleado_documento_nit,
    diasTrabajados: Number(row.dias_trabajados),
    salarioBasicoMensual: Number(row.salario_basico_mensual),
    salarioDevengado: Number(row.salario_devengado),
    auxilioTransporte: Number(row.auxilio_transporte),
    devengado: Number(row.devengado),
    deduccionSalud: Number(row.deduccion_salud),
    deduccionPension: Number(row.deduccion_pension),
    netoPagar: Number(row.neto_pagar),
    ibcSeguridadSocial: Number(row.ibc_seguridad_social),
    createdAt: parseDateTimeOutput(row.created_at).toISOString(),
    updatedAt: parseDateTimeOutput(row.updated_at).toISOString(),
  };
}

function mapNominaSeguridadSocialRow(
  row: NominaSeguridadSocialRow
): ContableNominaSeguridadSocialApiRecord {
  return {
    id: row.id,
    liquidacionId: row.liquidacion_id,
    periodoId: row.periodo_id,
    periodoCodigo: row.periodo_codigo,
    empleadoId: row.empleado_id,
    empleadoNombreRazonSocial: row.empleado_nombre_razon_social,
    ibc: Number(row.ibc),
    saludEmpleado: Number(row.salud_empleado),
    saludEmpresa: Number(row.salud_empresa),
    pensionEmpleado: Number(row.pension_empleado),
    pensionEmpresa: Number(row.pension_empresa),
    arl: Number(row.arl),
    cajaCompensacion: Number(row.caja_compensacion),
    totalAportes: Number(row.total_aportes),
    createdAt: parseDateTimeOutput(row.created_at).toISOString(),
    updatedAt: parseDateTimeOutput(row.updated_at).toISOString(),
  };
}

function buildNominaEmpleado(payload: unknown) {
  assertPayload(payload);

  const nombreRazonSocial = readString(payload.nombreRazonSocial) ?? "";
  const documentoNit = readString(payload.documentoNit) ?? "";
  const contacto = readOptionalString(payload.contacto);
  const telefono = readOptionalString(payload.telefono);
  const correo = readOptionalString(payload.correo);
  const ciudad = readOptionalString(payload.ciudad);
  const direccion = readOptionalString(payload.direccion);
  const estado = (readString(payload.estado) ??
    ContableTerceroEstado.ACTIVO) as ContableTerceroEstado;
  const tipoContrato = (readString(payload.tipoContrato) ??
    ContableNominaTipoContrato.INDEFINIDO) as ContableNominaTipoContrato;
  const cargo = readString(payload.cargo) ?? "";
  const fechaIngreso = parseDateOnlyInput(payload.fechaIngreso as string | Date | undefined);
  const salarioBasico = roundMoney(readNumber(payload.salarioBasico));
  const auxilioTransporte = roundMoney(readNumber(payload.auxilioTransporte, 0));
  const aplicaAuxilioTransporte = readBoolean(
    payload.aplicaAuxilioTransporte,
    true
  );
  const eps = readOptionalString(payload.eps);
  const fondoPension = readOptionalString(payload.fondoPension);
  const arl = readOptionalString(payload.arl);
  const cajaCompensacion = readOptionalString(payload.cajaCompensacion);
  const porcentajeArl = readNumber(payload.porcentajeArl, 0.00522);

  if (!nombreRazonSocial) {
    throw new Error("El nombre del empleado es obligatorio");
  }

  if (!documentoNit) {
    throw new Error("El documento del empleado es obligatorio");
  }

  if (!TERCERO_ESTADOS.has(estado)) {
    throw new Error("El estado del empleado es invalido");
  }

  if (!NOMINA_TIPO_CONTRATO.has(tipoContrato)) {
    throw new Error("El tipo de contrato es invalido");
  }

  if (!cargo) {
    throw new Error("El cargo del empleado es obligatorio");
  }

  if (!fechaIngreso) {
    throw new Error("La fecha de ingreso es obligatoria");
  }

  if (!Number.isFinite(salarioBasico) || salarioBasico <= 0) {
    throw new Error("El salario basico debe ser mayor a cero");
  }

  if (!Number.isFinite(auxilioTransporte) || auxilioTransporte < 0) {
    throw new Error("El auxilio de transporte es invalido");
  }

  if (!Number.isFinite(porcentajeArl) || porcentajeArl < 0 || porcentajeArl > 1) {
    throw new Error("El porcentaje de ARL es invalido");
  }

  validateEmail(correo);

  return {
    id: nanoid(),
    terceroId: nanoid(),
    nombreRazonSocial,
    documentoNit,
    contacto,
    telefono,
    correo,
    ciudad,
    direccion,
    estado,
    tipoContrato,
    cargo,
    fechaIngreso,
    salarioBasico,
    auxilioTransporte,
    aplicaAuxilioTransporte,
    eps,
    fondoPension,
    arl,
    cajaCompensacion,
    porcentajeArl,
  } satisfies BuiltNominaEmpleado;
}

function buildNominaPeriodo(payload: unknown) {
  assertPayload(payload);

  const codigoPeriodo = readString(payload.codigoPeriodo) ?? "";
  const tipo = (readString(payload.tipo) ??
    ContableNominaPeriodoTipo.MENSUAL) as ContableNominaPeriodoTipo;
  const fechaInicio = parseDateOnlyInput(payload.fechaInicio as string | Date | undefined);
  const fechaFin = parseDateOnlyInput(payload.fechaFin as string | Date | undefined);
  const estado = (readString(payload.estado) ??
    ContableNominaPeriodoEstado.ABIERTO) as ContableNominaPeriodoEstado;
  const observaciones = readOptionalString(payload.observaciones);

  if (!codigoPeriodo) {
    throw new Error("El codigo del periodo es obligatorio");
  }

  if (!NOMINA_TIPO_PERIODO.has(tipo)) {
    throw new Error("El tipo de periodo es invalido");
  }

  if (!fechaInicio) {
    throw new Error("La fecha inicial del periodo es obligatoria");
  }

  if (!fechaFin) {
    throw new Error("La fecha final del periodo es obligatoria");
  }

  if (fechaInicio > fechaFin) {
    throw new Error("La fecha inicial no puede ser mayor que la final");
  }

  if (!NOMINA_ESTADO_PERIODO.has(estado)) {
    throw new Error("El estado del periodo es invalido");
  }

  return {
    id: nanoid(),
    codigoPeriodo,
    tipo,
    fechaInicio,
    fechaFin,
    estado,
    observaciones,
  } satisfies BuiltNominaPeriodo;
}

function getMaxDaysForPeriodo(tipo: ContableNominaPeriodoTipo) {
  return tipo === ContableNominaPeriodoTipo.QUINCENAL ? 15 : 30;
}

function buildNominaLiquidacion(
  payload: unknown,
  empleado: ContableNominaEmpleadoApiRecord,
  periodo: ContableNominaPeriodoApiRecord
) {
  assertPayload(payload);

  const diasTrabajados = readNumber(payload.diasTrabajados);

  if (!Number.isInteger(diasTrabajados) || diasTrabajados <= 0) {
    throw new Error("Los dias trabajados deben ser un numero entero mayor a cero");
  }

  const maxDays = getMaxDaysForPeriodo(periodo.tipo);

  if (diasTrabajados > maxDays) {
    throw new Error(
      `Los dias trabajados no pueden superar ${maxDays} para el periodo seleccionado`
    );
  }

  if (periodo.estado !== ContableNominaPeriodoEstado.ABIERTO) {
    throw new Error("Solo puedes liquidar periodos de nomina abiertos");
  }

  if (empleado.estado !== ContableTerceroEstado.ACTIVO) {
    throw new Error("Solo puedes liquidar empleados activos");
  }

  const salarioBasicoMensual = empleado.salarioBasico;
  const salarioDevengado = roundMoney((salarioBasicoMensual / 30) * diasTrabajados);
  const auxilioTransporte = empleado.aplicaAuxilioTransporte
    ? roundMoney((empleado.auxilioTransporte / 30) * diasTrabajados)
    : 0;
  const ibcSeguridadSocial = salarioDevengado;
  const deduccionSalud = roundMoney(ibcSeguridadSocial * 0.04);
  const deduccionPension = roundMoney(ibcSeguridadSocial * 0.04);
  const devengado = roundMoney(salarioDevengado + auxilioTransporte);
  const netoPagar = roundMoney(devengado - deduccionSalud - deduccionPension);

  return {
    id: nanoid(),
    periodoId: periodo.id,
    empleadoId: empleado.id,
    diasTrabajados,
    salarioBasicoMensual,
    salarioDevengado,
    auxilioTransporte,
    devengado,
    deduccionSalud,
    deduccionPension,
    netoPagar,
    ibcSeguridadSocial,
  } satisfies BuiltNominaLiquidacion;
}

function buildNominaSeguridadSocial(
  liquidacion: BuiltNominaLiquidacion,
  empleado: ContableNominaEmpleadoApiRecord
) {
  const saludEmpleado = roundMoney(liquidacion.ibcSeguridadSocial * 0.04);
  const saludEmpresa = roundMoney(liquidacion.ibcSeguridadSocial * 0.085);
  const pensionEmpleado = roundMoney(liquidacion.ibcSeguridadSocial * 0.04);
  const pensionEmpresa = roundMoney(liquidacion.ibcSeguridadSocial * 0.12);
  const arl = roundMoney(liquidacion.ibcSeguridadSocial * empleado.porcentajeArl);
  const cajaCompensacion = roundMoney(liquidacion.ibcSeguridadSocial * 0.04);

  return {
    id: nanoid(),
    liquidacionId: liquidacion.id,
    periodoId: liquidacion.periodoId,
    empleadoId: liquidacion.empleadoId,
    ibc: liquidacion.ibcSeguridadSocial,
    saludEmpleado,
    saludEmpresa,
    pensionEmpleado,
    pensionEmpresa,
    arl,
    cajaCompensacion,
    totalAportes: roundMoney(
      saludEmpleado +
        saludEmpresa +
        pensionEmpleado +
        pensionEmpresa +
        arl +
        cajaCompensacion
    ),
  } satisfies BuiltNominaSeguridadSocial;
}

async function listNominaEmpleados() {
  const sql = getSql();
  const rows = (await sql`
    SELECT
      ne.id,
      ne.tercero_id,
      t.nombre_razon_social,
      t.documento_nit,
      t.contacto,
      t.telefono,
      t.correo,
      t.ciudad,
      t.direccion,
      t.estado,
      ne.tipo_contrato,
      ne.cargo,
      ne.fecha_ingreso,
      ne.salario_basico,
      ne.auxilio_transporte,
      ne.aplica_auxilio_transporte,
      ne.eps,
      ne.fondo_pension,
      ne.arl,
      ne.caja_compensacion,
      ne.porcentaje_arl,
      ne.created_at,
      ne.updated_at
    FROM contable_nomina_empleados ne
    INNER JOIN contable_terceros t ON t.id = ne.tercero_id
    ORDER BY t.nombre_razon_social ASC
  `) as NominaEmpleadoRow[];

  return rows.map(mapNominaEmpleadoRow);
}

async function listNominaPeriodos() {
  const sql = getSql();
  const rows = (await sql`
    SELECT
      id,
      codigo_periodo,
      tipo,
      fecha_inicio,
      fecha_fin,
      estado,
      observaciones,
      created_at,
      updated_at
    FROM contable_nomina_periodos
    ORDER BY fecha_inicio DESC, created_at DESC
  `) as NominaPeriodoRow[];

  return rows.map(mapNominaPeriodoRow);
}

async function listNominaLiquidaciones() {
  const sql = getSql();
  const rows = (await sql`
    SELECT
      l.id,
      l.periodo_id,
      p.codigo_periodo AS periodo_codigo,
      l.empleado_id,
      ne.tercero_id,
      t.nombre_razon_social AS empleado_nombre_razon_social,
      t.documento_nit AS empleado_documento_nit,
      l.dias_trabajados,
      l.salario_basico_mensual,
      l.salario_devengado,
      l.auxilio_transporte,
      l.devengado,
      l.deduccion_salud,
      l.deduccion_pension,
      l.neto_pagar,
      l.ibc_seguridad_social,
      l.created_at,
      l.updated_at
    FROM contable_nomina_liquidaciones l
    INNER JOIN contable_nomina_periodos p ON p.id = l.periodo_id
    INNER JOIN contable_nomina_empleados ne ON ne.id = l.empleado_id
    INNER JOIN contable_terceros t ON t.id = ne.tercero_id
    ORDER BY l.created_at DESC
  `) as NominaLiquidacionRow[];

  return rows.map(mapNominaLiquidacionRow);
}

async function listNominaSeguridadSocial() {
  const sql = getSql();
  const rows = (await sql`
    SELECT
      s.id,
      s.liquidacion_id,
      s.periodo_id,
      p.codigo_periodo AS periodo_codigo,
      s.empleado_id,
      t.nombre_razon_social AS empleado_nombre_razon_social,
      s.ibc,
      s.salud_empleado,
      s.salud_empresa,
      s.pension_empleado,
      s.pension_empresa,
      s.arl,
      s.caja_compensacion,
      s.total_aportes,
      s.created_at,
      s.updated_at
    FROM contable_nomina_seguridad_social s
    INNER JOIN contable_nomina_periodos p ON p.id = s.periodo_id
    INNER JOIN contable_nomina_empleados ne ON ne.id = s.empleado_id
    INNER JOIN contable_terceros t ON t.id = ne.tercero_id
    ORDER BY s.created_at DESC
  `) as NominaSeguridadSocialRow[];

  return rows.map(mapNominaSeguridadSocialRow);
}

async function getNominaData() {
  const [empleados, periodos, liquidaciones, seguridadSocial] =
    await Promise.all([
      listNominaEmpleados(),
      listNominaPeriodos(),
      listNominaLiquidaciones(),
      listNominaSeguridadSocial(),
    ]);

  return {
    empleados,
    periodos,
    liquidaciones,
    seguridadSocial,
  } satisfies ContableNominaDataApiRecord;
}

async function findNominaEmpleadoById(id: string) {
  const sql = getSql();
  const rows = (await sql`
    SELECT
      ne.id,
      ne.tercero_id,
      t.nombre_razon_social,
      t.documento_nit,
      t.contacto,
      t.telefono,
      t.correo,
      t.ciudad,
      t.direccion,
      t.estado,
      ne.tipo_contrato,
      ne.cargo,
      ne.fecha_ingreso,
      ne.salario_basico,
      ne.auxilio_transporte,
      ne.aplica_auxilio_transporte,
      ne.eps,
      ne.fondo_pension,
      ne.arl,
      ne.caja_compensacion,
      ne.porcentaje_arl,
      ne.created_at,
      ne.updated_at
    FROM contable_nomina_empleados ne
    INNER JOIN contable_terceros t ON t.id = ne.tercero_id
    WHERE ne.id = ${id}
    LIMIT 1
  `) as NominaEmpleadoRow[];

  return rows[0] ? mapNominaEmpleadoRow(rows[0]) : null;
}

async function findNominaPeriodoById(id: string) {
  const sql = getSql();
  const rows = (await sql`
    SELECT
      id,
      codigo_periodo,
      tipo,
      fecha_inicio,
      fecha_fin,
      estado,
      observaciones,
      created_at,
      updated_at
    FROM contable_nomina_periodos
    WHERE id = ${id}
    LIMIT 1
  `) as NominaPeriodoRow[];

  return rows[0] ? mapNominaPeriodoRow(rows[0]) : null;
}

async function insertNominaEmpleado(payload: unknown) {
  const empleado = buildNominaEmpleado(payload);
  const sql = getSql();

  try {
    await sql.transaction(txn => [
      txn`
        INSERT INTO contable_terceros (
          id,
          tipo_tercero,
          nombre_razon_social,
          documento_nit,
          contacto,
          telefono,
          correo,
          ciudad,
          direccion,
          observaciones,
          estado,
          created_at,
          updated_at
        ) VALUES (
          ${empleado.terceroId},
          ${ContableTerceroTipo.EMPLEADO},
          ${empleado.nombreRazonSocial},
          ${empleado.documentoNit},
          ${empleado.contacto ?? null},
          ${empleado.telefono ?? null},
          ${empleado.correo ?? null},
          ${empleado.ciudad ?? null},
          ${empleado.direccion ?? null},
          ${null},
          ${empleado.estado},
          NOW(),
          NOW()
        )
      `,
      txn`
        INSERT INTO contable_nomina_empleados (
          id,
          tercero_id,
          tipo_contrato,
          cargo,
          fecha_ingreso,
          salario_basico,
          auxilio_transporte,
          aplica_auxilio_transporte,
          eps,
          fondo_pension,
          arl,
          caja_compensacion,
          porcentaje_arl,
          created_at,
          updated_at
        ) VALUES (
          ${empleado.id},
          ${empleado.terceroId},
          ${empleado.tipoContrato},
          ${empleado.cargo},
          ${empleado.fechaIngreso},
          ${empleado.salarioBasico},
          ${empleado.auxilioTransporte},
          ${empleado.aplicaAuxilioTransporte},
          ${empleado.eps ?? null},
          ${empleado.fondoPension ?? null},
          ${empleado.arl ?? null},
          ${empleado.cajaCompensacion ?? null},
          ${empleado.porcentajeArl},
          NOW(),
          NOW()
        )
      `,
    ]);

    const created = await findNominaEmpleadoById(empleado.id);

    if (!created) {
      throw new Error("No se pudo recuperar el empleado creado");
    }

    return created;
  } catch (error) {
    throw normalizeDatabaseError(error);
  }
}

async function insertNominaPeriodo(payload: unknown) {
  const periodo = buildNominaPeriodo(payload);
  const sql = getSql();

  try {
    const rows = (await sql`
      INSERT INTO contable_nomina_periodos (
        id,
        codigo_periodo,
        tipo,
        fecha_inicio,
        fecha_fin,
        estado,
        observaciones,
        created_at,
        updated_at
      ) VALUES (
        ${periodo.id},
        ${periodo.codigoPeriodo},
        ${periodo.tipo},
        ${periodo.fechaInicio},
        ${periodo.fechaFin},
        ${periodo.estado},
        ${periodo.observaciones ?? null},
        NOW(),
        NOW()
      )
      RETURNING
        id,
        codigo_periodo,
        tipo,
        fecha_inicio,
        fecha_fin,
        estado,
        observaciones,
        created_at,
        updated_at
    `) as NominaPeriodoRow[];

    if (!rows[0]) {
      throw new Error("No se pudo recuperar el periodo creado");
    }

    return mapNominaPeriodoRow(rows[0]);
  } catch (error) {
    throw normalizeDatabaseError(error);
  }
}

async function insertNominaLiquidacion(payload: unknown) {
  assertPayload(payload);

  const periodoId = readString(payload.periodoId) ?? "";
  const empleadoId = readString(payload.empleadoId) ?? "";

  if (!periodoId) {
    throw new Error("Debes seleccionar un periodo de nomina");
  }

  if (!empleadoId) {
    throw new Error("Debes seleccionar un empleado");
  }

  const [empleado, periodo] = await Promise.all([
    findNominaEmpleadoById(empleadoId),
    findNominaPeriodoById(periodoId),
  ]);

  if (!empleado) {
    throw new Error("El empleado seleccionado no existe");
  }

  if (!periodo) {
    throw new Error("El periodo seleccionado no existe");
  }

  const liquidacion = buildNominaLiquidacion(payload, empleado, periodo);
  const seguridadSocial = buildNominaSeguridadSocial(liquidacion, empleado);
  const sql = getSql();

  try {
    await sql.transaction(txn => [
      txn`
        INSERT INTO contable_nomina_liquidaciones (
          id,
          periodo_id,
          empleado_id,
          dias_trabajados,
          salario_basico_mensual,
          salario_devengado,
          auxilio_transporte,
          devengado,
          deduccion_salud,
          deduccion_pension,
          neto_pagar,
          ibc_seguridad_social,
          created_at,
          updated_at
        ) VALUES (
          ${liquidacion.id},
          ${liquidacion.periodoId},
          ${liquidacion.empleadoId},
          ${liquidacion.diasTrabajados},
          ${liquidacion.salarioBasicoMensual},
          ${liquidacion.salarioDevengado},
          ${liquidacion.auxilioTransporte},
          ${liquidacion.devengado},
          ${liquidacion.deduccionSalud},
          ${liquidacion.deduccionPension},
          ${liquidacion.netoPagar},
          ${liquidacion.ibcSeguridadSocial},
          NOW(),
          NOW()
        )
      `,
      txn`
        INSERT INTO contable_nomina_seguridad_social (
          id,
          liquidacion_id,
          periodo_id,
          empleado_id,
          ibc,
          salud_empleado,
          salud_empresa,
          pension_empleado,
          pension_empresa,
          arl,
          caja_compensacion,
          total_aportes,
          created_at,
          updated_at
        ) VALUES (
          ${seguridadSocial.id},
          ${seguridadSocial.liquidacionId},
          ${seguridadSocial.periodoId},
          ${seguridadSocial.empleadoId},
          ${seguridadSocial.ibc},
          ${seguridadSocial.saludEmpleado},
          ${seguridadSocial.saludEmpresa},
          ${seguridadSocial.pensionEmpleado},
          ${seguridadSocial.pensionEmpresa},
          ${seguridadSocial.arl},
          ${seguridadSocial.cajaCompensacion},
          ${seguridadSocial.totalAportes},
          NOW(),
          NOW()
        )
      `,
    ]);

    const liquidaciones = await listNominaLiquidaciones();
    const created = liquidaciones.find(item => item.id === liquidacion.id);

    if (!created) {
      throw new Error("No se pudo recuperar la liquidacion creada");
    }

    return created;
  } catch (error) {
    throw normalizeDatabaseError(error);
  }
}

export async function handleContableNominaCollection(
  req: NodeRequest,
  res: ServerResponse
) {
  try {
    if (req.method === "GET") {
      const data = await getNominaData();
      sendJson(res, 200, data);
      return;
    }

    if (req.method === "POST") {
      const resource = getResource(req.url);

      if (!resource || !NOMINA_RESOURCES.has(resource)) {
        sendErrorJson(
          res,
          400,
          "Solicitud invalida",
          "Debes indicar un recurso valido: empleados, periodos o liquidaciones"
        );
        return;
      }

      const payload = await readJsonBody(req);

      if (resource === "empleados") {
        const empleado = await insertNominaEmpleado(payload);
        sendJson(res, 201, empleado);
        return;
      }

      if (resource === "periodos") {
        const periodo = await insertNominaPeriodo(payload);
        sendJson(res, 201, periodo);
        return;
      }

      if (resource === "liquidaciones") {
        const liquidacion = await insertNominaLiquidacion(payload);
        sendJson(res, 201, liquidacion);
        return;
      }
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
      "No se pudo procesar la solicitud de nomina"
    );

    sendErrorJson(
      res,
      statusCode,
      statusCode === 409
        ? "Conflicto al guardar informacion de nomina"
        : statusCode === 400
          ? "Solicitud invalida"
          : "Error interno",
      detail
    );
  }
}

export function createContableNominaDevMiddleware() {
  return (req: NodeRequest, res: ServerResponse, next: ConnectNext) => {
    const pathname = getPathname(req.url);

    if (pathname === "/api/contable/nomina" || pathname === "/api/contable/nomina/") {
      void handleContableNominaCollection(req, res).catch(next);
      return;
    }

    next();
  };
}
