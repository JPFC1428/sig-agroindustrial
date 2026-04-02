import type { IncomingMessage, ServerResponse } from "node:http";
import { nanoid } from "nanoid";
import {
  ContableNotaCreditoCarteraEstado,
  ContableNotaCreditoDocumentoTipo,
  ContableNotaCreditoEstado,
  ContableNotaCreditoTipo,
  ContableTerceroEstado,
  ContableTerceroTipo,
  type ContableNotaCredito,
} from "../client/src/lib/types.js";
import { getSql } from "./neon.js";

type NodeRequest = IncomingMessage & {
  body?: unknown;
};

type ConnectNext = (error?: unknown) => void;

type ContableNotaCreditoApiRecord = Omit<
  ContableNotaCredito,
  "fecha" | "createdAt" | "updatedAt"
> & {
  fecha: string;
  createdAt: string;
  updatedAt: string;
};

type ContableNotaCreditoRow = {
  id: string;
  numero_nota: string;
  tercero_id: string;
  tercero_nombre_razon_social: string;
  tercero_documento_nit: string;
  tipo: ContableNotaCredito["tipo"];
  fecha: string | Date;
  valor: number | string;
  motivo: string;
  referencia_documento: string | null;
  observaciones: string | null;
  estado: ContableNotaCredito["estado"];
  documento_relacionado_tipo: ContableNotaCredito["documentoRelacionadoTipo"] | null;
  documento_relacionado_id: string | null;
  documento_relacionado_numero: string | null;
  afecta_cartera: boolean;
  cartera_estado: ContableNotaCredito["carteraEstado"];
  created_at: string | Date;
  updated_at: string | Date;
};

type ContableNotaCreditoFilters = {
  estado?: ContableNotaCredito["estado"];
  q?: string;
  terceroId?: string;
  tipo?: ContableNotaCredito["tipo"];
};

type BuiltContableNotaCredito = {
  id: string;
  numeroNota: string;
  terceroId: string;
  tipo: ContableNotaCredito["tipo"];
  fecha: string;
  valor: number;
  motivo: string;
  referenciaDocumento?: string;
  observaciones?: string;
  estado: ContableNotaCredito["estado"];
  documentoRelacionadoTipo?: ContableNotaCredito["documentoRelacionadoTipo"];
  documentoRelacionadoId?: string;
  documentoRelacionadoNumero?: string;
  afectaCartera: boolean;
  carteraEstado: ContableNotaCredito["carteraEstado"];
};

type TerceroRow = {
  id: string;
  tipo_tercero: ContableTerceroTipo;
  nombre_razon_social: string;
  documento_nit: string;
  estado: ContableTerceroEstado;
};

type FacturaCompraRelacionadaRow = {
  id: string;
  numero_factura: string;
  tercero_id: string;
  estado: string;
};

const NOTA_CREDITO_TIPOS = new Set<ContableNotaCredito["tipo"]>([
  ContableNotaCreditoTipo.CLIENTE,
  ContableNotaCreditoTipo.PROVEEDOR,
] as ContableNotaCredito["tipo"][]);

const NOTA_CREDITO_ESTADOS = new Set<ContableNotaCredito["estado"]>([
  ContableNotaCreditoEstado.BORRADOR,
  ContableNotaCreditoEstado.EMITIDA,
  ContableNotaCreditoEstado.APLICADA,
  ContableNotaCreditoEstado.ANULADA,
] as ContableNotaCredito["estado"][]);

const NOTA_CREDITO_DOCUMENTO_TIPOS = new Set<
  ContableNotaCredito["documentoRelacionadoTipo"]
>([
  ContableNotaCreditoDocumentoTipo.FACTURA_COMPRA,
  ContableNotaCreditoDocumentoTipo.CUENTA_POR_COBRAR,
  ContableNotaCreditoDocumentoTipo.OTRO,
] as ContableNotaCredito["documentoRelacionadoTipo"][]);

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

