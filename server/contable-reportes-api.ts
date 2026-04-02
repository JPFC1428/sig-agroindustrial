import type { IncomingMessage, ServerResponse } from "node:http";
import {
  ContableCarteraEstado,
  ContableFacturaCompraEstado,
  ContableLegalizacionViaticoEstado,
  ContableReciboDocumentoTipo,
  ViaticoTipoGasto,
  type ContableCarteraClienteItem,
  type ContableCarteraProveedorItem,
  type ContableEgreso,
  type ContableFacturaCompra,
  type ContableLegalizacionViatico,
  type ContableReporteEstadoFiltro,
  type ContableReporteMovimientoBancario,
  type ContableReportesData,
  type ContableReciboCaja,
  type VisitaViaticoSoporte,
} from "../client/src/lib/types.js";
import {
  generateContableReportesExcel,
  generateContableReportesPdf,
} from "./contable-reportes-export.js";
import { getSql } from "./neon.js";

type NodeRequest = IncomingMessage & {
  body?: unknown;
};

type ConnectNext = (error?: unknown) => void;

type ReportFilters = {
  estado?: ContableReporteEstadoFiltro;
  fechaDesde?: string;
  fechaHasta?: string;
  tercero?: string;
};

type SerializableContableFacturaCompra = Omit<
  ContableFacturaCompra,
  "createdAt" | "fechaFactura" | "fechaVencimiento" | "updatedAt"
> & {
  createdAt: string;
  fechaFactura: string;
  fechaVencimiento: string;
  updatedAt: string;
};

type SerializableContableEgreso = Omit<
  ContableEgreso,
  "createdAt" | "fecha"
> & {
  createdAt: string;
  fecha: string;
};

type SerializableContableReciboCaja = Omit<
  ContableReciboCaja,
  "createdAt" | "fecha"
> & {
  createdAt: string;
  fecha: string;
};

type SerializableContableCarteraProveedorItem = Omit<
  ContableCarteraProveedorItem,
  "fechaFactura" | "fechaVencimiento"
> & {
  fechaFactura: string;
  fechaVencimiento: string;
};

type SerializableContableCarteraClienteItem = Omit<
  ContableCarteraClienteItem,
  "fechaUltimoMovimiento"
> & {
  fechaUltimoMovimiento: string;
};

type SerializableContableLegalizacionViatico = Omit<
  ContableLegalizacionViatico,
  "fecha" | "legalizacionUpdatedAt" | "visitaFecha"
> & {
  fecha: string;
  legalizacionUpdatedAt?: string;
  visitaFecha: string;
};

type SerializableContableReporteMovimientoBancario = Omit<
  ContableReporteMovimientoBancario,
  "createdAt" | "fecha" | "fechaConciliacion"
> & {
  createdAt: string;
  fecha: string;
  fechaConciliacion?: string;
};

type SerializableContableReportesData = Omit<
  ContableReportesData,
  | "carteraClientes"
  | "carteraProveedores"
  | "egresos"
  | "facturasCompra"
  | "movimientosBancarios"
  | "recibosCaja"
  | "viaticos"
> & {
  carteraClientes: SerializableContableCarteraClienteItem[];
  carteraProveedores: SerializableContableCarteraProveedorItem[];
  egresos: SerializableContableEgreso[];
  facturasCompra: SerializableContableFacturaCompra[];
  movimientosBancarios: SerializableContableReporteMovimientoBancario[];
  recibosCaja: SerializableContableReciboCaja[];
  viaticos: SerializableContableLegalizacionViatico[];
};

type FacturaCompraRow = {
  created_at: string | Date;
  estado: ContableFacturaCompra["estado"];
  fecha_factura: string | Date;
  fecha_vencimiento: string | Date;
  id: string;
  iva: number | string;
  numero_factura: string;
  observaciones: string | null;
  saldo: number | string;
  soporte_url: string | null;
  subtotal: number | string;
  tercero_documento_nit: string;
  tercero_id: string;
  tercero_nombre_razon_social: string;
  total: number | string;
  updated_at: string | Date;
};

type EgresoRow = {
  created_at: string | Date;
  cuenta_bancaria_banco: string | null;
  cuenta_bancaria_id: string | null;
  cuenta_bancaria_nombre: string | null;
  cuenta_bancaria_numero: string | null;
  fecha: string | Date;
  id: string;
  metodo_pago: ContableEgreso["metodoPago"];
  numero_comprobante: string;
  observaciones: string | null;
  soporte_url: string | null;
  tercero_documento_nit: string;
  tercero_id: string;
  tercero_nombre_razon_social: string;
  valor_total: number | string;
};

