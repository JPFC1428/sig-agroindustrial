import type { IncomingMessage, ServerResponse } from "node:http";
import { getAuthenticatedUser } from "./auth-api.js";
import {
  generateContableViaticosExcel,
  generateContableViaticosPdf,
} from "./contable-viaticos-export.js";
import { getSql } from "./neon.js";
import {
  ContableLegalizacionViaticoEstado,
  type ContableLegalizacionViatico,
  type ContableLegalizacionViaticoVendedor,
  type ViaticoTipoGasto,
  type VisitaViaticoSoporte,
} from "../client/src/lib/types.js";

type NodeRequest = IncomingMessage & {
  body?: unknown;
};

type ConnectNext = (error?: unknown) => void;

type ContableLegalizacionViaticoApiRecord = Omit<
  ContableLegalizacionViatico,
  "fecha" | "legalizacionUpdatedAt" | "visitaFecha"
> & {
  fecha: string;
  legalizacionUpdatedAt?: string;
  visitaFecha: string;
};

type ContableLegalizacionViaticoRow = {
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

type ContableLegalizacionViaticoFilters = {
  estado?: ContableLegalizacionViaticoEstado;
  fechaDesde?: string;
  fechaHasta?: string;
  q?: string;
  vendedorId?: string;
};

type ContableLegalizacionUpdatePayload = {
  legalizacionEstado: ContableLegalizacionViaticoEstado;
  legalizacionObservaciones?: string;
};

type ViaticoSupportRow = {
  soporte_contenido_base64: string | null;
  soporte_nombre: string | null;
  soporte_tipo_mime: string | null;
};

const LEGALIZACION_ESTADOS = new Set<ContableLegalizacionViaticoEstado>([
  ContableLegalizacionViaticoEstado.PENDIENTE,
  ContableLegalizacionViaticoEstado.LEGALIZADO,
  ContableLegalizacionViaticoEstado.APROBADO,
  ContableLegalizacionViaticoEstado.RECHAZADO,
] as ContableLegalizacionViaticoEstado[]);

let cachedLegalizacionColumns: boolean | null = null;
let legalizacionColumnsPromise: Promise<boolean> | null = null;
let cachedSupportColumns: boolean | null = null;
let supportColumnsPromise: Promise<boolean> | null = null;

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

function sendBinary(
  res: ServerResponse,
  contentType: string,
  buffer: Buffer,
  fileName: string,
  mode: "view" | "download"
) {
  res.statusCode = 200;
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", contentType);
  res.setHeader(
    "Content-Disposition",
    `${mode === "download" ? "attachment" : "inline"}; filename="${fileName}"; filename*=UTF-8''${encodeURIComponent(
      fileName
    )}`
  );
  res.end(buffer);
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
    /obligatorio|invalido|fecha|estado|legalizacion|base actual|solicitud/i.test(
      error.message
    )
  );
}

async function hasLegalizacionColumns() {
  if (cachedLegalizacionColumns !== null) {
    return cachedLegalizacionColumns;
  }

  if (legalizacionColumnsPromise) {
    return legalizacionColumnsPromise;
  }

  legalizacionColumnsPromise = (async () => {
    const sql = getSql();
    const rows = (await sql`
      SELECT COUNT(*)::int AS total
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'visita_viaticos'
        AND column_name IN (
          'legalizacion_estado',
          'legalizacion_observaciones',
          'legalizacion_updated_at',
          'legalizacion_updated_by',
          'contable_egreso_id'
        )
    `) as Array<{ total: number | string }>;

    const hasColumns = readNumber(rows[0]?.total, 0) >= 5;
    cachedLegalizacionColumns = hasColumns;
    legalizacionColumnsPromise = null;
    return hasColumns;
  })();

  return legalizacionColumnsPromise;
}

