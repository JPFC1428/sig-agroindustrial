import type { IncomingMessage, ServerResponse } from "node:http";
import type {
  ActividadReciente,
  AlertaSeguimientoDashboard,
  ConteosModulosDashboard,
  MetricasDashboard,
} from "../client/src/lib/types.js";
import { getSql } from "./neon.js";

type NodeRequest = IncomingMessage & {
  body?: unknown;
};

type ConnectNext = (error?: unknown) => void;

type ActividadRecienteApiRecord = Omit<ActividadReciente, "fecha"> & {
  fecha: string;
};

type AlertaSeguimientoDashboardApiRecord = Omit<
  AlertaSeguimientoDashboard,
  "fechaVencimiento"
> & {
  fechaVencimiento: string;
};

type DashboardResumenApiRecord = {
  metricas: MetricasDashboard;
  conteos: ConteosModulosDashboard;
  actividadReciente: ActividadRecienteApiRecord[];
  alertasSeguimiento: AlertaSeguimientoDashboardApiRecord[];
};

type DashboardMetricsRow = {
  total_clientes: number | string;
  total_prospectos: number | string;
  visitas_hoy: number | string;
  cotizaciones_mes: number | string;
  cotizaciones_pendientes: number | string;
  monto_prospectos: number | string | null;
  tasa_conversion: number | string | null;
  proximos_seguimientos: number | string;
};

type DashboardCountsRow = {
  clientes: number | string;
  prospectos: number | string;
  visitas: number | string;
  cotizaciones: number | string;
  seguimientos: number | string;
};

type ClienteActividadRow = {
  id: string;
  nombre: string;
  empresa: string;
  estado: string;
  updated_at: string | Date;
};

type ProspectoActividadRow = {
  id: string;
  nombre: string;
  empresa: string;
  estado: string;
  updated_at: string | Date;
};

type VisitaActividadRow = {
  id: string;
  tipo: string;
  estado: string;
  objetivo: string;
  relacionado_nombre: string | null;
  relacionado_empresa: string | null;
  updated_at: string | Date;
};

type CotizacionActividadRow = {
  id: string;
  numero: string;
  estado: string;
  total: number | string;
  moneda: string;
  cliente_nombre: string | null;
  cliente_empresa: string | null;
  updated_at: string | Date;
};

type SeguimientoActividadRow = {
  id: string;
  tipo: string;
  estado: string;
  completado: boolean;
  observaciones: string | null;
  relacionado_nombre: string | null;
  relacionado_empresa: string | null;
  updated_at: string | Date;
};

type AlertaSeguimientoRow = {
  id: string;
  cliente_id: string | null;
  cliente_nombre: string | null;
  cliente_empresa: string | null;
  prospecto_id: string | null;
  prospecto_nombre: string | null;
  prospecto_empresa: string | null;
  cotizacion_id: string | null;
  cotizacion_numero: string | null;
  cotizacion_cliente_nombre: string | null;
  cotizacion_cliente_empresa: string | null;
  tipo: AlertaSeguimientoDashboard["tipo"];
  fecha_vencimiento: string | Date;
  observaciones: string | null;
  estado: AlertaSeguimientoDashboard["estado"];
  completado: boolean;
};

const APP_TIMEZONE = "America/Bogota";

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

function getPathname(urlValue?: string) {
  return new URL(urlValue ?? "/", "http://localhost").pathname;
}

function readNumber(value: number | string | null | undefined, fallback = 0) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseDateValue(value: string | Date) {
  const parsed = value instanceof Date ? new Date(value) : new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Fecha invalida en la base de datos");
  }

  return parsed;
}