type ReciboCajaRow = {
  created_at: string | Date;
  cuenta_bancaria_banco: string | null;
  cuenta_bancaria_id: string | null;
  cuenta_bancaria_nombre: string | null;
  cuenta_bancaria_numero: string | null;
  fecha: string | Date;
  id: string;
  metodo_pago: ContableReciboCaja["metodoPago"];
  numero_recibo: string;
  observaciones: string | null;
  soporte_url: string | null;
  tercero_documento_nit: string;
  tercero_id: string;
  tercero_nombre_razon_social: string;
  valor_total: number | string;
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

type ViaticoRow = {
  cliente_empresa: string | null;
  cliente_id: string | null;
  cliente_nombre: string | null;
  contable_egreso_id: string | null;
  descripcion: string;
  fecha: string | Date;
  id: string;
  legalizacion_estado: ContableLegalizacionViaticoEstado;
  legalizacion_observaciones: string | null;
  legalizacion_updated_at: string | Date | null;
  legalizacion_updated_by: string | null;
  legalizacion_updated_by_nombre: string | null;
  observaciones: string | null;
  prospecto_empresa: string | null;
  prospecto_id: string | null;
  prospecto_nombre: string | null;
  soporte_nombre: string | null;
  soporte_tamano: number | string | null;
  soporte_tipo_mime: string | null;
  tipo_gasto: ViaticoTipoGasto;
  usuario_id: string | null;
  usuario_nombre: string | null;
  valor: number | string;
  visita_fecha: string | Date;
  visita_id: string;
  visita_objetivo: string;
  visita_tipo: ContableLegalizacionViatico["visitaTipo"];
};

type MovimientoBancarioRow = {
  conciliado: boolean;
  cuenta_bancaria_banco: string | null;
  cuenta_bancaria_id: string;
  cuenta_bancaria_nombre: string | null;
  cuenta_bancaria_numero: string | null;
  created_at: string | Date;
  fecha: string | Date;
  fecha_conciliacion: string | Date | null;
  id: string;
  metodo_pago: ContableReporteMovimientoBancario["metodoPago"];
  referencia_id: string;
  referencia_numero: string;
  referencia_tipo: ContableReporteMovimientoBancario["referenciaTipo"];
  tercero_documento_nit: string;
  tercero_id: string;
  tercero_nombre_razon_social: string;
  tipo_movimiento: ContableReporteMovimientoBancario["tipo"];
  valor: number | string;
};

const REPORT_STATUS_FILTERS = new Set<ContableReporteEstadoFiltro>([
  "pendiente",
  "parcial",
  "pagado",
  "vencida",
  "anulada",
  "legalizado",
  "aprobado",
  "rechazado",
  "conciliado",
  "no_conciliado",
]);

const LEGALIZACION_ESTADOS = new Set<ContableLegalizacionViaticoEstado>([
  ContableLegalizacionViaticoEstado.PENDIENTE,
  ContableLegalizacionViaticoEstado.LEGALIZADO,
  ContableLegalizacionViaticoEstado.APROBADO,
  ContableLegalizacionViaticoEstado.RECHAZADO,
]);

function setJsonHeaders(res: ServerResponse) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
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

function sendBinary(
  res: ServerResponse,
  contentType: string,
  buffer: Buffer,
  fileName: string
) {
  res.statusCode = 200;
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", contentType);
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${fileName}"; filename*=UTF-8''${encodeURIComponent(
      fileName
    )}`
  );
  res.end(buffer);
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

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function parseDateTimeValue(value: string | Date) {
  const parsed = value instanceof Date ? new Date(value) : new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Fecha invalida en la base de datos");
  }

  return parsed;
}

function parseDateOnlyValue(value: string | Date) {
  const rawValue =
    value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(rawValue)) {
    throw new Error("Fecha invalida en la base de datos");
  }

  return new Date(`${rawValue}T00:00:00`);
}

function formatDateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

function parseDateOnlyInput(value: string | undefined) {
  if (!value) {
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

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function isValidationError(error: unknown) {
  return (
    error instanceof Error &&
    /fecha|filtro|solicitud|export/i.test(error.message)
  );
}

function readFilters(urlValue?: string): ReportFilters {
  const searchParams = getSearchParams(urlValue);
  const estado = readString(searchParams.get("estado"));
  const fechaDesde = parseDateOnlyInput(readString(searchParams.get("fechaDesde")));
  const fechaHasta = parseDateOnlyInput(readString(searchParams.get("fechaHasta")));
  const tercero = readString(searchParams.get("tercero"));

  return {
    ...(estado && REPORT_STATUS_FILTERS.has(estado as ContableReporteEstadoFiltro)
      ? { estado: estado as ContableReporteEstadoFiltro }
      : {}),
    ...(fechaDesde ? { fechaDesde } : {}),
    ...(fechaHasta ? { fechaHasta } : {}),
    ...(tercero ? { tercero } : {}),
  };
}

function getExportFormat(urlValue?: string) {
  const exportValue = readString(getSearchParams(urlValue).get("export"));
  if (exportValue === "excel" || exportValue === "pdf") {
    return exportValue;
  }

  return undefined;
}

function toFacturaEstadoFilter(
  estado?: ContableReporteEstadoFiltro
): ContableFacturaCompraEstado | undefined {
  switch (estado) {
    case "pendiente":
      return ContableFacturaCompraEstado.PENDIENTE;
    case "parcial":
      return ContableFacturaCompraEstado.PARCIAL;
    case "pagado":
      return ContableFacturaCompraEstado.PAGADA;
    case "vencida":
      return ContableFacturaCompraEstado.VENCIDA;
    case "anulada":
      return ContableFacturaCompraEstado.ANULADA;
    default:
      return undefined;
  }
}

function toConciliadoFilter(estado?: ContableReporteEstadoFiltro) {
  if (estado === "conciliado") {
    return true;
  }

  if (estado === "no_conciliado") {
    return false;
  }

  return undefined;
}

function mapFacturaRow(row: FacturaCompraRow): ContableFacturaCompra {
  return {
    createdAt: parseDateTimeValue(row.created_at),
    estado: row.estado,
    fechaFactura: parseDateOnlyValue(row.fecha_factura),
    fechaVencimiento: parseDateOnlyValue(row.fecha_vencimiento),
    id: row.id,
    iva: readNumber(row.iva, 0),
    numeroFactura: row.numero_factura,
    observaciones: row.observaciones ?? undefined,
    saldo: readNumber(row.saldo, 0),
    soporteUrl: row.soporte_url ?? undefined,
    subtotal: readNumber(row.subtotal, 0),
    terceroDocumentoNit: row.tercero_documento_nit,
    terceroId: row.tercero_id,
    terceroNombreRazonSocial: row.tercero_nombre_razon_social,
    total: readNumber(row.total, 0),
    updatedAt: parseDateTimeValue(row.updated_at),
  };
}

function mapEgresoRow(row: EgresoRow): ContableEgreso {
  return {
    cuentaBancariaBanco: row.cuenta_bancaria_banco ?? undefined,
    cuentaBancariaId: row.cuenta_bancaria_id ?? undefined,
    cuentaBancariaNombre: row.cuenta_bancaria_nombre ?? undefined,
    cuentaBancariaNumero: row.cuenta_bancaria_numero ?? undefined,
    createdAt: parseDateTimeValue(row.created_at),
    fecha: parseDateOnlyValue(row.fecha),
    id: row.id,
    metodoPago: row.metodo_pago,
    numeroComprobante: row.numero_comprobante,
    observaciones: row.observaciones ?? undefined,
    soporteUrl: row.soporte_url ?? undefined,
    terceroDocumentoNit: row.tercero_documento_nit,
    terceroId: row.tercero_id,
    terceroNombreRazonSocial: row.tercero_nombre_razon_social,
    valorTotal: readNumber(row.valor_total, 0),
  };
}

function mapReciboRow(row: ReciboCajaRow): ContableReciboCaja {
  return {
    cuentaBancariaBanco: row.cuenta_bancaria_banco ?? undefined,
    cuentaBancariaId: row.cuenta_bancaria_id ?? undefined,
    cuentaBancariaNombre: row.cuenta_bancaria_nombre ?? undefined,
    cuentaBancariaNumero: row.cuenta_bancaria_numero ?? undefined,
    createdAt: parseDateTimeValue(row.created_at),
    fecha: parseDateOnlyValue(row.fecha),
    id: row.id,
    metodoPago: row.metodo_pago,
    numeroRecibo: row.numero_recibo,
    observaciones: row.observaciones ?? undefined,
    soporteUrl: row.soporte_url ?? undefined,
    terceroDocumentoNit: row.tercero_documento_nit,
    terceroId: row.tercero_id,
    terceroNombreRazonSocial: row.tercero_nombre_razon_social,
    valorTotal: readNumber(row.valor_total, 0),
  };
}

function mapCarteraProveedorRow(
  row: CarteraProveedorRow
): ContableCarteraProveedorItem {
  return {
    estado: row.estado,
    fechaFactura: parseDateOnlyValue(row.fecha_factura),
    fechaVencimiento: parseDateOnlyValue(row.fecha_vencimiento),
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

function mapCarteraClienteRow(
  row: CarteraClienteRow
): ContableCarteraClienteItem {
  return {
    clienteDocumentoNit: row.cliente_documento_nit,
    clienteNombreRazonSocial: row.cliente_nombre_razon_social,
    documentoId: row.documento_id ?? undefined,
    documentoReferencia: row.documento_referencia ?? undefined,
    documentoTipo: row.documento_tipo,
    estado: row.estado,
    fechaUltimoMovimiento: parseDateOnlyValue(row.fecha_ultimo_movimiento),
    id: row.id,
    saldo: readNumber(row.saldo, 0),
    terceroId: row.tercero_id,
    total: readNumber(row.total, 0),
    valorRecibido: readNumber(row.valor_recibido, 0),
  };
}

function mapViaticoRow(row: ViaticoRow): ContableLegalizacionViatico {
  return {
    contableEgresoId: row.contable_egreso_id ?? undefined,
    descripcion: row.descripcion,
    fecha: parseDateTimeValue(row.fecha),
    id: row.id,
    legalizacionEstado: row.legalizacion_estado,
    legalizacionObservaciones: row.legalizacion_observaciones ?? undefined,
    legalizacionUpdatedAt: row.legalizacion_updated_at
      ? parseDateTimeValue(row.legalizacion_updated_at)
      : undefined,
    legalizacionUpdatedBy: row.legalizacion_updated_by ?? undefined,
    legalizacionUpdatedByNombre:
      row.legalizacion_updated_by_nombre ?? undefined,
    observaciones: row.observaciones ?? undefined,
    relacionadoEmpresa: row.cliente_empresa ?? row.prospecto_empresa ?? undefined,
    relacionadoId: row.cliente_id ?? row.prospecto_id ?? undefined,
    relacionadoNombre: row.cliente_nombre ?? row.prospecto_nombre ?? undefined,
    soporte:
      row.soporte_nombre && row.soporte_tipo_mime
        ? {
            fileName: row.soporte_nombre,
            fileSize: readNumber(row.soporte_tamano, 0),
            mimeType: row.soporte_tipo_mime as VisitaViaticoSoporte["mimeType"],
          }
        : undefined,
    tipoGasto: row.tipo_gasto,
    usuarioId: row.usuario_id ?? undefined,
    usuarioNombre: row.usuario_nombre ?? undefined,
    valor: readNumber(row.valor, 0),
    visitaFecha: parseDateOnlyValue(row.visita_fecha),
    visitaId: row.visita_id,
    visitaObjetivo: row.visita_objetivo,
    visitaRelacionTipo: row.cliente_id ? "cliente" : row.prospecto_id ? "prospecto" : undefined,
    visitaTipo: row.visita_tipo,
  };
}

function mapMovimientoRow(
  row: MovimientoBancarioRow,
  saldoAcumulado: number
): ContableReporteMovimientoBancario {
  return {
    conciliado: row.conciliado,
    createdAt: parseDateTimeValue(row.created_at),
    cuentaBancariaBanco: row.cuenta_bancaria_banco ?? undefined,
    cuentaBancariaId: row.cuenta_bancaria_id,
    cuentaBancariaNombre: row.cuenta_bancaria_nombre ?? undefined,
    cuentaBancariaNumero: row.cuenta_bancaria_numero ?? undefined,
    fecha: parseDateOnlyValue(row.fecha),
    fechaConciliacion: row.fecha_conciliacion
      ? parseDateTimeValue(row.fecha_conciliacion)
      : undefined,
    id: row.id,
    metodoPago: row.metodo_pago,
    referenciaId: row.referencia_id,
    referenciaNumero: row.referencia_numero,
    referenciaTipo: row.referencia_tipo,
    saldoAcumulado,
    terceroDocumentoNit: row.tercero_documento_nit,
    terceroId: row.tercero_id,
    terceroNombreRazonSocial: row.tercero_nombre_razon_social,
    tipo: row.tipo_movimiento,
    valor: readNumber(row.valor, 0),
  };
}

async function listFacturasCompra(filters: ReportFilters = {}) {
  const sql = getSql();
  const whereClauses: string[] = [];
  const params: unknown[] = [];
  const facturaEstado = toFacturaEstadoFilter(filters.estado);

  if (filters.tercero) {
    params.push(`%${filters.tercero}%`);
    whereClauses.push(`(
      t.nombre_razon_social ILIKE $${params.length}
      OR t.documento_nit ILIKE $${params.length}
      OR f.numero_factura ILIKE $${params.length}
    )`);
  }

  if (filters.fechaDesde) {
    params.push(filters.fechaDesde);
    whereClauses.push(`f.fecha_factura >= $${params.length}`);
  }

  if (filters.fechaHasta) {
    params.push(filters.fechaHasta);
    whereClauses.push(`f.fecha_factura <= $${params.length}`);
  }

  if (facturaEstado) {
    params.push(facturaEstado);
    whereClauses.push(`f.estado = $${params.length}`);
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
    INNER JOIN contable_terceros t
      ON t.id = f.tercero_id
    ${whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : ""}
    ORDER BY f.fecha_factura DESC, f.created_at DESC, f.numero_factura DESC
  `;

  const rows = (await sql.query(query, params)) as FacturaCompraRow[];
  return rows.map(mapFacturaRow);
}