async function hasSupportColumns() {
  if (cachedSupportColumns !== null) {
    return cachedSupportColumns;
  }

  if (supportColumnsPromise) {
    return supportColumnsPromise;
  }

  supportColumnsPromise = (async () => {
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
    `) as Array<{ total: number | string }>;

    const hasColumns = readNumber(rows[0]?.total, 0) >= 3;
    cachedSupportColumns = hasColumns;
    supportColumnsPromise = null;
    return hasColumns;
  })();

  return supportColumnsPromise;
}

async function ensureLegalizacionColumns() {
  const enabled = await hasLegalizacionColumns();

  if (!enabled) {
    throw new Error(
      "La base actual no tiene habilitada la legalizacion contable de viaticos"
    );
  }
}

function mapRow(
  row: ContableLegalizacionViaticoRow
): ContableLegalizacionViaticoApiRecord {
  return {
    id: row.id,
    visitaId: row.visita_id,
    visitaTipo: row.visita_tipo,
    visitaFecha: formatDateOnly(row.visita_fecha),
    visitaObjetivo: row.visita_objetivo,
    visitaRelacionTipo: row.cliente_id ? "cliente" : row.prospecto_id ? "prospecto" : undefined,
    relacionadoId: row.cliente_id ?? row.prospecto_id ?? undefined,
    relacionadoNombre: row.cliente_nombre ?? row.prospecto_nombre ?? undefined,
    relacionadoEmpresa: row.cliente_empresa ?? row.prospecto_empresa ?? undefined,
    usuarioId: row.usuario_id ?? undefined,
    usuarioNombre: row.usuario_nombre ?? undefined,
    tipoGasto: row.tipo_gasto,
    fecha:
      row.fecha instanceof Date
        ? row.fecha.toISOString()
        : new Date(row.fecha).toISOString(),
    valor: readNumber(row.valor, 0),
    descripcion: row.descripcion,
    observaciones: row.observaciones ?? undefined,
    ...(row.soporte_nombre && row.soporte_tipo_mime
      ? {
          soporte: {
            fileName: row.soporte_nombre,
            fileSize: readNumber(row.soporte_tamano, 0),
            mimeType: row.soporte_tipo_mime as VisitaViaticoSoporte["mimeType"],
          },
        }
      : {}),
    legalizacionEstado: row.legalizacion_estado,
    legalizacionObservaciones: row.legalizacion_observaciones ?? undefined,
    legalizacionUpdatedAt:
      row.legalizacion_updated_at instanceof Date
        ? row.legalizacion_updated_at.toISOString()
        : row.legalizacion_updated_at
          ? new Date(row.legalizacion_updated_at).toISOString()
          : undefined,
    legalizacionUpdatedBy: row.legalizacion_updated_by ?? undefined,
    legalizacionUpdatedByNombre:
      row.legalizacion_updated_by_nombre ?? undefined,
    contableEgresoId: row.contable_egreso_id ?? undefined,
  };
}

function toDomainItem(
  item: ContableLegalizacionViaticoApiRecord
): ContableLegalizacionViatico {
  return {
    ...item,
    fecha: new Date(item.fecha),
    legalizacionUpdatedAt: item.legalizacionUpdatedAt
      ? new Date(item.legalizacionUpdatedAt)
      : undefined,
    visitaFecha: new Date(item.visitaFecha),
  };
}

function readFilters(urlValue?: string): ContableLegalizacionViaticoFilters {
  const searchParams = getSearchParams(urlValue);
  const estado = searchParams.get("estado");

  return {
    ...(estado && LEGALIZACION_ESTADOS.has(estado as ContableLegalizacionViaticoEstado)
      ? { estado: estado as ContableLegalizacionViaticoEstado }
      : {}),
    ...(readString(searchParams.get("fechaDesde")) && {
      fechaDesde: parseDateOnlyInput(readString(searchParams.get("fechaDesde"))),
    }),
    ...(readString(searchParams.get("fechaHasta")) && {
      fechaHasta: parseDateOnlyInput(readString(searchParams.get("fechaHasta"))),
    }),
    ...(readString(searchParams.get("q")) ? { q: readString(searchParams.get("q")) } : {}),
    ...(searchParams.has("vendedorId")
      ? {
          vendedorId:
            readString(searchParams.get("vendedorId")) ?? "sin-vendedor",
        }
      : {}),
  };
}

function buildListQuery(
  filters: ContableLegalizacionViaticoFilters,
  supportColumnsEnabled: boolean
) {
  const selectSupportColumns = supportColumnsEnabled
    ? `
      vv.soporte_nombre,
      vv.soporte_tamano,
      vv.soporte_tipo_mime,
    `
    : `
      NULL::text AS soporte_nombre,
      NULL::integer AS soporte_tamano,
      NULL::text AS soporte_tipo_mime,
    `;

  const params: unknown[] = [];
  const conditions = ["1 = 1"];

  if (filters.vendedorId) {
    if (filters.vendedorId === "sin-vendedor") {
      conditions.push("vv.usuario_id IS NULL");
    } else {
      params.push(filters.vendedorId);
      conditions.push(`vv.usuario_id = $${params.length}`);
    }
  }

  if (filters.estado) {
    params.push(filters.estado);
    conditions.push(`vv.legalizacion_estado = $${params.length}`);
  }

  if (filters.fechaDesde) {
    params.push(filters.fechaDesde);
    conditions.push(`vv.fecha >= ($${params.length}::date)`);
  }

  if (filters.fechaHasta) {
    params.push(filters.fechaHasta);
    conditions.push(`vv.fecha < (($${params.length}::date) + INTERVAL '1 day')`);
  }

  if (filters.q) {
    params.push(`%${filters.q}%`);
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
      ${selectSupportColumns}
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

  return { params, query };
}

async function listContableViaticos(
  filters: ContableLegalizacionViaticoFilters = {}
) {
  await ensureLegalizacionColumns();
  const supportColumnsEnabled = await hasSupportColumns();
  const sql = getSql();
  const { query, params } = buildListQuery(filters, supportColumnsEnabled);
  const rows = (await sql.query(
    query,
    params
  )) as ContableLegalizacionViaticoRow[];

  return rows.map(mapRow);
}

async function getContableViaticoById(id: string) {
  await ensureLegalizacionColumns();
  const supportColumnsEnabled = await hasSupportColumns();
  const sql = getSql();
  const selectSupportColumns = supportColumnsEnabled
    ? `
      vv.soporte_nombre,
      vv.soporte_tamano,
      vv.soporte_tipo_mime,
    `
    : `
      NULL::text AS soporte_nombre,
      NULL::integer AS soporte_tamano,
      NULL::text AS soporte_tipo_mime,
    `;

  const rows = (await sql.query(
    `
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
        ${selectSupportColumns}
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
      WHERE vv.id = $1
      LIMIT 1
    `,
    [id]
  )) as ContableLegalizacionViaticoRow[];

  return rows[0] ? mapRow(rows[0]) : null;
}

async function listVendedores() {
  await ensureLegalizacionColumns();
  const sql = getSql();
  const rows = (await sql`
    SELECT DISTINCT
      vv.usuario_id AS id,
      COALESCE(u.nombre, 'Sin vendedor') AS nombre
    FROM visita_viaticos vv
    LEFT JOIN users u
      ON u.id = vv.usuario_id
    ORDER BY COALESCE(u.nombre, 'Sin vendedor') ASC
  `) as Array<{ id: string | null; nombre: string }>;

  return rows.map(
    row =>
      ({
        id: row.id ?? undefined,
        nombre: row.nombre,
      }) satisfies ContableLegalizacionViaticoVendedor
  );
}

async function findViaticoById(id: string) {
  return getContableViaticoById(id);
}

async function getViaticoSupportById(id: string) {
  const supportColumnsEnabled = await hasSupportColumns();

  if (!supportColumnsEnabled) {
    throw new Error(
      "La base actual no tiene habilitado el soporte de archivos para viaticos"
    );
  }

  const sql = getSql();
  const rows = (await sql.query(
    `
      SELECT
        soporte_nombre,
        soporte_tipo_mime,
        soporte_contenido_base64
      FROM visita_viaticos
      WHERE id = $1
      LIMIT 1
    `,
    [id]
  )) as ViaticoSupportRow[];

  return rows[0] ?? null;
}

function buildUpdatePayload(payload: unknown): ContableLegalizacionUpdatePayload {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Cuerpo de solicitud invalido");
  }

  const data = payload as {
    legalizacionEstado?: string;
    legalizacionObservaciones?: string;
  };

  const legalizacionEstado = readString(data.legalizacionEstado);

  if (
    !legalizacionEstado ||
    !LEGALIZACION_ESTADOS.has(
      legalizacionEstado as ContableLegalizacionViaticoEstado
    )
  ) {
    throw new Error("El estado de legalizacion es obligatorio");
  }

  return {
    legalizacionEstado:
      legalizacionEstado as ContableLegalizacionViaticoEstado,
    legalizacionObservaciones: readOptionalString(data.legalizacionObservaciones),
  };
}

async function updateContableLegalizacion(
  id: string,
  payload: ContableLegalizacionUpdatePayload,
  userId: string
) {
  await ensureLegalizacionColumns();
  const sql = getSql();

  const existing = await findViaticoById(id);

  if (!existing) {
    return null;
  }

  await sql`
    UPDATE visita_viaticos
    SET
      legalizacion_estado = ${payload.legalizacionEstado},
      legalizacion_observaciones = ${payload.legalizacionObservaciones ?? null},
      legalizacion_updated_at = NOW(),
      legalizacion_updated_by = ${userId},
      updated_at = NOW()
    WHERE id = ${id}
  `;

  return findViaticoById(id);
}

function buildExportFilters(
  filters: ContableLegalizacionViaticoFilters,
  vendedores: ContableLegalizacionViaticoVendedor[]
) {
  const vendedorNombre =
    filters.vendedorId === "sin-vendedor"
      ? "Sin vendedor"
      : vendedores.find(vendedor => vendedor.id === filters.vendedorId)?.nombre;

  return {
    ...(filters.estado ? { estado: filters.estado } : {}),
    ...(filters.fechaDesde ? { fechaDesde: filters.fechaDesde } : {}),
    ...(filters.fechaHasta ? { fechaHasta: filters.fechaHasta } : {}),
    ...(filters.q ? { q: filters.q } : {}),
    ...(vendedorNombre ? { vendedorNombre } : {}),
  };
}

export function getContableViaticoIdFromRequestUrl(urlValue?: string) {
  const match = getPathname(urlValue).match(/^\/api\/contable\/viaticos\/([^/]+)\/?$/);
  return match?.[1];
}

export async function handleContableViaticosCollection(
  req: NodeRequest,
  res: ServerResponse
) {
  try {
    if (req.method !== "GET") {
      sendMethodNotAllowed(res, ["GET"]);
      return;
    }

    const searchParams = getSearchParams(req.url);
    const resource = searchParams.get("resource");

    if (resource === "vendedores") {
      const vendedores = await listVendedores();
      sendJson(res, 200, vendedores);
      return;
    }

    const filters = readFilters(req.url);
    const exportFormat = searchParams.get("export");
    const items = await listContableViaticos(filters);

    if (exportFormat === "excel" || exportFormat === "pdf") {
      const vendedores = await listVendedores();
      const exportFilters = buildExportFilters(filters, vendedores);
      const exportItems = items.map(toDomainItem);
      const generated =
        exportFormat === "excel"
          ? await generateContableViaticosExcel(exportItems, exportFilters)
          : await generateContableViaticosPdf(exportItems, exportFilters);

      res.statusCode = 200;
      res.setHeader("Cache-Control", "no-store");
      res.setHeader("Content-Type", generated.contentType);
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${generated.fileName}"; filename*=UTF-8''${encodeURIComponent(
          generated.fileName
        )}`
      );
      res.end(generated.buffer);
      return;
    }

    sendJson(res, 200, items);
  } catch (error) {
    const statusCode = isValidationError(error) ? 400 : 500;
    sendErrorJson(
      res,
      statusCode,
      statusCode === 400 ? "Solicitud invalida" : "Error interno",
      getErrorMessage(error, "No se pudo consultar la legalizacion de viaticos")
    );
  }
}

