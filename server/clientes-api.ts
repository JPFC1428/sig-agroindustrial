import type { IncomingMessage, ServerResponse } from "node:http";
import { nanoid } from "nanoid";
import type { Cliente } from "../client/src/lib/types.js";
import { getSql } from "./neon.js";

type ClienteEstadoValue = Cliente["estado"];
type TipoClienteValue = Cliente["tipoCliente"];

type ClienteApiRecord = Omit<Cliente, "fechaRegistro" | "ultimaVisita"> & {
  fechaRegistro: string;
  ultimaVisita?: string;
};

type NodeRequest = IncomingMessage & {
  body?: unknown;
};

type ClienteRow = {
  id: string;
  nombre: string;
  empresa: string;
  email: string;
  telefono: string;
  ciudad: string;
  departamento: string;
  direccion: string;
  estado: ClienteEstadoValue;
  tipo_cliente: TipoClienteValue;
  nit: string | null;
  contacto_principal: string;
  cargo_contacto: string;
  fecha_registro: string | Date;
  ultima_visita: string | Date | null;
  total_compras: number | string;
  monto_total_compras: number | string;
  notas: string | null;
};

type ConnectNext = (error?: unknown) => void;

const CLIENTE_ESTADOS = new Set<ClienteEstadoValue>([
  "activo",
  "inactivo",
  "suspendido",
] as ClienteEstadoValue[]);

const TIPO_CLIENTE_VALUES = new Set<TipoClienteValue>([
  "empresa",
  "persona",
] as TipoClienteValue[]);

const CLIENTES_API_LOG_PREFIX = "[server/clientes-api]";

function logClientesInfo(message: string, metadata?: Record<string, unknown>) {
  if (metadata) {
    console.info(CLIENTES_API_LOG_PREFIX, message, metadata);
    return;
  }

  console.info(CLIENTES_API_LOG_PREFIX, message);
}

function logClientesError(
  message: string,
  error: unknown,
  metadata?: Record<string, unknown>
) {
  console.error(CLIENTES_API_LOG_PREFIX, message, {
    ...(metadata ?? {}),
    detail: getErrorMessage(error, "Error desconocido"),
    ...(error instanceof Error && error.stack ? { stack: error.stack } : {}),
  });
}

function getPayloadKeys(payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return [];
  }

  return Object.keys(payload as Record<string, unknown>);
}

function readString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function readOptionalString(
  value: unknown,
  fallback?: string
): string | undefined {
  if (value === undefined) {
    return fallback;
  }

  if (value === null) {
    return undefined;
  }

  return readString(value);
}

function readNumber(value: unknown, fallback: number): number {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  const numberValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
}

function readDate(
  value: string | Date | null | undefined,
  fallback: Date | undefined
): Date | undefined {
  if (value === undefined) {
    return fallback;
  }

  if (value === null || value === "") {
    return undefined;
  }

  const date = value instanceof Date ? new Date(value) : new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date;
}

function assertPayload(
  payload: unknown
): asserts payload is Record<string, unknown> {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Cuerpo de solicitud invalido");
  }
}

function parseDateValue(value: string | Date): Date {
  const parsed = value instanceof Date ? new Date(value) : new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Fecha invalida en la base de datos");
  }

  return parsed;
}

function mapClienteRow(row: ClienteRow): ClienteApiRecord {
  try {
    const fechaRegistro = parseDateValue(row.fecha_registro);
    const ultimaVisita = row.ultima_visita
      ? parseDateValue(row.ultima_visita)
      : undefined;

    return {
      id: row.id,
      nombre: row.nombre,
      empresa: row.empresa,
      email: row.email ?? "",
      telefono: row.telefono ?? "",
      ciudad: row.ciudad,
      departamento: row.departamento ?? "",
      direccion: row.direccion ?? "",
      estado: row.estado,
      tipoCliente: row.tipo_cliente,
      nit: row.nit ?? undefined,
      contactoPrincipal: row.contacto_principal ?? "",
      cargoContacto: row.cargo_contacto ?? "",
      fechaRegistro: fechaRegistro.toISOString(),
      ...(ultimaVisita ? { ultimaVisita: ultimaVisita.toISOString() } : {}),
      totalCompras: readNumber(row.total_compras, 0),
      montoTotalCompras: readNumber(row.monto_total_compras, 0),
      notas: row.notas ?? undefined,
    };
  } catch (error) {
    logClientesError("mapClienteRow:error", error, { id: row.id });
    throw error;
  }
}

