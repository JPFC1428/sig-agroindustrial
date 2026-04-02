import type { IncomingMessage, ServerResponse } from "node:http";
import {
  ContableArchivoDocumentoTipo,
  type ContableArchivoDocumento,
} from "../client/src/lib/types.js";
import { getSql } from "./neon.js";

type NodeRequest = IncomingMessage & {
  body?: unknown;
};

type ConnectNext = (error?: unknown) => void;

type ContableArchivoDocumentoApiRecord = Omit<
  ContableArchivoDocumento,
  "fecha"
> & {
  fecha: string;
};

type ContableArchivoDocumentoRow = {
  id: string;
  tipo_documento: ContableArchivoDocumentoTipo;
  tercero_id: string | null;
  tercero_nombre_razon_social: string | null;
  tercero_documento_nit: string | null;
  fecha: string | Date;
  referencia: string;
  soporte_nombre: string | null;
  soporte_view_url: string | null;
  soporte_download_url: string | null;
};

type ContableArchivoFilters = {
  fechaDesde?: string;
  fechaHasta?: string;
  tercero?: string;
  tipoDocumento?: ContableArchivoDocumentoTipo;
};

let cachedViaticosSupportColumns: boolean | null = null;
let viaticosSupportColumnsPromise: Promise<boolean> | null = null;

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
    /fecha|tipo|solicitud|invalido|formato/i.test(error.message)
  );
}

async function hasViaticosSupportColumns() {
  if (cachedViaticosSupportColumns !== null) {
    return cachedViaticosSupportColumns;
  }

  if (viaticosSupportColumnsPromise) {
    return viaticosSupportColumnsPromise;
  }

  viaticosSupportColumnsPromise = (async () => {
    const sql = getSql();
    const rows = (await sql`
      SELECT COUNT(*)::int AS total
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'visita_viaticos'
        AND column_name IN (
          'soporte_nombre',
          'soporte_tipo_mime',
          'soporte_tamano'
        )
    `) as Array<{ total: number }>;

    cachedViaticosSupportColumns = Number(rows[0]?.total ?? 0) >= 3;
    viaticosSupportColumnsPromise = null;
    return cachedViaticosSupportColumns;
  })();

  return viaticosSupportColumnsPromise;
}

function mapArchivoRow(
  row: ContableArchivoDocumentoRow
): ContableArchivoDocumentoApiRecord {
  return {
    id: row.id,
    tipoDocumento: row.tipo_documento,
    terceroId: row.tercero_id ?? undefined,
    terceroNombreRazonSocial: row.tercero_nombre_razon_social ?? undefined,
    terceroDocumentoNit: row.tercero_documento_nit ?? undefined,
    fecha: formatDateOnly(row.fecha),
    referencia: row.referencia,
    soporteNombre: row.soporte_nombre ?? undefined,
    soporteViewUrl: row.soporte_view_url ?? undefined,
    soporteDownloadUrl: row.soporte_download_url ?? undefined,
  };
}

function readCollectionFilters(urlValue?: string): ContableArchivoFilters {
  const searchParams = getSearchParams(urlValue);
  const tipoDocumento = readString(
    searchParams.get("tipoDocumento")
  ) as ContableArchivoDocumentoTipo | undefined;

  if (
    tipoDocumento &&
    !Object.values(ContableArchivoDocumentoTipo).includes(tipoDocumento)
  ) {
    throw new Error("El tipo de documento es invalido");
  }

  return {
    fechaDesde: parseDateOnlyInput(readString(searchParams.get("fechaDesde"))),
    fechaHasta: parseDateOnlyInput(readString(searchParams.get("fechaHasta"))),
    tercero: readString(searchParams.get("tercero")),
    tipoDocumento,
  };
}