export async function handleContableViaticoItem(
  req: NodeRequest,
  res: ServerResponse,
  id: string
) {
  try {
    const searchParams = getSearchParams(req.url);
    const resource = searchParams.get("resource");

    if (resource === "support") {
      if (req.method !== "GET") {
        sendMethodNotAllowed(res, ["GET"]);
        return;
      }

      const support = await getViaticoSupportById(id);

      if (
        !support?.soporte_contenido_base64 ||
        !support.soporte_nombre ||
        !support.soporte_tipo_mime
      ) {
        sendErrorJson(
          res,
          404,
          "No encontrado",
          "El soporte solicitado no existe"
        );
        return;
      }

      sendBinary(
        res,
        support.soporte_tipo_mime,
        Buffer.from(support.soporte_contenido_base64, "base64"),
        support.soporte_nombre,
        searchParams.get("download") === "1" ? "download" : "view"
      );
      return;
    }

    if (req.method !== "PUT") {
      sendMethodNotAllowed(res, ["PUT"]);
      return;
    }

    const authenticatedUser = await getAuthenticatedUser(req);

    if (!authenticatedUser) {
      sendErrorJson(
        res,
        401,
        "No autenticado",
        "Debes iniciar sesion para actualizar la legalizacion"
      );
      return;
    }

    const payload = buildUpdatePayload(await readJsonBody(req));
    const updated = await updateContableLegalizacion(
      id,
      payload,
      authenticatedUser.id
    );

    if (!updated) {
      sendErrorJson(
        res,
        404,
        "No encontrado",
        "El viatico solicitado no existe"
      );
      return;
    }

    sendJson(res, 200, updated);
  } catch (error) {
    const statusCode = isValidationError(error) ? 400 : 500;
    sendErrorJson(
      res,
      statusCode,
      statusCode === 400 ? "Solicitud invalida" : "Error interno",
      getErrorMessage(error, "No se pudo actualizar la legalizacion del viatico")
    );
  }
}

export function createContableViaticosDevMiddleware() {
  return (req: NodeRequest, res: ServerResponse, next: ConnectNext) => {
    const pathname = getPathname(req.url);

    if (pathname === "/api/contable/viaticos" || pathname === "/api/contable/viaticos/") {
      void handleContableViaticosCollection(req, res).catch(next);
      return;
    }

    const id = getContableViaticoIdFromRequestUrl(req.url);

    if (id) {
      void handleContableViaticoItem(req, res, id).catch(next);
      return;
    }

    next();
  };
}
