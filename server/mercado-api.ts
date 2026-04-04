import type { IncomingMessage, ServerResponse } from "node:http";
import {
  InventarioProductoEstado,
  InventarioProductoTipoItem,
  MercadoDisponibilidadTipo,
  type InventarioProducto,
} from "../client/src/lib/types.js";
import { requireAuthenticatedRequest } from "./auth-api.js";
import type { ActiveUserRole } from "./access-control.js";
import { getSql } from "./neon.js";

type NodeRequest = IncomingMessage & {
  body?: unknown;
};

type ConnectNext = (error?: unknown) => void;

type InventarioProductoApiRecord = Omit<
  InventarioProducto,
  "createdAt" | "updatedAt"
> & {
  createdAt: string;
  updatedAt: string;
};

type MercadoBootstrapDataApiRecord = {
  productos: InventarioProductoApiRecord[];
  puedeAdministrar: boolean;
  whatsappNumeroConfigurado: boolean;
};

type ProductoRow = {
  id: string;
  tipo_item: InventarioProductoTipoItem;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  categoria: string;
  marca: string | null;
  modelo: string | null;
  serial: string | null;
  maneja_serial: boolean;
  unidad: string;
  costo: number | string;
  precio: number | string;
  stock_actual: number | string;
  estado: InventarioProductoEstado;
  visible_en_mercado: boolean;
  tipo_disponibilidad: MercadoDisponibilidadTipo;
  imagen_url: string | null;
  referencia_externa_tipo: string | null;
  referencia_externa_id: string | null;
  created_at: string | Date;
  updated_at: string | Date;
};

type MercadoProductoPayload = {
  descripcion?: unknown;
  imagenUrl?: unknown;
  precio?: unknown;
  tipoDisponibilidad?: unknown;
  visibleEnMercado?: unknown;
};

type BuiltMercadoProductoUpdate = {
  descripcion?: string;
  imagenUrl?: string;
  precio: number;
  tipoDisponibilidad: MercadoDisponibilidadTipo;
  visibleEnMercado: boolean;
};

type AuthenticatedMarketUser = {
  id: string;
  rol: ActiveUserRole;
};

const MERCADO_DISPONIBILIDADES = new Set<MercadoDisponibilidadTipo>([
  MercadoDisponibilidadTipo.STOCK,
  MercadoDisponibilidadTipo.BAJO_PEDIDO,
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

function readOptionalString(value: unknown) {
  return readString(value);
}

function readBoolean(value: unknown, fallback = false) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();

    if (["true", "1", "si", "yes"].includes(normalized)) {
      return true;
    }

    if (["false", "0", "no"].includes(normalized)) {
      return false;
    }
  }

  return fallback;
}

function readNumber(value: unknown, fallback = Number.NaN) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim();

    if (!normalized) {
      return fallback;
    }

    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  return fallback;
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function formatTimestampValue(value: string | Date) {
  const date = value instanceof Date ? new Date(value) : new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error("Fecha invalida en la base de datos");
  }

  return date.toISOString();
}

function canManageMercado(role: ActiveUserRole) {
  return role === "admin" || role === "comercial" || role === "inventario";
}

function hasOwnProperty(
  value: Record<string, unknown>,
  key: keyof MercadoProductoPayload
) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function mapProductoRow(row: ProductoRow): InventarioProductoApiRecord {
  return {
    categoria: row.categoria,
    codigo: row.codigo,
    costo: Number(row.costo),
    createdAt: formatTimestampValue(row.created_at),
    descripcion: row.descripcion ?? undefined,
    estado: row.estado,
    id: row.id,
    imagenUrl: row.imagen_url ?? undefined,
    manejaSerial: row.maneja_serial,
    marca: row.marca ?? undefined,
    modelo: row.modelo ?? undefined,
    nombre: row.nombre,
    precio: Number(row.precio),
    referenciaExternaId: row.referencia_externa_id ?? undefined,
    referenciaExternaTipo: row.referencia_externa_tipo ?? undefined,
    serial: row.serial ?? undefined,
    stockActual: Number(row.stock_actual),
    tipoDisponibilidad: row.tipo_disponibilidad,
    tipoItem: row.tipo_item,
    unidad: row.unidad,
    updatedAt: formatTimestampValue(row.updated_at),
    visibleEnMercado: row.visible_en_mercado,
  };
}

function buildMarketSegments(pathname: string) {
  if (pathname === "/api/mercado" || pathname === "/api/mercado/") {
    return [] as string[];
  }

  if (!pathname.startsWith("/api/mercado/")) {
    return null;
  }

  return pathname
    .slice("/api/mercado/".length)
    .split("/")
    .filter(Boolean);
}