function formatLabel(value: string) {
  if (!value) {
    return "";
  }

  const normalized = value.replace(/_/g, " ").trim();
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function formatMoney(value: number, currency: string) {
  const resolvedCurrency = currency === "USD" ? "USD" : "COP";

  return new Intl.NumberFormat("es-CO", {
    currency: resolvedCurrency,
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
    style: "currency",
  }).format(value);
}

function truncate(value: string | null | undefined, maxLength: number) {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();

  if (trimmed.length <= maxLength) {
    return trimmed;
  }

  return `${trimmed.slice(0, maxLength - 3)}...`;
}

async function getMetricasDashboard(): Promise<MetricasDashboard> {
  const sql = getSql();
  const rows = (await sql`
    SELECT
      (SELECT COUNT(*)::int FROM clientes) AS total_clientes,
      (SELECT COUNT(*)::int FROM prospectos) AS total_prospectos,
      (
        SELECT COUNT(*)::int
        FROM visitas
        WHERE timezone(${APP_TIMEZONE}, fecha)::date =
          timezone(${APP_TIMEZONE}, now())::date
      ) AS visitas_hoy,
      (
        SELECT COUNT(*)::int
        FROM cotizaciones
        WHERE date_trunc('month', timezone(${APP_TIMEZONE}, fecha)) =
          date_trunc('month', timezone(${APP_TIMEZONE}, now()))
      ) AS cotizaciones_mes,
      (
        SELECT COUNT(*)::int
        FROM cotizaciones
        WHERE estado IN ('borrador', 'enviada')
      ) AS cotizaciones_pendientes,
      (
        SELECT COALESCE(SUM(COALESCE(monto_estimado, 0)), 0)
        FROM prospectos
        WHERE estado NOT IN ('ganado', 'perdido')
      ) AS monto_prospectos,
      (
        SELECT COALESCE(
          ROUND(
            (
              (COUNT(*) FILTER (WHERE estado = 'ganado'))::numeric
              / NULLIF(COUNT(*), 0)::numeric
            ) * 100,
            1
          ),
          0
        )
        FROM prospectos
      ) AS tasa_conversion,
      (
        SELECT COUNT(*)::int
        FROM seguimientos
        WHERE completado = FALSE
          AND estado IN ('pendiente', 'en_proceso')
          AND timezone(${APP_TIMEZONE}, fecha_vencimiento)::date BETWEEN
            timezone(${APP_TIMEZONE}, now())::date AND
            (timezone(${APP_TIMEZONE}, now())::date + 7)
      ) AS proximos_seguimientos
  `) as DashboardMetricsRow[];

  const row = rows[0];

  return {
    totalClientes: readNumber(row?.total_clientes, 0),
    totalProspectos: readNumber(row?.total_prospectos, 0),
    visitasHoy: readNumber(row?.visitas_hoy, 0),
    cotizacionesMes: readNumber(row?.cotizaciones_mes, 0),
    cotizacionesPendientes: readNumber(row?.cotizaciones_pendientes, 0),
    montoProspectos: readNumber(row?.monto_prospectos, 0),
    tasaConversion: readNumber(row?.tasa_conversion, 0),
    proximosSegumientos: readNumber(row?.proximos_seguimientos, 0),
  };
}

async function getConteosModulosDashboard(): Promise<ConteosModulosDashboard> {
  const sql = getSql();
  const rows = (await sql`
    SELECT
      (SELECT COUNT(*)::int FROM clientes) AS clientes,
      (SELECT COUNT(*)::int FROM prospectos) AS prospectos,
      (SELECT COUNT(*)::int FROM visitas) AS visitas,
      (SELECT COUNT(*)::int FROM cotizaciones) AS cotizaciones,
      (SELECT COUNT(*)::int FROM seguimientos) AS seguimientos
  `) as DashboardCountsRow[];

  const row = rows[0];

  return {
    clientes: readNumber(row?.clientes, 0),
    prospectos: readNumber(row?.prospectos, 0),
    visitas: readNumber(row?.visitas, 0),
    cotizaciones: readNumber(row?.cotizaciones, 0),
    seguimientos: readNumber(row?.seguimientos, 0),
  };
}

async function getActividadClientes(): Promise<ActividadRecienteApiRecord[]> {
  const sql = getSql();
  const rows = (await sql`
    SELECT id, nombre, empresa, estado, updated_at
    FROM clientes
    ORDER BY updated_at DESC
    LIMIT 5
  `) as ClienteActividadRow[];

  return rows.map(row => ({
    id: `cliente-${row.id}`,
    tipo: "cliente",
    titulo: `Cliente ${row.empresa || row.nombre}`,
    descripcion: `Contacto: ${row.nombre} | Estado: ${formatLabel(row.estado)}`,
    fecha: parseDateValue(row.updated_at).toISOString(),
  }));
}

async function getActividadProspectos(): Promise<ActividadRecienteApiRecord[]> {
  const sql = getSql();
  const rows = (await sql`
    SELECT id, nombre, empresa, estado, updated_at
    FROM prospectos
    ORDER BY updated_at DESC
    LIMIT 5
  `) as ProspectoActividadRow[];

  return rows.map(row => ({
    id: `prospecto-${row.id}`,
    tipo: "prospecto",
    titulo: `Prospecto ${row.empresa || row.nombre}`,
    descripcion: `Contacto: ${row.nombre} | Estado: ${formatLabel(row.estado)}`,
    fecha: parseDateValue(row.updated_at).toISOString(),
  }));
}

async function getActividadVisitas(): Promise<ActividadRecienteApiRecord[]> {
  const sql = getSql();
  const rows = (await sql`
    SELECT
      v.id,
      v.tipo,
      v.estado,
      v.objetivo,
      COALESCE(c.nombre, p.nombre) AS relacionado_nombre,
      COALESCE(c.empresa, p.empresa) AS relacionado_empresa,
      v.updated_at
    FROM visitas v
    LEFT JOIN clientes c ON c.id = v.cliente_id
    LEFT JOIN prospectos p ON p.id = v.prospecto_id
    ORDER BY v.updated_at DESC
    LIMIT 5
  `) as VisitaActividadRow[];

  return rows.map(row => {
    const relacionado =
      row.relacionado_empresa || row.relacionado_nombre || "sin relacion";

    return {
      id: `visita-${row.id}`,
      tipo: "visita",
      titulo: `Visita ${formatLabel(row.tipo)}`,
      descripcion: `${relacionado} | ${truncate(row.objetivo, 72) ?? "Sin objetivo"} | ${formatLabel(row.estado)}`,
      fecha: parseDateValue(row.updated_at).toISOString(),
    };
  });
}

async function getActividadCotizaciones(): Promise<ActividadRecienteApiRecord[]> {
  const sql = getSql();
  const rows = (await sql`
    SELECT
      co.id,
      co.numero,
      co.estado,
      co.total,
      co.moneda,
      c.nombre AS cliente_nombre,
      c.empresa AS cliente_empresa,
      co.updated_at
    FROM cotizaciones co
    LEFT JOIN clientes c ON c.id = co.cliente_id
    ORDER BY co.updated_at DESC
    LIMIT 5
  `) as CotizacionActividadRow[];

  return rows.map(row => {
    const cliente =
      row.cliente_empresa || row.cliente_nombre || "cliente sin asignar";

    return {
      id: `cotizacion-${row.id}`,
      tipo: "cotizacion",
      titulo: `Cotizacion ${row.numero}`,
      descripcion: `${cliente} | ${formatLabel(row.estado)} | ${formatMoney(readNumber(row.total, 0), row.moneda)}`,
      fecha: parseDateValue(row.updated_at).toISOString(),
    };
  });
}

async function getActividadSeguimientos(): Promise<ActividadRecienteApiRecord[]> {
  const sql = getSql();
  const rows = (await sql`
    SELECT
      s.id,
      s.tipo,
      s.estado,
      s.completado,
      s.observaciones,
      COALESCE(c.nombre, p.nombre, co.numero) AS relacionado_nombre,
      COALESCE(c.empresa, p.empresa, cc.empresa, cc.nombre) AS relacionado_empresa,
      s.updated_at
    FROM seguimientos s
    LEFT JOIN clientes c ON c.id = s.cliente_id
    LEFT JOIN prospectos p ON p.id = s.prospecto_id
    LEFT JOIN cotizaciones co ON co.id = s.cotizacion_id
    LEFT JOIN clientes cc ON cc.id = co.cliente_id
    ORDER BY s.updated_at DESC
    LIMIT 5
  `) as SeguimientoActividadRow[];

  return rows.map(row => {
    const relacionado =
      row.relacionado_empresa || row.relacionado_nombre || "sin relacion";
    const estado = row.completado ? "Completado" : formatLabel(row.estado);
    const detalle =
      truncate(row.observaciones, 68) ?? `Relacionado con ${relacionado}`;

    return {
      id: `seguimiento-${row.id}`,
      tipo: "seguimiento",
      titulo: `Seguimiento ${formatLabel(row.tipo)}`,
      descripcion: `${relacionado} | ${estado} | ${detalle}`,
      fecha: parseDateValue(row.updated_at).toISOString(),
    };
  });
}

async function getActividadReciente(): Promise<ActividadRecienteApiRecord[]> {
  const actividad = await Promise.all([
    getActividadClientes(),
    getActividadProspectos(),
    getActividadVisitas(),
    getActividadCotizaciones(),
    getActividadSeguimientos(),
  ]);

  return actividad
    .flat()
    .sort(
      (left, right) =>
        new Date(right.fecha).getTime() - new Date(left.fecha).getTime()
    )
    .slice(0, 5);
}

async function getAlertasSeguimiento(): Promise<
  AlertaSeguimientoDashboardApiRecord[]
> {
  const sql = getSql();
  const rows = (await sql`
    SELECT
      s.id,
      s.cliente_id,
      c.nombre AS cliente_nombre,
      c.empresa AS cliente_empresa,
      s.prospecto_id,
      p.nombre AS prospecto_nombre,
      p.empresa AS prospecto_empresa,
      s.cotizacion_id,
      co.numero AS cotizacion_numero,
      cc.nombre AS cotizacion_cliente_nombre,
      cc.empresa AS cotizacion_cliente_empresa,
      s.tipo,
      s.fecha_vencimiento,
      s.observaciones,
      s.estado,
      s.completado
    FROM seguimientos s
    LEFT JOIN clientes c ON c.id = s.cliente_id
    LEFT JOIN prospectos p ON p.id = s.prospecto_id
    LEFT JOIN cotizaciones co ON co.id = s.cotizacion_id
    LEFT JOIN clientes cc ON cc.id = co.cliente_id
    WHERE s.completado = FALSE
      AND s.estado IN ('pendiente', 'en_proceso')
      AND timezone(${APP_TIMEZONE}, s.fecha_vencimiento)::date <=
        (timezone(${APP_TIMEZONE}, now())::date + 7)
    ORDER BY s.fecha_vencimiento ASC
    LIMIT 6
  `) as AlertaSeguimientoRow[];

  return rows.map(row => {
    const relacionTipo = row.cliente_id
      ? "cliente"
      : row.prospecto_id
        ? "prospecto"
        : row.cotizacion_id
          ? "cotizacion"
          : undefined;

    return {
      id: row.id,
      clienteId: row.cliente_id ?? undefined,
      clienteNombre: row.cliente_nombre ?? undefined,
      clienteEmpresa: row.cliente_empresa ?? undefined,
      prospectoId: row.prospecto_id ?? undefined,
      prospectoNombre: row.prospecto_nombre ?? undefined,
      prospectoEmpresa: row.prospecto_empresa ?? undefined,
      cotizacionId: row.cotizacion_id ?? undefined,
      cotizacionNumero: row.cotizacion_numero ?? undefined,
      relacionTipo,
      relacionadoNombre:
        relacionTipo === "cliente"
          ? row.cliente_nombre ?? undefined
          : relacionTipo === "prospecto"
            ? row.prospecto_nombre ?? undefined
            : row.cotizacion_numero ?? undefined,
      relacionadoEmpresa:
        relacionTipo === "cliente"
          ? row.cliente_empresa ?? undefined
          : relacionTipo === "prospecto"
            ? row.prospecto_empresa ?? undefined
            : row.cotizacion_cliente_empresa ??
              row.cotizacion_cliente_nombre ??
              undefined,
      tipo: row.tipo,
      fechaVencimiento: parseDateValue(row.fecha_vencimiento).toISOString(),
      observaciones: row.observaciones ?? undefined,
      estado: row.estado,
      completado: Boolean(row.completado),
    };
  });
}

async function buildDashboardResumen(): Promise<DashboardResumenApiRecord> {
  const [metricas, conteos, actividadReciente, alertasSeguimiento] =
    await Promise.all([
      getMetricasDashboard(),
      getConteosModulosDashboard(),
      getActividadReciente(),
      getAlertasSeguimiento(),
    ]);

  return {
    metricas,
    conteos,
    actividadReciente,
    alertasSeguimiento,
  };
}

export async function handleDashboardSummary(
  req: NodeRequest,
  res: ServerResponse
) {
  try {
    if (req.method !== "GET") {
      sendMethodNotAllowed(res, ["GET"]);
      return;
    }

    const resumen = await buildDashboardResumen();
    sendJson(res, 200, resumen);
  } catch (error) {
    const detail =
      error instanceof Error
        ? error.message
        : "No se pudo cargar el dashboard";

    sendErrorJson(res, 500, "Error interno", detail);
  }
}

export function createDashboardDevMiddleware() {
  return (req: NodeRequest, res: ServerResponse, next: ConnectNext) => {
    const pathname = getPathname(req.url);

    if (pathname !== "/api/dashboard" && pathname !== "/api/dashboard/") {
      next();
      return;
    }

    void handleDashboardSummary(req, res).catch(next);
  };
}