function buildCliente(payload: unknown, existing?: ClienteApiRecord) {
  logClientesInfo("buildCliente:start", {
    existingId: existing?.id ?? null,
    payloadKeys: getPayloadKeys(payload),
  });

  try {
    assertPayload(payload);

    const nombre = readString(payload.nombre) ?? existing?.nombre ?? "";
    const empresa = readString(payload.empresa) ?? existing?.empresa ?? "";
    const email = readOptionalString(payload.email, existing?.email) ?? "";
    const telefono =
      readOptionalString(payload.telefono, existing?.telefono) ?? "";
    const ciudad = readString(payload.ciudad) ?? existing?.ciudad ?? "";
    const departamento =
      readOptionalString(payload.departamento, existing?.departamento) ?? "";
    const direccion =
      readOptionalString(payload.direccion, existing?.direccion) ?? "";
    const contactoPrincipal =
      readOptionalString(
        payload.contactoPrincipal,
        existing?.contactoPrincipal
      ) ?? "";
    const cargoContacto =
      readOptionalString(payload.cargoContacto, existing?.cargoContacto) ?? "";
    const tipoClienteRaw =
      readString(payload.tipoCliente) ?? existing?.tipoCliente ?? "empresa";
    const estadoRaw =
      readString(payload.estado) ?? existing?.estado ?? "activo";

    if (!nombre || !empresa || !ciudad) {
      throw new Error("Faltan campos obligatorios del cliente");
    }

    if (!email && !contactoPrincipal) {
      throw new Error("Debe indicar un contacto principal o un email");
    }

    if (
      !tipoClienteRaw ||
      !TIPO_CLIENTE_VALUES.has(tipoClienteRaw as TipoClienteValue)
    ) {
      throw new Error("Tipo de cliente invalido");
    }

    if (!CLIENTE_ESTADOS.has(estadoRaw as ClienteEstadoValue)) {
      throw new Error("Estado de cliente invalido");
    }

    const cliente = {
      id: existing?.id ?? `cli-${nanoid(8)}`,
      nombre,
      empresa,
      email,
      telefono,
      ciudad,
      departamento,
      direccion,
      estado: estadoRaw as ClienteEstadoValue,
      tipoCliente: tipoClienteRaw as TipoClienteValue,
      nit: readOptionalString(payload.nit, existing?.nit),
      contactoPrincipal,
      cargoContacto,
      fechaRegistro:
        readDate(
          payload.fechaRegistro as string | Date | null | undefined,
          existing?.fechaRegistro ? new Date(existing.fechaRegistro) : undefined
        ) ?? new Date(),
      ultimaVisita: readDate(
        payload.ultimaVisita as string | Date | null | undefined,
        existing?.ultimaVisita ? new Date(existing.ultimaVisita) : undefined
      ),
      totalCompras: readNumber(
        payload.totalCompras,
        existing?.totalCompras ?? 0
      ),
      montoTotalCompras: readNumber(
        payload.montoTotalCompras,
        existing?.montoTotalCompras ?? 0
      ),
      notas: readOptionalString(payload.notas, existing?.notas),
    };

    logClientesInfo("buildCliente:success", {
      id: cliente.id,
      existingId: existing?.id ?? null,
    });

    return cliente;
  } catch (error) {
    logClientesError("buildCliente:error", error, {
      existingId: existing?.id ?? null,
      payloadKeys: getPayloadKeys(payload),
    });
    throw error;
  }
}

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

