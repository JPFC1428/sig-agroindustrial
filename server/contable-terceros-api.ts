import type { IncomingMessage, ServerResponse } from "node:http";
import { nanoid } from "nanoid";
import type { ContableTercero } from "../client/src/lib/types.js";
import { getSql } from "./neon.js";

type NodeRequest = IncomingMessage & {
  body?: unknown;
};

type ConnectNext = (error?: unknown) => void;

type ContableTerceroApiRecord = Omit<
  ContableTercero,
  "createdAt" | "updatedAt"
> & {
  createdAt: string;
  updatedAt: string;
};

type ContableTerceroRow = {
  id: string;
  tipo_tercero: ContableTercero["tipoTercero"];
  nombre_razon_social: string;
  documento_nit: string;
  contacto: string | null;
  telefono: string | null;
  correo: string | null;
  ciudad: string | null;
  direccion: string | null;
  observaciones: string | null;
  estado: ContableTercero["estado"];
  created_at: string | Date;
  updated_at: string | Date;
};

type ContableTerceroPayload = {
  tipoTercero?: string;
  nombreRazonSocial?: string;
  documentoNit?: string;
  contacto?: string;
  telefono?: string;
  correo?: string;
  ciudad?: string;
  direccion?: string;
  observaciones?: string;
  estado?: string;
};

type ContableTercerosFilters = {
  estado?: ContableTercero["estado"];
  q?: string;
  tipo?: ContableTercero["tipoTercero"];
};

type BuiltContableTercero = {
  id: string;
  tipoTercero: ContableTercero["tipoTercero"];
  nombreRazonSocial: string;
  documentoNit: string;
  contacto?: string;
  telefono?: string;
  correo?: string;
  ciudad?: string;
  direccion?: string;
  observaciones?: string;
  estado: ContableTercero["estado"];
};

const CONTABLE_TERCERO_TIPOS = new Set<ContableTercero["tipoTercero"]>([
  "cliente",
  "proveedor",
  "empleado",
  "banco",
  "otro",
] as ContableTercero["tipoTercero"][]);

const CONTABLE_TERCERO_ESTADOS = new Set<ContableTercero["estado"]>([
  "activo",
  "inactivo",
] as ContableTercero["estado"][]);

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