async function listEgresos(filters: ReportFilters = {}) {
  const sql = getSql();
  const whereClauses: string[] = [];
  const params: unknown[] = [];
  const conciliado = toConciliadoFilter(filters.estado);

  if (filters.tercero) {
    params.push(`%${filters.tercero}%`);
    whereClauses.push(`(
      t.nombre_razon_social ILIKE $${params.length}
      OR t.documento_nit ILIKE $${params.length}
      OR e.numero_comprobante ILIKE $${params.length}
    )`);
  }

  if (filters.fechaDesde) {
    params.push(filters.fechaDesde);
    whereClauses.push(`e.fecha >= $${params.length}`);
  }

  if (filters.fechaHasta) {
    params.push(filters.fechaHasta);
    whereClauses.push(`e.fecha <= $${params.length}`);
  }

  if (conciliado !== undefined) {
    params.push(conciliado);
    whereClauses.push(`e.conciliado = $${params.length}`);
  }

  const query = `
    SELECT
      e.id,
      e.numero_comprobante,
      e.tercero_id,
      t.nombre_razon_social AS tercero_nombre_razon_social,
      t.documento_nit AS tercero_documento_nit,
      e.cuenta_bancaria_id,
      cb.nombre_cuenta AS cuenta_bancaria_nombre,
      cb.numero_cuenta AS cuenta_bancaria_numero,
      cb.nombre_banco AS cuenta_bancaria_banco,
      e.fecha,
      e.valor_total,
      e.metodo_pago,
      e.observaciones,
      e.soporte_url,
      e.created_at
    FROM contable_egresos e
    INNER JOIN contable_terceros t
      ON t.id = e.tercero_id
    LEFT JOIN contable_cuentas_bancarias cb
      ON cb.id = e.cuenta_bancaria_id
    ${whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : ""}
    ORDER BY e.fecha DESC, e.created_at DESC, e.numero_comprobante DESC
  `;

  const rows = (await sql.query(query, params)) as EgresoRow[];
  return rows.map(mapEgresoRow);
}