function sendEmpty(res: ServerResponse, statusCode = 204): void {
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
  logClientesInfo("readJsonBody:start", {
    method: req.method,
    url: req.url,
    bodyType: Buffer.isBuffer(req.body) ? "buffer" : typeof req.body,
  });

  try {
    if (typeof req.body === "string") {
      return req.body.trim() ? JSON.parse(req.body) : {};
    }

    if (Buffer.isBuffer(req.body)) {
      const rawBufferBody = req.body.toString("utf-8").trim();
      return rawBufferBody ? JSON.parse(rawBufferBody) : {};
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
  } catch (error) {
    logClientesError("readJsonBody:error", error, {
      method: req.method,
      url: req.url,
    });
    throw error;
  }
}

function getPathname(urlValue?: string) {
  return new URL(urlValue ?? "/", "http://localhost").pathname;
}

export function getClienteIdFromRequestUrl(urlValue?: string) {
  const match = getPathname(urlValue).match(/^\/api\/clientes\/([^/]+)\/?$/);
  return match ? decodeURIComponent(match[1]) : null;
}

async function listClientes() {
  logClientesInfo("listClientes:start");

  try {
    const sql = getSql();
    const rows = (await sql`
      SELECT
        id,
        nombre,
        empresa,
        email,
        telefono,
        ciudad,
        departamento,
        direccion,
        estado,
        tipo_cliente,
        nit,
        contacto_principal,
        cargo_contacto,
        fecha_registro,
        ultima_visita,
        total_compras,
        monto_total_compras,
        notas
      FROM clientes
      ORDER BY fecha_registro DESC, id DESC
    `) as ClienteRow[];

    logClientesInfo("listClientes:success", { count: rows.length });
    return rows.map(mapClienteRow);
  } catch (error) {
    logClientesError("listClientes:error", error);
    throw error;
  }
}

async function findClienteById(id: string) {
  logClientesInfo("findClienteById:start", { id });

  try {
    const sql = getSql();
    const rows = (await sql`
      SELECT
        id,
        nombre,
        empresa,
        email,
        telefono,
        ciudad,
        departamento,
        direccion,
        estado,
        tipo_cliente,
        nit,
        contacto_principal,
        cargo_contacto,
        fecha_registro,
        ultima_visita,
        total_compras,
        monto_total_compras,
        notas
      FROM clientes
      WHERE id = ${id}
      LIMIT 1
    `) as ClienteRow[];

    logClientesInfo("findClienteById:success", {
      id,
      found: rows.length > 0,
    });
    return rows[0] ? mapClienteRow(rows[0]) : null;
  } catch (error) {
    logClientesError("findClienteById:error", error, { id });
    throw error;
  }
}

async function insertCliente(payload: unknown) {
  logClientesInfo("insertCliente:start", {
    payloadKeys: getPayloadKeys(payload),
  });

  try {
    const cliente = buildCliente(payload);
    const sql = getSql();
    const rows = (await sql`
      INSERT INTO clientes (
        id,
        nombre,
        empresa,
        email,
        telefono,
        ciudad,
        departamento,
        direccion,
        estado,
        tipo_cliente,
        nit,
        contacto_principal,
        cargo_contacto,
        fecha_registro,
        ultima_visita,
        total_compras,
        monto_total_compras,
        notas
      ) VALUES (
        ${cliente.id},
        ${cliente.nombre},
        ${cliente.empresa},
        ${cliente.email},
        ${cliente.telefono},
        ${cliente.ciudad},
        ${cliente.departamento},
        ${cliente.direccion},
        ${cliente.estado},
        ${cliente.tipoCliente},
        ${cliente.nit ?? null},
        ${cliente.contactoPrincipal},
        ${cliente.cargoContacto},
        ${cliente.fechaRegistro.toISOString()},
        ${cliente.ultimaVisita?.toISOString() ?? null},
        ${cliente.totalCompras},
        ${cliente.montoTotalCompras},
        ${cliente.notas ?? null}
      )
      RETURNING
        id,
        nombre,
        empresa,
        email,
        telefono,
        ciudad,
        departamento,
        direccion,
        estado,
        tipo_cliente,
        nit,
        contacto_principal,
        cargo_contacto,
        fecha_registro,
        ultima_visita,
        total_compras,
        monto_total_compras,
        notas
    `) as ClienteRow[];

    logClientesInfo("insertCliente:success", {
      id: rows[0]?.id ?? cliente.id,
    });
    return mapClienteRow(rows[0]);
  } catch (error) {
    logClientesError("insertCliente:error", error, {
      payloadKeys: getPayloadKeys(payload),
    });
    throw error;
  }
}

async function updateExistingCliente(id: string, payload: unknown) {
  logClientesInfo("updateExistingCliente:start", {
    id,
    payloadKeys: getPayloadKeys(payload),
  });

  try {
    const existing = await findClienteById(id);

    if (!existing) {
      logClientesInfo("updateExistingCliente:not-found", { id });
      return null;
    }

    const cliente = buildCliente(payload, existing);
    const sql = getSql();
    const rows = (await sql`
      UPDATE clientes
      SET
        nombre = ${cliente.nombre},
        empresa = ${cliente.empresa},
        email = ${cliente.email},
        telefono = ${cliente.telefono},
        ciudad = ${cliente.ciudad},
        departamento = ${cliente.departamento},
        direccion = ${cliente.direccion},
        estado = ${cliente.estado},
        tipo_cliente = ${cliente.tipoCliente},
        nit = ${cliente.nit ?? null},
        contacto_principal = ${cliente.contactoPrincipal},
        cargo_contacto = ${cliente.cargoContacto},
        fecha_registro = ${cliente.fechaRegistro.toISOString()},
        ultima_visita = ${cliente.ultimaVisita?.toISOString() ?? null},
        total_compras = ${cliente.totalCompras},
        monto_total_compras = ${cliente.montoTotalCompras},
        notas = ${cliente.notas ?? null},
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING
        id,
        nombre,
        empresa,
        email,
        telefono,
        ciudad,
        departamento,
        direccion,
        estado,
        tipo_cliente,
        nit,
        contacto_principal,
        cargo_contacto,
        fecha_registro,
        ultima_visita,
        total_compras,
        monto_total_compras,
        notas
    `) as ClienteRow[];

    logClientesInfo("updateExistingCliente:success", { id });
    return mapClienteRow(rows[0]);
  } catch (error) {
    logClientesError("updateExistingCliente:error", error, {
      id,
      payloadKeys: getPayloadKeys(payload),
    });
    throw error;
  }
}

async function removeCliente(id: string) {
  logClientesInfo("removeCliente:start", { id });

  try {
    const sql = getSql();
    const rows = (await sql`
      DELETE FROM clientes
      WHERE id = ${id}
      RETURNING id
    `) as Array<{ id: string }>;

    logClientesInfo("removeCliente:success", {
      id,
      deleted: rows.length > 0,
    });
    return rows.length > 0;
  } catch (error) {
    logClientesError("removeCliente:error", error, { id });
    throw error;
  }
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function isValidationError(error: unknown) {
  return (
    error instanceof Error &&
    /invalido|obligatorios|Debe indicar|Tipo de cliente|Estado de cliente/i.test(
      error.message
    )
  );
}

export async function handleClientesCollection(
  req: NodeRequest,
  res: ServerResponse
) {
  logClientesInfo("handleClientesCollection:start", {
    method: req.method,
    url: req.url,
  });

  try {
    if (req.method === "GET") {
      const clientes = await listClientes();
      sendJson(res, 200, clientes);
      logClientesInfo("handleClientesCollection:response", {
        method: req.method,
        url: req.url,
        statusCode: 200,
        count: clientes.length,
      });
      return;
    }

    if (req.method === "POST") {
      const payload = await readJsonBody(req);
      const cliente = await insertCliente(payload);
      sendJson(res, 201, cliente);
      logClientesInfo("handleClientesCollection:response", {
        method: req.method,
        url: req.url,
        statusCode: 201,
        id: cliente.id,
      });
      return;
    }

    sendMethodNotAllowed(res, ["GET", "POST"]);
  } catch (error) {
    const statusCode = isValidationError(error) ? 400 : 500;
    const detail = getErrorMessage(error, "No se pudo procesar la solicitud");

    logClientesError("handleClientesCollection:error", error, {
      method: req.method,
      url: req.url,
      statusCode,
    });

    sendErrorJson(
      res,
      statusCode,
      statusCode === 400
        ? "Solicitud invalida en /api/clientes"
        : "Error interno en /api/clientes",
      detail
    );
  }
}

export async function handleClienteItem(
  req: NodeRequest,
  res: ServerResponse,
  id: string
) {
  logClientesInfo("handleClienteItem:start", {
    method: req.method,
    url: req.url,
    id,
  });

  try {
    if (!id) {
      sendErrorJson(
        res,
        400,
        "Cliente invalido",
        "Se recibio un id vacio para /api/clientes/[id]"
      );
      return;
    }

    if (req.method === "GET") {
      const cliente = await findClienteById(id);

      if (!cliente) {
        sendErrorJson(
          res,
          404,
          "Cliente no encontrado",
          `No existe un cliente con id ${id}`
        );
        return;
      }

      sendJson(res, 200, cliente);
      logClientesInfo("handleClienteItem:response", {
        method: req.method,
        url: req.url,
        id,
        statusCode: 200,
      });
      return;
    }

    if (req.method === "PUT") {
      const payload = await readJsonBody(req);
      const cliente = await updateExistingCliente(id, payload);

      if (!cliente) {
        sendErrorJson(
          res,
          404,
          "Cliente no encontrado",
          `No existe un cliente con id ${id}`
        );
        return;
      }

      sendJson(res, 200, cliente);
      logClientesInfo("handleClienteItem:response", {
        method: req.method,
        url: req.url,
        id,
        statusCode: 200,
      });
      return;
    }

    if (req.method === "DELETE") {
      const deleted = await removeCliente(id);

      if (!deleted) {
        sendErrorJson(
          res,
          404,
          "Cliente no encontrado",
          `No existe un cliente con id ${id}`
        );
        return;
      }

      sendEmpty(res, 204);
      logClientesInfo("handleClienteItem:response", {
        method: req.method,
        url: req.url,
        id,
        statusCode: 204,
      });
      return;
    }

    sendMethodNotAllowed(res, ["GET", "PUT", "DELETE"]);
  } catch (error) {
    const statusCode = isValidationError(error) ? 400 : 500;
    const detail = getErrorMessage(error, "No se pudo procesar la solicitud");

    logClientesError("handleClienteItem:error", error, {
      method: req.method,
      url: req.url,
      id,
      statusCode,
    });

    sendErrorJson(
      res,
      statusCode,
      statusCode === 400
        ? "Solicitud invalida en /api/clientes/[id]"
        : "Error interno en /api/clientes/[id]",
      detail
    );
  }
}

export function createClientesDevMiddleware() {
  return (req: NodeRequest, res: ServerResponse, next: ConnectNext) => {
    const pathname = getPathname(req.url);

    if (pathname === "/api/clientes" || pathname === "/api/clientes/") {
      void handleClientesCollection(req, res).catch(next);
      return;
    }

    const clienteId = getClienteIdFromRequestUrl(req.url);

    if (clienteId) {
      void handleClienteItem(req, res, clienteId).catch(next);
      return;
    }

    next();
  };
}