function readOptionalString(value: unknown, fallback?: string) {
  if (value === undefined) {
    return fallback;
  }

  if (value === null) {
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

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function isValidationError(error: unknown) {
  return (
    error instanceof Error &&
    /obligatorio|invalido|nota|tercero|cliente|proveedor|valor|motivo|fecha|estado|documento|factura|cartera|solicitud/i.test(
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
    /contable_notas_credito_numero_nota_key|duplicate key value/i.test(
      error.message
    )
  ) {
    return new Error("Ya existe una nota credito con ese numero");
  }

  return error;
}

function parseDateOnlyInput(
  value: string | Date | undefined,
  fallback?: string
): string | undefined {
  if (value === undefined) {
    return fallback;
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
  const parsed = value instanceof Date ? new Date(value) : new Date(`${value}T00:00:00`);

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

function mapContableNotaCreditoRow(
  row: ContableNotaCreditoRow
): ContableNotaCreditoApiRecord {
  return {
    id: row.id,
    numeroNota: row.numero_nota,
    terceroId: row.tercero_id,
    terceroNombreRazonSocial: row.tercero_nombre_razon_social,
    terceroDocumentoNit: row.tercero_documento_nit,
    tipo: row.tipo,
    fecha: parseDateOnlyOutput(row.fecha).toISOString().slice(0, 10),
    valor: Number(row.valor),
    motivo: row.motivo,
    referenciaDocumento: row.referencia_documento ?? undefined,
    observaciones: row.observaciones ?? undefined,
    estado: row.estado,
    documentoRelacionadoTipo: row.documento_relacionado_tipo ?? undefined,
    documentoRelacionadoId: row.documento_relacionado_id ?? undefined,
    documentoRelacionadoNumero: row.documento_relacionado_numero ?? undefined,
    afectaCartera: row.afecta_cartera,
    carteraEstado: row.cartera_estado,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

async function findContableTerceroById(id: string) {
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
  `) as TerceroRow[];

  return rows[0] ?? null;
}

async function findFacturaCompraRelacionadaById(id: string) {
  const sql = getSql();
  const rows = (await sql`
    SELECT
      id,
      numero_factura,
      tercero_id,
      estado
    FROM contable_facturas_compra
    WHERE id = ${id}
    LIMIT 1
  `) as FacturaCompraRelacionadaRow[];

  return rows[0] ?? null;
}

function getExpectedTerceroTipo(tipo: ContableNotaCredito["tipo"]) {
  return tipo === ContableNotaCreditoTipo.CLIENTE
    ? ContableTerceroTipo.CLIENTE
    : ContableTerceroTipo.PROVEEDOR;
}

function buildCarteraState(
  referenciaDocumento?: string,
  documentoRelacionadoId?: string
) {
  const afectaCartera = Boolean(referenciaDocumento || documentoRelacionadoId);

  return {
    afectaCartera,
    carteraEstado: afectaCartera
      ? ContableNotaCreditoCarteraEstado.PREPARADA
      : ContableNotaCreditoCarteraEstado.PENDIENTE,
  } satisfies Pick<BuiltContableNotaCredito, "afectaCartera" | "carteraEstado">;
}

async function buildContableNotaCredito(payload: unknown) {
  assertPayload(payload);

  const numeroNota = readString(payload.numeroNota) ?? "";
  const terceroId = readString(payload.terceroId) ?? "";
  const tipo = (readString(payload.tipo) ?? "") as ContableNotaCredito["tipo"];
  const fecha = parseDateOnlyInput(payload.fecha as string | Date | undefined);
  const valor = roundMoney(readNumber(payload.valor));
  const motivo = readString(payload.motivo) ?? "";
  const referenciaDocumento = readOptionalString(payload.referenciaDocumento);
  const observaciones = readOptionalString(payload.observaciones);
  const estado = (readString(payload.estado) ??
    ContableNotaCreditoEstado.BORRADOR) as ContableNotaCredito["estado"];
  const documentoRelacionadoTipo = readOptionalString(
    payload.documentoRelacionadoTipo
  ) as ContableNotaCredito["documentoRelacionadoTipo"] | undefined;
  const documentoRelacionadoId = readOptionalString(payload.documentoRelacionadoId);

  if (!numeroNota) {
    throw new Error("El numero de nota es obligatorio");
  }

  if (!terceroId) {
    throw new Error("Debes seleccionar un tercero");
  }

  if (!NOTA_CREDITO_TIPOS.has(tipo)) {
    throw new Error("El tipo de nota credito es invalido");
  }

  if (!fecha) {
    throw new Error("La fecha de la nota es obligatoria");
  }

  if (!Number.isFinite(valor) || valor <= 0) {
    throw new Error("El valor de la nota credito debe ser mayor a cero");
  }

  if (!motivo) {
    throw new Error("El motivo de la nota credito es obligatorio");
  }

  if (!NOTA_CREDITO_ESTADOS.has(estado)) {
    throw new Error("El estado de la nota credito es invalido");
  }

  if (
    documentoRelacionadoTipo &&
    !NOTA_CREDITO_DOCUMENTO_TIPOS.has(documentoRelacionadoTipo)
  ) {
    throw new Error("El tipo de documento relacionado es invalido");
  }

  if (documentoRelacionadoId && !documentoRelacionadoTipo) {
    throw new Error(
      "Debes indicar el tipo del documento cuando selecciones una relacion estructurada"
    );
  }

  const tercero = await findContableTerceroById(terceroId);

  if (!tercero) {
    throw new Error("El tercero seleccionado no existe");
  }

  if (tercero.estado !== ContableTerceroEstado.ACTIVO) {
    throw new Error("Solo puedes registrar notas credito con terceros activos");
  }

  if (tercero.tipo_tercero !== getExpectedTerceroTipo(tipo)) {
    throw new Error(
      tipo === ContableNotaCreditoTipo.CLIENTE
        ? "El tercero seleccionado no corresponde a un cliente"
        : "El tercero seleccionado no corresponde a un proveedor"
    );
  }

  let documentoRelacionadoNumero: string | undefined;
  let referenciaDocumentoNormalizada = referenciaDocumento;

  if (
    documentoRelacionadoTipo === ContableNotaCreditoDocumentoTipo.FACTURA_COMPRA
  ) {
    if (tipo !== ContableNotaCreditoTipo.PROVEEDOR) {
      throw new Error(
        "Solo las notas credito de proveedor pueden relacionarse con facturas de compra"
      );
    }

    if (!documentoRelacionadoId) {
      throw new Error(
        "Debes seleccionar la factura de compra que quieres relacionar"
      );
    }

    const factura = await findFacturaCompraRelacionadaById(documentoRelacionadoId);

    if (!factura) {
      throw new Error("La factura de compra relacionada no existe");
    }

    if (factura.tercero_id !== terceroId) {
      throw new Error(
        "La factura relacionada no pertenece al mismo proveedor de la nota credito"
      );
    }

    documentoRelacionadoNumero = factura.numero_factura;
    referenciaDocumentoNormalizada =
      referenciaDocumentoNormalizada ?? factura.numero_factura;
  } else if (
    documentoRelacionadoTipo === ContableNotaCreditoDocumentoTipo.CUENTA_POR_COBRAR
  ) {
    if (tipo !== ContableNotaCreditoTipo.CLIENTE) {
      throw new Error(
        "La cuenta por cobrar solo aplica para notas credito de cliente"
      );
    }

    if (!referenciaDocumentoNormalizada && !documentoRelacionadoId) {
      throw new Error(
        "Debes registrar una referencia del documento o cuenta por cobrar relacionada"
      );
    }

    documentoRelacionadoNumero = referenciaDocumentoNormalizada;
  } else if (
    documentoRelacionadoTipo === ContableNotaCreditoDocumentoTipo.OTRO
  ) {
    if (!referenciaDocumentoNormalizada && !documentoRelacionadoId) {
      throw new Error(
        "Debes registrar una referencia cuando indiques otro documento relacionado"
      );
    }

    documentoRelacionadoNumero = referenciaDocumentoNormalizada;
  }

  const carteraState = buildCarteraState(
    referenciaDocumentoNormalizada,
    documentoRelacionadoId
  );

  return {
    id: nanoid(),
    numeroNota,
    terceroId,
    tipo,
    fecha,
    valor,
    motivo,
    referenciaDocumento: referenciaDocumentoNormalizada,
    observaciones,
    estado,
    documentoRelacionadoTipo,
    documentoRelacionadoId,
    documentoRelacionadoNumero,
    afectaCartera: carteraState.afectaCartera,
    carteraEstado: carteraState.carteraEstado,
  } satisfies BuiltContableNotaCredito;
}

function readCollectionFilters(urlValue?: string): ContableNotaCreditoFilters {
  const params = getSearchParams(urlValue);
  const q = readString(params.get("q") ?? undefined);
  const terceroId = readString(params.get("terceroId") ?? undefined);
  const estado = readString(params.get("estado") ?? undefined);
  const tipo = readString(params.get("tipo") ?? undefined);

  return {
    ...(q ? { q } : {}),
    ...(terceroId ? { terceroId } : {}),
    ...(estado && NOTA_CREDITO_ESTADOS.has(estado as ContableNotaCredito["estado"])
      ? { estado: estado as ContableNotaCredito["estado"] }
      : {}),
    ...(tipo && NOTA_CREDITO_TIPOS.has(tipo as ContableNotaCredito["tipo"])
      ? { tipo: tipo as ContableNotaCredito["tipo"] }
      : {}),
  };
}

async function listContableNotasCredito(
  filters: ContableNotaCreditoFilters = {}
) {
  const sql = getSql();
  const whereClauses: string[] = [];
  const params: Array<string> = [];

  if (filters.q) {
    params.push(`%${filters.q}%`);
    whereClauses.push(`(
      n.numero_nota ILIKE $${params.length}
      OR t.nombre_razon_social ILIKE $${params.length}
      OR t.documento_nit ILIKE $${params.length}
      OR COALESCE(n.referencia_documento, '') ILIKE $${params.length}
      OR n.motivo ILIKE $${params.length}
    )`);
  }

  if (filters.estado) {
    params.push(filters.estado);
    whereClauses.push(`n.estado = $${params.length}`);
  }

  if (filters.tipo) {
    params.push(filters.tipo);
    whereClauses.push(`n.tipo = $${params.length}`);
  }

  if (filters.terceroId) {
    params.push(filters.terceroId);
    whereClauses.push(`n.tercero_id = $${params.length}`);
  }

  const query = `
    SELECT
      n.id,
      n.numero_nota,
      n.tercero_id,
      t.nombre_razon_social AS tercero_nombre_razon_social,
      t.documento_nit AS tercero_documento_nit,
      n.tipo,
      n.fecha,
      n.valor,
      n.motivo,
      n.referencia_documento,
      n.observaciones,
      n.estado,
      n.documento_relacionado_tipo,
      n.documento_relacionado_id,
      n.documento_relacionado_numero,
      n.afecta_cartera,
      n.cartera_estado,
      n.created_at,
      n.updated_at
    FROM contable_notas_credito n
    INNER JOIN contable_terceros t ON t.id = n.tercero_id
    ${whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : ""}
    ORDER BY n.fecha DESC, n.created_at DESC
  `;

  const rows = (await sql.query(query, params)) as ContableNotaCreditoRow[];
  return rows.map(mapContableNotaCreditoRow);
}

async function findContableNotaCreditoById(id: string) {
  const sql = getSql();
  const rows = (await sql`
    SELECT
      n.id,
      n.numero_nota,
      n.tercero_id,
      t.nombre_razon_social AS tercero_nombre_razon_social,
      t.documento_nit AS tercero_documento_nit,
      n.tipo,
      n.fecha,
      n.valor,
      n.motivo,
      n.referencia_documento,
      n.observaciones,
      n.estado,
      n.documento_relacionado_tipo,
      n.documento_relacionado_id,
      n.documento_relacionado_numero,
      n.afecta_cartera,
      n.cartera_estado,
      n.created_at,
      n.updated_at
    FROM contable_notas_credito n
    INNER JOIN contable_terceros t ON t.id = n.tercero_id
    WHERE n.id = ${id}
    LIMIT 1
  `) as ContableNotaCreditoRow[];

  return rows[0] ? mapContableNotaCreditoRow(rows[0]) : null;
}

async function insertContableNotaCredito(payload: unknown) {
  const sql = getSql();
  const notaCredito = await buildContableNotaCredito(payload);

  try {
    await sql`
      INSERT INTO contable_notas_credito (
        id,
        numero_nota,
        tercero_id,
        tipo,
        fecha,
        valor,
        motivo,
        referencia_documento,
        observaciones,
        estado,
        documento_relacionado_tipo,
        documento_relacionado_id,
        documento_relacionado_numero,
        afecta_cartera,
        cartera_estado,
        created_at,
        updated_at
      )
      VALUES (
        ${notaCredito.id},
        ${notaCredito.numeroNota},
        ${notaCredito.terceroId},
        ${notaCredito.tipo},
        ${notaCredito.fecha},
        ${notaCredito.valor},
        ${notaCredito.motivo},
        ${notaCredito.referenciaDocumento ?? null},
        ${notaCredito.observaciones ?? null},
        ${notaCredito.estado},
        ${notaCredito.documentoRelacionadoTipo ?? null},
        ${notaCredito.documentoRelacionadoId ?? null},
        ${notaCredito.documentoRelacionadoNumero ?? null},
        ${notaCredito.afectaCartera},
        ${notaCredito.carteraEstado},
        NOW(),
        NOW()
      )
    `;

    const created = await findContableNotaCreditoById(notaCredito.id);

    if (!created) {
      throw new Error("No se pudo recuperar la nota credito creada");
    }

    return created;
  } catch (error) {
    throw normalizeDatabaseError(error);
  }
}

export function getContableNotaCreditoIdFromRequestUrl(urlValue?: string) {
  const match = getPathname(urlValue).match(
    /^\/api\/contable\/notas-credito\/([^/]+)\/?$/
  );

  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

export async function handleContableNotasCreditoCollection(
  req: NodeRequest,
  res: ServerResponse
) {
  try {
    if (req.method === "GET") {
      const notasCredito = await listContableNotasCredito(
        readCollectionFilters(req.url)
      );
      sendJson(res, 200, notasCredito);
      return;
    }

    if (req.method === "POST") {
      const payload = await readJsonBody(req);
      const notaCredito = await insertContableNotaCredito(payload);
      sendJson(res, 201, notaCredito);
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
      "No se pudo procesar la nota credito"
    );

    sendErrorJson(
      res,
      statusCode,
      statusCode === 409
        ? "Conflicto al guardar la nota credito"
        : statusCode === 400
          ? "Solicitud invalida"
          : "Error interno",
      detail
    );
  }
}

export async function handleContableNotaCreditoItem(
  req: NodeRequest,
  res: ServerResponse,
  id: string
) {
  try {
    if (req.method === "GET") {
      const notaCredito = await findContableNotaCreditoById(id);

      if (!notaCredito) {
        sendErrorJson(
          res,
          404,
          "Nota credito no encontrada",
          `No existe una nota credito con id ${id}`
        );
        return;
      }

      sendJson(res, 200, notaCredito);
      return;
    }

    sendMethodNotAllowed(res, ["GET"]);
  } catch (error) {
    const detail = getErrorMessage(error, "No se pudo consultar la nota credito");

    sendErrorJson(res, 500, "Error interno", detail);
  }
}

export function createContableNotasCreditoDevMiddleware() {
  return (req: NodeRequest, res: ServerResponse, next: ConnectNext) => {
    const pathname = getPathname(req.url);

    if (
      pathname === "/api/contable/notas-credito" ||
      pathname === "/api/contable/notas-credito/"
    ) {
      void handleContableNotasCreditoCollection(req, res).catch(next);
      return;
    }

    const notaCreditoId = getContableNotaCreditoIdFromRequestUrl(req.url);

    if (notaCreditoId) {
      void handleContableNotaCreditoItem(req, res, notaCreditoId).catch(next);
      return;
    }

    next();
  };
}