async function listRecibosCaja(filters: ReportFilters = {}) {
  const sql = getSql();
  const whereClauses: string[] = [];
  const params: unknown[] = [];
  const conciliado = toConciliadoFilter(filters.estado);

  if (filters.tercero) {
    params.push(`%${filters.tercero}%`);
    whereClauses.push(`(
      t.nombre_razon_social ILIKE $${params.length}
      OR t.documento_nit ILIKE $${params.length}
      OR r.numero_recibo ILIKE $${params.length}
    )`);
  }

  if (filters.fechaDesde) {
    params.push(filters.fechaDesde);
    whereClauses.push(`r.fecha >= $${params.length}`);
  }

  if (filters.fechaHasta) {
    params.push(filters.fechaHasta);
    whereClauses.push(`r.fecha <= $${params.length}`);
  }

  if (conciliado !== undefined) {
    params.push(conciliado);
    whereClauses.push(`r.conciliado = $${params.length}`);
  }

  const query = `
    SELECT
      r.id,
      r.numero_recibo,
      r.tercero_id,
      t.nombre_razon_social AS tercero_nombre_razon_social,
      t.documento_nit AS tercero_documento_nit,
      r.cuenta_bancaria_id,
      cb.nombre_cuenta AS cuenta_bancaria_nombre,
      cb.numero_cuenta AS cuenta_bancaria_numero,
      cb.nombre_banco AS cuenta_bancaria_banco,
      r.fecha,
      r.valor_total,
      r.metodo_pago,
      r.observaciones,
      r.soporte_url,
      r.created_at
    FROM contable_recibos_caja r
    INNER JOIN contable_terceros t
      ON t.id = r.tercero_id
    LEFT JOIN contable_cuentas_bancarias cb
      ON cb.id = r.cuenta_bancaria_id
    ${whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : ""}
    ORDER BY r.fecha DESC, r.created_at DESC, r.numero_recibo DESC
  `;

  const rows = (await sql.query(query, params)) as ReciboCajaRow[];
  return rows.map(mapReciboRow);
}