async function listContableArchivo(filters: ContableArchivoFilters = {}) {
  const sql = getSql();
  const supportColumnsEnabled = await hasViaticosSupportColumns();
  const viaticosSupportSelect = supportColumnsEnabled
    ? `
      vv.soporte_nombre AS soporte_nombre,
      CASE
        WHEN vv.soporte_nombre IS NOT NULL AND vv.soporte_tipo_mime IS NOT NULL
          THEN '/api/contable/viaticos/' || vv.id || '?resource=support'
        ELSE NULL
      END AS soporte_view_url,
      CASE
        WHEN vv.soporte_nombre IS NOT NULL AND vv.soporte_tipo_mime IS NOT NULL
          THEN '/api/contable/viaticos/' || vv.id || '?resource=support&download=1'
        ELSE NULL
      END AS soporte_download_url,
    `
    : `
      NULL::text AS soporte_nombre,
      NULL::text AS soporte_view_url,
      NULL::text AS soporte_download_url,
    `;

  const whereClauses: string[] = [];
  const params: unknown[] = [];

  if (filters.tipoDocumento) {
    params.push(filters.tipoDocumento);
    whereClauses.push(`documentos.tipo_documento = $${params.length}`);
  }

  if (filters.tercero) {
    params.push(`%${filters.tercero}%`);
    whereClauses.push(`(
      COALESCE(documentos.tercero_nombre_razon_social, '') ILIKE $${params.length}
      OR COALESCE(documentos.tercero_documento_nit, '') ILIKE $${params.length}
    )`);
  }

  if (filters.fechaDesde) {
    params.push(filters.fechaDesde);
    whereClauses.push(`documentos.fecha >= $${params.length}`);
  }

  if (filters.fechaHasta) {
    params.push(filters.fechaHasta);
    whereClauses.push(`documentos.fecha <= $${params.length}`);
  }

  const query = `
    WITH documentos AS (
      SELECT
        f.id,
        'factura_compra'::text AS tipo_documento,
        f.tercero_id,
        t.nombre_razon_social AS tercero_nombre_razon_social,
        t.documento_nit AS tercero_documento_nit,
        f.fecha_factura AS fecha,
        f.numero_factura AS referencia,
        CASE
          WHEN NULLIF(BTRIM(f.soporte_url), '') IS NOT NULL THEN 'Enlace externo'
          ELSE NULL
        END AS soporte_nombre,
        NULLIF(BTRIM(f.soporte_url), '') AS soporte_view_url,
        NULLIF(BTRIM(f.soporte_url), '') AS soporte_download_url,
        f.created_at
      FROM contable_facturas_compra f
      INNER JOIN contable_terceros t
        ON t.id = f.tercero_id

      UNION ALL

      SELECT
        e.id,
        'egreso'::text AS tipo_documento,
        e.tercero_id,
        t.nombre_razon_social AS tercero_nombre_razon_social,
        t.documento_nit AS tercero_documento_nit,
        e.fecha AS fecha,
        e.numero_comprobante AS referencia,
        CASE
          WHEN NULLIF(BTRIM(e.soporte_url), '') IS NOT NULL THEN 'Enlace externo'
          ELSE NULL
        END AS soporte_nombre,
        NULLIF(BTRIM(e.soporte_url), '') AS soporte_view_url,
        NULLIF(BTRIM(e.soporte_url), '') AS soporte_download_url,
        e.created_at
      FROM contable_egresos e
      INNER JOIN contable_terceros t
        ON t.id = e.tercero_id

      UNION ALL

      SELECT
        r.id,
        'recibo_caja'::text AS tipo_documento,
        r.tercero_id,
        t.nombre_razon_social AS tercero_nombre_razon_social,
        t.documento_nit AS tercero_documento_nit,
        r.fecha AS fecha,
        r.numero_recibo AS referencia,
        CASE
          WHEN NULLIF(BTRIM(r.soporte_url), '') IS NOT NULL THEN 'Enlace externo'
          ELSE NULL
        END AS soporte_nombre,
        NULLIF(BTRIM(r.soporte_url), '') AS soporte_view_url,
        NULLIF(BTRIM(r.soporte_url), '') AS soporte_download_url,
        r.created_at
      FROM contable_recibos_caja r
      INNER JOIN contable_terceros t
        ON t.id = r.tercero_id

      UNION ALL

      SELECT
        vv.id,
        'viatico'::text AS tipo_documento,
        COALESCE(c.id, p.id) AS tercero_id,
        COALESCE(
          NULLIF(BTRIM(c.empresa), ''),
          NULLIF(BTRIM(c.nombre), ''),
          NULLIF(BTRIM(p.empresa), ''),
          NULLIF(BTRIM(p.nombre), ''),
          NULLIF(BTRIM(u.nombre), ''),
          'Sin tercero relacionado'
        ) AS tercero_nombre_razon_social,
        NULL::text AS tercero_documento_nit,
        vv.fecha::date AS fecha,
        COALESCE(
          NULLIF(BTRIM(v.objetivo), ''),
          'Visita ' || vv.visita_id
        ) AS referencia,
        ${viaticosSupportSelect}
        vv.created_at
      FROM visita_viaticos vv
      INNER JOIN visitas v
        ON v.id = vv.visita_id
      LEFT JOIN users u
        ON u.id = vv.usuario_id
      LEFT JOIN clientes c
        ON c.id = v.cliente_id
      LEFT JOIN prospectos p
        ON p.id = v.prospecto_id
    )
    SELECT
      documentos.id,
      documentos.tipo_documento,
      documentos.tercero_id,
      documentos.tercero_nombre_razon_social,
      documentos.tercero_documento_nit,
      documentos.fecha,
      documentos.referencia,
      documentos.soporte_nombre,
      documentos.soporte_view_url,
      documentos.soporte_download_url
    FROM documentos
    ${
      whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : ""
    }
    ORDER BY documentos.fecha DESC, documentos.created_at DESC, documentos.referencia ASC
  `;

  const rows = (await sql.query(query, params)) as ContableArchivoDocumentoRow[];
  return rows.map(mapArchivoRow);
}

export async function handleContableArchivoCollection(
  req: NodeRequest,
  res: ServerResponse
) {
  try {
    if (req.method !== "GET") {
      sendMethodNotAllowed(res, ["GET"]);
      return;
    }

    const items = await listContableArchivo(readCollectionFilters(req.url));
    sendJson(res, 200, items);
  } catch (error) {
    const statusCode = isValidationError(error) ? 400 : 500;
    sendErrorJson(
      res,
      statusCode,
      statusCode === 400 ? "Solicitud invalida" : "Error interno",
      getErrorMessage(error, "No se pudo consultar el archivo contable")
    );
  }
}

export function createContableArchivoDevMiddleware() {
  return (req: NodeRequest, res: ServerResponse, next: ConnectNext) => {
    const pathname = getPathname(req.url);

    if (pathname === "/api/contable/archivo" || pathname === "/api/contable/archivo/") {
      void handleContableArchivoCollection(req, res).catch(next);
      return;
    }

    next();
  };
}