function parseDateValue(value: string | Date) {
  const parsed = value instanceof Date ? new Date(value) : new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Fecha invalida en la base de datos");
  }

  return parsed;
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function isValidationError(error: unknown) {
  return (
    error instanceof Error &&
    /obligatorio|invalido|correo|documento|solicitud/i.test(error.message)
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
    return new Error("Ya existe un tercero con ese documento o NIT");
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

function mapContableTerceroRow(
  row: ContableTerceroRow
): ContableTerceroApiRecord {
  const createdAt = parseDateValue(row.created_at);
  const updatedAt = parseDateValue(row.updated_at);

  return {
    id: row.id,
    tipoTercero: row.tipo_tercero,
    nombreRazonSocial: row.nombre_razon_social,
    documentoNit: row.documento_nit,
    contacto: row.contacto ?? undefined,
    telefono: row.telefono ?? undefined,
    correo: row.correo ?? undefined,
    ciudad: row.ciudad ?? undefined,
    direccion: row.direccion ?? undefined,
    observaciones: row.observaciones ?? undefined,
    estado: row.estado,
    createdAt: createdAt.toISOString(),
    updatedAt: updatedAt.toISOString(),
  };
}

function buildContableTercero(
  payload: unknown,
  existing?: ContableTerceroApiRecord
): BuiltContableTercero {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Cuerpo de solicitud invalido");
  }

  const data = payload as ContableTerceroPayload;
  const tipoTerceroRaw =
    readString(data.tipoTercero) ?? existing?.tipoTercero ?? "otro";
  const nombreRazonSocial =
    readString(data.nombreRazonSocial) ?? existing?.nombreRazonSocial ?? "";
  const documentoNit =
    readString(data.documentoNit) ?? existing?.documentoNit ?? "";
  const contacto = readOptionalString(data.contacto, existing?.contacto);
  const telefono = readOptionalString(data.telefono, existing?.telefono);
  const correo = readOptionalString(data.correo, existing?.correo)?.toLowerCase();
  const ciudad = readOptionalString(data.ciudad, existing?.ciudad);
  const direccion = readOptionalString(data.direccion, existing?.direccion);
  const observaciones = readOptionalString(
    data.observaciones,
    existing?.observaciones
  );
  const estadoRaw = readString(data.estado) ?? existing?.estado ?? "activo";

  if (!nombreRazonSocial) {
    throw new Error("El nombre o razon social es obligatorio");
  }

  if (!documentoNit) {
    throw new Error("El documento o NIT es obligatorio");
  }

  if (
    !CONTABLE_TERCERO_TIPOS.has(tipoTerceroRaw as ContableTercero["tipoTercero"])
  ) {
    throw new Error("El tipo de tercero es invalido");
  }

  if (!CONTABLE_TERCERO_ESTADOS.has(estadoRaw as ContableTercero["estado"])) {
    throw new Error("El estado del tercero es invalido");
  }

  validateEmail(correo);

  return {
    id: existing?.id ?? `ter-${nanoid(8)}`,
    tipoTercero: tipoTerceroRaw as ContableTercero["tipoTercero"],
    nombreRazonSocial,
    documentoNit,
    contacto,
    telefono,
    correo,
    ciudad,
    direccion,
    observaciones,
    estado: estadoRaw as ContableTercero["estado"],
  };
}

async function listContableTerceros(filters: ContableTercerosFilters = {}) {
  const sql = getSql();
  const whereClauses: string[] = [];
  const params: unknown[] = [];

  if (filters.q) {
    params.push(`%${filters.q}%`);
    whereClauses.push(`(
      t.nombre_razon_social ILIKE $${params.length}
      OR t.documento_nit ILIKE $${params.length}
      OR COALESCE(t.contacto, '') ILIKE $${params.length}
      OR COALESCE(t.telefono, '') ILIKE $${params.length}
      OR COALESCE(t.correo, '') ILIKE $${params.length}
      OR COALESCE(t.ciudad, '') ILIKE $${params.length}
    )`);
  }

  if (filters.tipo) {
    params.push(filters.tipo);
    whereClauses.push(`t.tipo_tercero = $${params.length}`);
  }

  if (filters.estado) {
    params.push(filters.estado);
    whereClauses.push(`t.estado = $${params.length}`);
  }

  const query = `
    SELECT
      t.id,
      t.tipo_tercero,
      t.nombre_razon_social,
      t.documento_nit,
      t.contacto,
      t.telefono,
      t.correo,
      t.ciudad,
      t.direccion,
      t.observaciones,
      t.estado,
      t.created_at,
      t.updated_at
    FROM contable_terceros t
    ${
      whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : ""
    }
    ORDER BY t.nombre_razon_social ASC, t.created_at DESC
  `;

  const rows = (await sql.query(query, params)) as ContableTerceroRow[];
  return rows.map(mapContableTerceroRow);
}

async function findContableTerceroById(id: string) {
  const sql = getSql();
  const rows = (await sql`
    SELECT
      t.id,
      t.tipo_tercero,
      t.nombre_razon_social,
      t.documento_nit,
      t.contacto,
      t.telefono,
      t.correo,
      t.ciudad,
      t.direccion,
      t.observaciones,
      t.estado,
      t.created_at,
      t.updated_at
    FROM contable_terceros t
    WHERE t.id = ${id}
    LIMIT 1
  `) as ContableTerceroRow[];

  return rows[0] ? mapContableTerceroRow(rows[0]) : null;
}

async function insertContableTercero(payload: unknown) {
  const sql = getSql();
  const tercero = buildContableTercero(payload);

  try {
    const rows = (await sql`
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
        estado
      )
      VALUES (
        ${tercero.id},
        ${tercero.tipoTercero},
        ${tercero.nombreRazonSocial},
        ${tercero.documentoNit},
        ${tercero.contacto ?? null},
        ${tercero.telefono ?? null},
        ${tercero.correo ?? null},
        ${tercero.ciudad ?? null},
        ${tercero.direccion ?? null},
        ${tercero.observaciones ?? null},
        ${tercero.estado}
      )
      RETURNING
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
    `) as ContableTerceroRow[];

    return mapContableTerceroRow(rows[0]);
  } catch (error) {
    throw normalizeDatabaseError(error);
  }
}

async function updateContableTercero(id: string, payload: unknown) {
  const existing = await findContableTerceroById(id);

  if (!existing) {
    return null;
  }

  const sql = getSql();
  const tercero = buildContableTercero(payload, existing);

  try {
    const rows = (await sql`
      UPDATE contable_terceros
      SET
        tipo_tercero = ${tercero.tipoTercero},
        nombre_razon_social = ${tercero.nombreRazonSocial},
        documento_nit = ${tercero.documentoNit},
        contacto = ${tercero.contacto ?? null},
        telefono = ${tercero.telefono ?? null},
        correo = ${tercero.correo ?? null},
        ciudad = ${tercero.ciudad ?? null},
        direccion = ${tercero.direccion ?? null},
        observaciones = ${tercero.observaciones ?? null},
        estado = ${tercero.estado},
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING
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
    `) as ContableTerceroRow[];

    return rows[0] ? mapContableTerceroRow(rows[0]) : null;
  } catch (error) {
    throw normalizeDatabaseError(error);
  }
}

async function removeContableTercero(id: string) {
  const sql = getSql();
  const rows = (await sql`
    DELETE FROM contable_terceros
    WHERE id = ${id}
    RETURNING id
  `) as Array<{ id: string }>;

  return rows.length > 0;
}

function readCollectionFilters(urlValue?: string): ContableTercerosFilters {
  const searchParams = getSearchParams(urlValue);
  const q = readString(searchParams.get("q"));
  const tipo = readString(searchParams.get("tipo"));
  const estado = readString(searchParams.get("estado"));

  return {
    ...(q ? { q } : {}),
    ...(tipo &&
    CONTABLE_TERCERO_TIPOS.has(tipo as ContableTercero["tipoTercero"])
      ? { tipo: tipo as ContableTercero["tipoTercero"] }
      : {}),
    ...(estado &&
    CONTABLE_TERCERO_ESTADOS.has(estado as ContableTercero["estado"])
      ? { estado: estado as ContableTercero["estado"] }
      : {}),
  };
}

export function getContableTerceroIdFromRequestUrl(urlValue?: string) {
  const match = getPathname(urlValue).match(
    /^\/api\/contable\/terceros\/([^/]+)\/?$/
  );

  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

export async function handleContableTercerosCollection(
  req: NodeRequest,
  res: ServerResponse
) {
  try {
    if (req.method === "GET") {
      const terceros = await listContableTerceros(readCollectionFilters(req.url));
      sendJson(res, 200, terceros);
      return;
    }

    if (req.method === "POST") {
      const payload = await readJsonBody(req);
      const tercero = await insertContableTercero(payload);
      sendJson(res, 201, tercero);
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
      getErrorMessage(normalizedError, "No se pudo procesar la solicitud")
    );
  }
}

export async function handleContableTerceroItem(
  req: NodeRequest,
  res: ServerResponse,
  id: string
) {
  try {
    if (req.method === "GET") {
      const tercero = await findContableTerceroById(id);

      if (!tercero) {
        sendErrorJson(
          res,
          404,
          "Tercero no encontrado",
          `No existe un tercero con id ${id}`
        );
        return;
      }

      sendJson(res, 200, tercero);
      return;
    }

    if (req.method === "PUT") {
      const payload = await readJsonBody(req);
      const tercero = await updateContableTercero(id, payload);

      if (!tercero) {
        sendErrorJson(
          res,
          404,
          "Tercero no encontrado",
          `No existe un tercero con id ${id}`
        );
        return;
      }

      sendJson(res, 200, tercero);
      return;
    }

    if (req.method === "DELETE") {
      const deleted = await removeContableTercero(id);

      if (!deleted) {
        sendErrorJson(
          res,
          404,
          "Tercero no encontrado",
          `No existe un tercero con id ${id}`
        );
        return;
      }

      sendEmpty(res, 204);
      return;
    }

    sendMethodNotAllowed(res, ["GET", "PUT", "DELETE"]);
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
      getErrorMessage(normalizedError, "No se pudo procesar la solicitud")
    );
  }
}

export function createContableTercerosDevMiddleware() {
  return (req: NodeRequest, res: ServerResponse, next: ConnectNext) => {
    const pathname = getPathname(req.url);

    if (
      pathname === "/api/contable/terceros" ||
      pathname === "/api/contable/terceros/"
    ) {
      void handleContableTercerosCollection(req, res).catch(next);
      return;
    }

    const terceroId = getContableTerceroIdFromRequestUrl(req.url);

    if (terceroId) {
      void handleContableTerceroItem(req, res, terceroId).catch(next);
      return;
    }

    next();
  };
}