async function listMercadoProductos(
  currentUser: AuthenticatedMarketUser,
  query?: URLSearchParams
) {
  const sql = getSql();
  const whereClauses = ["1 = 1"];
  const params: unknown[] = [];
  const canManage = canManageMercado(currentUser.rol);
  const q = readString(query?.get("q"));
  const visibilidad = readString(query?.get("visibilidad"));

  if (!canManage) {
    whereClauses.push(`visible_en_mercado = TRUE`);
    whereClauses.push(`estado = 'activo'`);
  } else if (visibilidad === "visibles") {
    whereClauses.push(`visible_en_mercado = TRUE`);
  } else if (visibilidad === "ocultos") {
    whereClauses.push(`visible_en_mercado = FALSE`);
  }

  if (q) {
    params.push(`%${q}%`);
    whereClauses.push(`(
      codigo ILIKE $${params.length}
      OR nombre ILIKE $${params.length}
      OR COALESCE(descripcion, '') ILIKE $${params.length}
      OR categoria ILIKE $${params.length}
      OR COALESCE(marca, '') ILIKE $${params.length}
      OR COALESCE(modelo, '') ILIKE $${params.length}
    )`);
  }

  const rows = (await sql.query(
    `
      SELECT
        id,
        tipo_item,
        codigo,
        nombre,
        descripcion,
        categoria,
        marca,
        modelo,
        serial,
        maneja_serial,
        unidad,
        costo,
        precio,
        stock_actual,
        estado,
        visible_en_mercado,
        tipo_disponibilidad,
        imagen_url,
        referencia_externa_tipo,
        referencia_externa_id,
        created_at,
        updated_at
      FROM inventario_productos
      WHERE ${whereClauses.join(" AND ")}
      ORDER BY
        visible_en_mercado DESC,
        updated_at DESC,
        nombre ASC
    `,
    params
  )) as ProductoRow[];

  return rows.map(mapProductoRow);
}

async function getMercadoProductoById(
  currentUser: AuthenticatedMarketUser,
  productoId: string
) {
  const sql = getSql();
  const canManage = canManageMercado(currentUser.rol);
  const rows = (await sql`
    SELECT
      id,
      tipo_item,
      codigo,
      nombre,
      descripcion,
      categoria,
      marca,
      modelo,
      serial,
      maneja_serial,
      unidad,
      costo,
      precio,
      stock_actual,
      estado,
      visible_en_mercado,
      tipo_disponibilidad,
      imagen_url,
      referencia_externa_tipo,
      referencia_externa_id,
      created_at,
      updated_at
    FROM inventario_productos
    WHERE id = ${productoId}
    LIMIT 1
  `) as ProductoRow[];

  const row = rows[0] ?? null;

  if (!row) {
    return null;
  }

  if (!canManage && (!row.visible_en_mercado || row.estado !== "activo")) {
    return null;
  }

  return mapProductoRow(row);
}

function buildMercadoProductoUpdate(
  payload: unknown,
  existing: InventarioProductoApiRecord
): BuiltMercadoProductoUpdate {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Cuerpo de solicitud invalido");
  }

  const data = payload as Record<string, unknown>;
  const precio = hasOwnProperty(data, "precio")
    ? roundMoney(readNumber(data.precio))
    : existing.precio;
  const visibleEnMercado = hasOwnProperty(data, "visibleEnMercado")
    ? readBoolean(data.visibleEnMercado, existing.visibleEnMercado)
    : existing.visibleEnMercado;
  const tipoDisponibilidad = hasOwnProperty(data, "tipoDisponibilidad")
    ? ((readString(data.tipoDisponibilidad) as MercadoDisponibilidadTipo | undefined) ??
      existing.tipoDisponibilidad)
    : existing.tipoDisponibilidad;
  const descripcion = hasOwnProperty(data, "descripcion")
    ? readOptionalString(data.descripcion)
    : existing.descripcion;
  const imagenUrl = hasOwnProperty(data, "imagenUrl")
    ? readOptionalString(data.imagenUrl)
    : existing.imagenUrl;

  if (!Number.isFinite(precio) || precio < 0) {
    throw new Error("El precio del producto es invalido");
  }

  if (!MERCADO_DISPONIBILIDADES.has(tipoDisponibilidad)) {
    throw new Error("La disponibilidad del producto es invalida");
  }

  return {
    descripcion,
    imagenUrl,
    precio,
    tipoDisponibilidad,
    visibleEnMercado,
  };
}