async function listCarteraProveedores(filters: ReportFilters = {}) {
  const sql = getSql();
  const whereClauses: string[] = ["f.estado <> 'anulada'"];
  const params: unknown[] = [];

  if (filters.tercero) {
    params.push(`%${filters.tercero}%`);
    whereClauses.push(`(
      f.numero_factura ILIKE $${params.length}
      OR t.nombre_razon_social ILIKE $${params.length}
      OR t.documento_nit ILIKE $${params.length}
    )`);
  }

  if (filters.fechaDesde) {
    params.push(filters.fechaDesde);
    whereClauses.push(`f.fecha_factura >= $${params.length}`);
  }

  if (filters.fechaHasta) {
    params.push(filters.fechaHasta);
    whereClauses.push(`f.fecha_factura <= $${params.length}`);
  }

  if (filters.estado === "vencida") {
    whereClauses.push("(f.fecha_vencimiento < CURRENT_DATE AND f.saldo > 0)");
  } else if (
    filters.estado === "pendiente" ||
    filters.estado === "parcial" ||
    filters.estado === "pagado"
  ) {
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
    INNER JOIN contable_terceros t
      ON t.id = f.tercero_id
    LEFT JOIN contable_egreso_detalle ed
      ON ed.factura_id = f.id
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
  return rows.map(mapCarteraProveedorRow);
}

async function listCarteraClientes(filters: ReportFilters = {}) {
  const sql = getSql();
  const whereClauses: string[] = [];
  const params: unknown[] = [];

  if (filters.tercero) {
    params.push(`%${filters.tercero}%`);
    whereClauses.push(`(
      t.nombre_razon_social ILIKE $${params.length}
      OR t.documento_nit ILIKE $${params.length}
      OR COALESCE(d.documento_referencia, '') ILIKE $${params.length}
      OR COALESCE(d.documento_id, '') ILIKE $${params.length}
    )`);
  }

  if (filters.fechaDesde) {
    params.push(filters.fechaDesde);
    whereClauses.push(`r.fecha >= $${params.length}`);
  }

  if (filters.fechaHasta) {
    params.push(filters.fechaHasta);
    whereClauses.push(`r.fecha <= $${params.length}`);
  }

  if (
    filters.estado === "pendiente" ||
    filters.estado === "parcial" ||
    filters.estado === "pagado"
  ) {
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
      NULLIF(MAX(d.documento_id), '') AS documento_id,
      NULLIF(MAX(d.documento_referencia), '') AS documento_referencia,
      MAX(r.fecha) AS fecha_ultimo_movimiento,
      GREATEST(COALESCE(MAX(d.valor_documento), SUM(d.valor_pagado)), 0) AS total,
      SUM(d.valor_pagado) AS valor_recibido,
      GREATEST(COALESCE(MAX(d.valor_documento), SUM(d.valor_pagado)) - SUM(d.valor_pagado), 0) AS saldo,
      CASE
        WHEN GREATEST(COALESCE(MAX(d.valor_documento), SUM(d.valor_pagado)) - SUM(d.valor_pagado), 0) <= 0 THEN 'pagado'
        WHEN SUM(d.valor_pagado) > 0 THEN 'parcial'
        ELSE 'pendiente'
      END AS estado
    FROM contable_recibos_caja r
    INNER JOIN contable_terceros t
      ON t.id = r.tercero_id
    INNER JOIN contable_recibo_detalle d
      ON d.recibo_id = r.id
    ${whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : ""}
    GROUP BY
      r.tercero_id,
      t.nombre_razon_social,
      t.documento_nit,
      d.documento_tipo,
      COALESCE(d.documento_id, ''),
      COALESCE(d.documento_referencia, '')
    ORDER BY MAX(r.fecha) DESC, t.nombre_razon_social ASC
  `;

  const rows = (await sql.query(query, params)) as CarteraClienteRow[];
  return rows.map(mapCarteraClienteRow);
}

async function listViaticos(filters: ReportFilters = {}) {
  const sql = getSql();
  const conditions = ["1 = 1"];
  const params: unknown[] = [];

  if (filters.fechaDesde) {
    params.push(filters.fechaDesde);
    conditions.push(`vv.fecha >= ($${params.length}::date)`);
  }

  if (filters.fechaHasta) {
    params.push(filters.fechaHasta);
    conditions.push(`vv.fecha < (($${params.length}::date) + INTERVAL '1 day')`);
  }

  if (filters.tercero) {
    params.push(`%${filters.tercero}%`);
    const index = params.length;
    conditions.push(`(
      vv.descripcion ILIKE $${index}
      OR COALESCE(vv.observaciones, '') ILIKE $${index}
      OR v.objetivo ILIKE $${index}
      OR COALESCE(c.nombre, '') ILIKE $${index}
      OR COALESCE(c.empresa, '') ILIKE $${index}
      OR COALESCE(p.nombre, '') ILIKE $${index}
      OR COALESCE(p.empresa, '') ILIKE $${index}
      OR COALESCE(u.nombre, '') ILIKE $${index}
      OR vv.id ILIKE $${index}
      OR v.id ILIKE $${index}
    )`);
  }

  if (
    filters.estado &&
    LEGALIZACION_ESTADOS.has(filters.estado as ContableLegalizacionViaticoEstado)
  ) {
    params.push(filters.estado);
    conditions.push(`vv.legalizacion_estado = $${params.length}`);
  }

  const query = `
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
      vv.soporte_tamano,
      vv.soporte_tipo_mime,
      vv.legalizacion_estado,
      vv.legalizacion_observaciones,
      vv.legalizacion_updated_at,
      vv.legalizacion_updated_by,
      lu.nombre AS legalizacion_updated_by_nombre,
      vv.contable_egreso_id,
      v.tipo AS visita_tipo,
      v.fecha AS visita_fecha,
      v.objetivo AS visita_objetivo,
      c.id AS cliente_id,
      c.nombre AS cliente_nombre,
      c.empresa AS cliente_empresa,
      p.id AS prospecto_id,
      p.nombre AS prospecto_nombre,
      p.empresa AS prospecto_empresa
    FROM visita_viaticos vv
    INNER JOIN visitas v
      ON v.id = vv.visita_id
    LEFT JOIN users u
      ON u.id = vv.usuario_id
    LEFT JOIN users lu
      ON lu.id = vv.legalizacion_updated_by
    LEFT JOIN clientes c
      ON c.id = v.cliente_id
    LEFT JOIN prospectos p
      ON p.id = v.prospecto_id
    WHERE ${conditions.join(" AND ")}
    ORDER BY COALESCE(u.nombre, 'Sin vendedor') ASC, vv.fecha DESC, vv.created_at DESC
  `;

  const rows = (await sql.query(query, params)) as ViaticoRow[];
  return rows.map(mapViaticoRow);
}

async function listMovimientosBancarios(filters: ReportFilters = {}) {
  const sql = getSql();
  const params: unknown[] = [];
  const whereClauses: string[] = [];
  const conciliado = toConciliadoFilter(filters.estado);

  if (filters.fechaDesde) {
    params.push(filters.fechaDesde);
    whereClauses.push(`m.fecha >= $${params.length}`);
  }

  if (filters.fechaHasta) {
    params.push(filters.fechaHasta);
    whereClauses.push(`m.fecha <= $${params.length}`);
  }

  if (filters.tercero) {
    params.push(`%${filters.tercero}%`);
    whereClauses.push(`(
      m.tercero_nombre_razon_social ILIKE $${params.length}
      OR m.tercero_documento_nit ILIKE $${params.length}
      OR m.referencia_numero ILIKE $${params.length}
      OR COALESCE(m.cuenta_bancaria_banco, '') ILIKE $${params.length}
      OR COALESCE(m.cuenta_bancaria_nombre, '') ILIKE $${params.length}
    )`);
  }

  if (conciliado !== undefined) {
    params.push(conciliado);
    whereClauses.push(`m.conciliado = $${params.length}`);
  }

  const query = `
    WITH movimientos AS (
      SELECT
        r.id,
        r.cuenta_bancaria_id,
        cb.nombre_banco AS cuenta_bancaria_banco,
        cb.nombre_cuenta AS cuenta_bancaria_nombre,
        cb.numero_cuenta AS cuenta_bancaria_numero,
        r.fecha,
        'ingreso' AS tipo_movimiento,
        'recibo_caja' AS referencia_tipo,
        r.id AS referencia_id,
        r.numero_recibo AS referencia_numero,
        r.tercero_id,
        t.nombre_razon_social AS tercero_nombre_razon_social,
        t.documento_nit AS tercero_documento_nit,
        r.valor_total AS valor,
        r.conciliado,
        r.fecha_conciliacion,
        r.metodo_pago,
        r.created_at
      FROM contable_recibos_caja r
      INNER JOIN contable_terceros t
        ON t.id = r.tercero_id
      INNER JOIN contable_cuentas_bancarias cb
        ON cb.id = r.cuenta_bancaria_id
      WHERE r.cuenta_bancaria_id IS NOT NULL

      UNION ALL

      SELECT
        e.id,
        e.cuenta_bancaria_id,
        cb.nombre_banco AS cuenta_bancaria_banco,
        cb.nombre_cuenta AS cuenta_bancaria_nombre,
        cb.numero_cuenta AS cuenta_bancaria_numero,
        e.fecha,
        'egreso' AS tipo_movimiento,
        'egreso' AS referencia_tipo,
        e.id AS referencia_id,
        e.numero_comprobante AS referencia_numero,
        e.tercero_id,
        t.nombre_razon_social AS tercero_nombre_razon_social,
        t.documento_nit AS tercero_documento_nit,
        e.valor_total AS valor,
        e.conciliado,
        e.fecha_conciliacion,
        e.metodo_pago,
        e.created_at
      FROM contable_egresos e
      INNER JOIN contable_terceros t
        ON t.id = e.tercero_id
      INNER JOIN contable_cuentas_bancarias cb
        ON cb.id = e.cuenta_bancaria_id
      WHERE e.cuenta_bancaria_id IS NOT NULL
    )
    SELECT
      m.id,
      m.cuenta_bancaria_id,
      m.cuenta_bancaria_banco,
      m.cuenta_bancaria_nombre,
      m.cuenta_bancaria_numero,
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
      m.created_at
    FROM movimientos m
    ${whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : ""}
    ORDER BY
      m.fecha ASC,
      m.created_at ASC,
      m.referencia_tipo ASC,
      m.referencia_numero ASC,
      m.referencia_id ASC
  `;

  const rows = (await sql.query(query, params)) as MovimientoBancarioRow[];
  let saldoAcumulado = 0;
  const ordered = rows.map(row => {
    const valor = readNumber(row.valor, 0);
    const signedValue = row.tipo_movimiento === "ingreso" ? valor : valor * -1;
    saldoAcumulado = roundMoney(saldoAcumulado + signedValue);
    return mapMovimientoRow(row, saldoAcumulado);
  });

  return ordered.reverse();
}

async function buildContableReportes(filters: ReportFilters = {}) {
  const [
    facturasCompra,
    egresos,
    recibosCaja,
    carteraProveedores,
    carteraClientes,
    viaticos,
    movimientosBancarios,
  ] = await Promise.all([
    listFacturasCompra(filters),
    listEgresos(filters),
    listRecibosCaja(filters),
    listCarteraProveedores(filters),
    listCarteraClientes(filters),
    listViaticos(filters),
    listMovimientosBancarios(filters),
  ]);

  const totalFacturasCompra = roundMoney(
    facturasCompra.reduce((accumulator, item) => accumulator + item.total, 0)
  );
  const totalEgresos = roundMoney(
    egresos.reduce((accumulator, item) => accumulator + item.valorTotal, 0)
  );
  const totalRecibosCaja = roundMoney(
    recibosCaja.reduce((accumulator, item) => accumulator + item.valorTotal, 0)
  );
  const saldoCarteraProveedores = roundMoney(
    carteraProveedores.reduce((accumulator, item) => accumulator + item.saldo, 0)
  );
  const saldoCarteraClientes = roundMoney(
    carteraClientes.reduce((accumulator, item) => accumulator + item.saldo, 0)
  );
  const totalViaticos = roundMoney(
    viaticos.reduce((accumulator, item) => accumulator + item.valor, 0)
  );
  const totalIngresosBancarios = roundMoney(
    movimientosBancarios
      .filter(item => item.tipo === "ingreso")
      .reduce((accumulator, item) => accumulator + item.valor, 0)
  );
  const totalEgresosBancarios = roundMoney(
    movimientosBancarios
      .filter(item => item.tipo === "egreso")
      .reduce((accumulator, item) => accumulator + item.valor, 0)
  );
  const saldoBancarioSistema = roundMoney(
    totalIngresosBancarios - totalEgresosBancarios
  );
  const saldoConciliado = roundMoney(
    movimientosBancarios
      .filter(item => item.conciliado)
      .reduce(
        (accumulator, item) =>
          accumulator + (item.tipo === "ingreso" ? item.valor : item.valor * -1),
        0
      )
  );
  const diferenciaConciliacion = roundMoney(
    saldoBancarioSistema - saldoConciliado
  );

  const report: ContableReportesData = {
    carteraClientes,
    carteraProveedores,
    conciliacion: {
      diferencia: diferenciaConciliacion,
      movimientosConciliados: movimientosBancarios.filter(item => item.conciliado)
        .length,
      movimientosPendientes: movimientosBancarios.filter(item => !item.conciliado)
        .length,
      saldoConciliado,
      saldoSistema: saldoBancarioSistema,
      totalEgresos: totalEgresosBancarios,
      totalIngresos: totalIngresosBancarios,
    },
    egresos,
    facturasCompra,
    movimientosBancarios,
    recibosCaja,
    resumen: {
      diferenciaConciliacion,
      saldoBancarioSistema,
      saldoCarteraClientes,
      saldoCarteraProveedores,
      saldoConciliado,
      totalEgresos,
      totalEgresosBancarios,
      totalFacturasCompra,
      totalIngresosBancarios,
      totalRecibosCaja,
      totalViaticos,
    },
    viaticos,
  };

  return report;
}

function serializeReport(
  report: ContableReportesData
): SerializableContableReportesData {
  return {
    carteraClientes: report.carteraClientes.map(item => ({
      ...item,
      fechaUltimoMovimiento: formatDateOnly(item.fechaUltimoMovimiento),
    })),
    carteraProveedores: report.carteraProveedores.map(item => ({
      ...item,
      fechaFactura: formatDateOnly(item.fechaFactura),
      fechaVencimiento: formatDateOnly(item.fechaVencimiento),
    })),
    conciliacion: report.conciliacion,
    egresos: report.egresos.map(item => ({
      ...item,
      createdAt: item.createdAt.toISOString(),
      fecha: formatDateOnly(item.fecha),
    })),
    facturasCompra: report.facturasCompra.map(item => ({
      ...item,
      createdAt: item.createdAt.toISOString(),
      fechaFactura: formatDateOnly(item.fechaFactura),
      fechaVencimiento: formatDateOnly(item.fechaVencimiento),
      updatedAt: item.updatedAt.toISOString(),
    })),
    movimientosBancarios: report.movimientosBancarios.map(item => ({
      ...item,
      createdAt: item.createdAt.toISOString(),
      fecha: formatDateOnly(item.fecha),
      fechaConciliacion: item.fechaConciliacion?.toISOString(),
    })),
    recibosCaja: report.recibosCaja.map(item => ({
      ...item,
      createdAt: item.createdAt.toISOString(),
      fecha: formatDateOnly(item.fecha),
    })),
    resumen: report.resumen,
    viaticos: report.viaticos.map(item => ({
      ...item,
      fecha: item.fecha.toISOString(),
      legalizacionUpdatedAt: item.legalizacionUpdatedAt?.toISOString(),
      visitaFecha: formatDateOnly(item.visitaFecha),
    })),
  };
}

export async function handleContableReportesCollection(
  req: NodeRequest,
  res: ServerResponse
) {
  try {
    if (req.method !== "GET") {
      sendMethodNotAllowed(res, ["GET"]);
      return;
    }

    const filters = readFilters(req.url);
    const report = await buildContableReportes(filters);
    const exportFormat = getExportFormat(req.url);

    if (exportFormat === "excel") {
      const generated = await generateContableReportesExcel(report, filters);
      sendBinary(res, generated.contentType, generated.buffer, generated.fileName);
      return;
    }

    if (exportFormat === "pdf") {
      const generated = await generateContableReportesPdf(report, filters);
      sendBinary(res, generated.contentType, generated.buffer, generated.fileName);
      return;
    }

    sendJson(res, 200, serializeReport(report));
  } catch (error) {
    const statusCode = isValidationError(error) ? 400 : 500;
    sendErrorJson(
      res,
      statusCode,
      statusCode === 400 ? "Solicitud invalida" : "Error interno",
      getErrorMessage(error, "No se pudieron generar los reportes contables")
    );
  }
}

export function createContableReportesDevMiddleware() {
  return (req: NodeRequest, res: ServerResponse, next: ConnectNext) => {
    const pathname = getPathname(req.url);

    if (
      pathname === "/api/contable/reportes" ||
      pathname === "/api/contable/reportes/"
    ) {
      void handleContableReportesCollection(req, res).catch(next);
      return;
    }

    next();
  };
}