async function updateMercadoProducto(
  currentUser: AuthenticatedMarketUser,
  productoId: string,
  payload: unknown
) {
  const existing = await getMercadoProductoById(
    {
      ...currentUser,
      rol: canManageMercado(currentUser.rol) ? currentUser.rol : "admin",
    },
    productoId
  );

  if (!existing) {
    throw new Error("El producto solicitado no existe");
  }

  const input = buildMercadoProductoUpdate(payload, existing);
  const sql = getSql();
  const rows = (await sql`
    UPDATE inventario_productos
    SET
      descripcion = ${input.descripcion ?? null},
      precio = ${input.precio},
      visible_en_mercado = ${input.visibleEnMercado},
      tipo_disponibilidad = ${input.tipoDisponibilidad},
      imagen_url = ${input.imagenUrl ?? null},
      updated_at = NOW()
    WHERE id = ${productoId}
    RETURNING
      id,
      tipo_item,
      codigo,
      nombre,
      descripcion,
      categoria,
      marca,
      modelo,
      serial,
      maneja_serial,
      unidad,
      costo,
      precio,
      stock_actual,
      estado,
      visible_en_mercado,
      tipo_disponibilidad,
      imagen_url,
      referencia_externa_tipo,
      referencia_externa_id,
      created_at,
      updated_at
  `) as ProductoRow[];

  if (!rows[0]) {
    throw new Error("No se pudo recuperar el producto actualizado");
  }

  return mapProductoRow(rows[0]);
}

async function getMercadoBootstrapData(
  currentUser: AuthenticatedMarketUser
): Promise<MercadoBootstrapDataApiRecord> {
  const productos = await listMercadoProductos(currentUser);

  return {
    puedeAdministrar: canManageMercado(currentUser.rol),
    productos,
    whatsappNumeroConfigurado: Boolean(
      process.env.VITE_MERCADO_WHATSAPP_NUMERO?.trim() ||
        process.env.MERCADO_WHATSAPP_NUMERO?.trim()
    ),
  };
}

function isValidationError(error: unknown) {
  return (
    error instanceof Error &&
    /obligatorio|invalido|no existe|permiso|solicitud/i.test(error.message)
  );
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

export async function handleMercadoRoute(req: NodeRequest, res: ServerResponse) {
  const pathname = getPathname(req.url);
  const segments = buildMarketSegments(pathname);

  if (segments === null) {
    sendErrorJson(
      res,
      404,
      "Ruta no encontrada",
      "La ruta de mercado agricola no existe"
    );
    return;
  }

  const currentUser = (await requireAuthenticatedRequest(
    req,
    res
  )) as AuthenticatedMarketUser | null;

  if (!currentUser) {
    return;
  }

  try {
    if (segments.length === 0) {
      if (req.method !== "GET") {
        sendMethodNotAllowed(res, ["GET"]);
        return;
      }

      const data = await getMercadoBootstrapData(currentUser);
      sendJson(res, 200, data);
      return;
    }

    if (segments.length === 1 && segments[0] === "productos") {
      if (req.method !== "GET") {
        sendMethodNotAllowed(res, ["GET"]);
        return;
      }

      const data = await listMercadoProductos(currentUser, getSearchParams(req.url));
      sendJson(res, 200, data);
      return;
    }

    if (segments.length === 2 && segments[0] === "productos") {
      if (req.method === "GET") {
        const data = await getMercadoProductoById(currentUser, segments[1]);

        if (!data) {
          sendErrorJson(
            res,
            404,
            "Producto no encontrado",
            "El producto solicitado no esta disponible en mercado"
          );
          return;
        }

        sendJson(res, 200, data);
        return;
      }

      if (req.method === "PUT") {
        if (!canManageMercado(currentUser.rol)) {
          sendErrorJson(
            res,
            403,
            "Acceso denegado",
            "Tu rol no puede administrar productos de mercado"
          );
          return;
        }

        const payload = await readJsonBody(req);
        const data = await updateMercadoProducto(currentUser, segments[1], payload);
        sendJson(res, 200, data);
        return;
      }

      sendMethodNotAllowed(res, ["GET", "PUT"]);
      return;
    }

    sendErrorJson(
      res,
      404,
      "Ruta no encontrada",
      `La ruta de mercado "${pathname}" no existe`
    );
  } catch (error) {
    const statusCode = isValidationError(error) ? 400 : 500;

    sendErrorJson(
      res,
      statusCode,
      statusCode === 400 ? "Solicitud invalida" : "Error interno",
      getErrorMessage(error, "No se pudo procesar la solicitud de mercado")
    );
  }
}

export function createMercadoDevMiddleware() {
  return (req: NodeRequest, res: ServerResponse, next: ConnectNext) => {
    const pathname = getPathname(req.url);

    if (pathname === "/api/mercado" || pathname.startsWith("/api/mercado/")) {
      void handleMercadoRoute(req, res).catch(next);
      return;
    }

    next();
  };
}
