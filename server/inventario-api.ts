import type { IncomingMessage, ServerResponse } from "node:http";
import { nanoid } from "nanoid";
import {
  ContableTerceroEstado,
  ContableTerceroTipo,
  InventarioCompraEstado,
  InventarioEntradaOrigenTipo,
  InventarioProductoEstado,
  InventarioProductoTipoItem,
  MercadoDisponibilidadTipo,
  type ContableTercero,
  type InventarioCompra,
  type InventarioCompraItem,
  type InventarioDashboardData,
  type InventarioEntrada,
  type InventarioEntradaItem,
  type InventarioProducto,
} from "../client/src/lib/types.js";
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

type InventarioProductoApiRecord = Omit<
  InventarioProducto,
  "createdAt" | "updatedAt"
> & {
  createdAt: string;
  updatedAt: string;
};

type InventarioCompraItemApiRecord = InventarioCompraItem;

type InventarioCompraApiRecord = Omit<
  InventarioCompra,
  "fecha" | "createdAt" | "updatedAt" | "items"
> & {
  fecha: string;
  createdAt: string;
  updatedAt: string;
  items: InventarioCompraItemApiRecord[];
};

type InventarioEntradaItemApiRecord = InventarioEntradaItem;

type InventarioEntradaApiRecord = Omit<
  InventarioEntrada,
  "fecha" | "createdAt" | "updatedAt" | "items"
> & {
  fecha: string;
  createdAt: string;
  updatedAt: string;
  items: InventarioEntradaItemApiRecord[];
};

type InventarioDashboardDataApiRecord = {
  resumen: InventarioDashboardData["resumen"];
  comprasRecientes: InventarioCompraApiRecord[];
  entradasRecientes: InventarioEntradaApiRecord[];
  productosRecientes: InventarioProductoApiRecord[];
};

type ProveedorRow = {
  id: string;
  tipo_tercero: ContableTerceroTipo;
  nombre_razon_social: string;
  documento_nit: string;
  contacto: string | null;
  telefono: string | null;
  correo: string | null;
  ciudad: string | null;
  direccion: string | null;
  observaciones: string | null;
  estado: ContableTerceroEstado;
  created_at: string | Date;
  updated_at: string | Date;
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

type CompraHeaderRow = {
  id: string;
  numero_compra: string;
  proveedor_id: string;
  proveedor_nombre_razon_social: string;
  proveedor_documento_nit: string;
  fecha: string | Date;
  observaciones: string | null;
  estado: InventarioCompraEstado;
  total: number | string;
  created_at: string | Date;
  updated_at: string | Date;
};

type CompraItemRow = {
  id: string;
  compra_id: string;
  producto_id: string;
  producto_codigo: string;
  producto_nombre: string;
  descripcion: string;
  cantidad: number | string;
  costo_unitario: number | string;
  total: number | string;
  cantidad_recibida: number | string | null;
};

type EntradaHeaderRow = {
  id: string;
  numero_entrada: string;
  fecha: string | Date;
  origen_tipo: InventarioEntradaOrigenTipo;
  origen_id: string | null;
  compra_id: string | null;
  compra_numero: string | null;
  bodega_id: string | null;
  observaciones: string | null;
  total_items: number | string;
  total_costo: number | string;
  created_at: string | Date;
  updated_at: string | Date;
};

type EntradaItemRow = {
  id: string;
  entrada_id: string;
  producto_id: string;
  producto_codigo: string;
  producto_nombre: string;
  cantidad: number | string;
  costo_unitario: number | string;
  total: number | string;
  serial: string | null;
  compra_item_id: string | null;
};

type InventarioProductoPayload = {
  tipoItem?: unknown;
  codigo?: unknown;
  nombre?: unknown;
  descripcion?: unknown;
  categoria?: unknown;
  marca?: unknown;
  modelo?: unknown;
  serial?: unknown;
  manejaSerial?: unknown;
  unidad?: unknown;
  costo?: unknown;
  precio?: unknown;
  stockActual?: unknown;
  estado?: unknown;
  visibleEnMercado?: unknown;
  tipoDisponibilidad?: unknown;
  imagenUrl?: unknown;
  referenciaExternaTipo?: unknown;
  referenciaExternaId?: unknown;
};

type InventarioProveedorPayload = {
  nombreRazonSocial?: unknown;
  documentoNit?: unknown;
  contacto?: unknown;
  telefono?: unknown;
  correo?: unknown;
  ciudad?: unknown;
  direccion?: unknown;
  observaciones?: unknown;
  estado?: unknown;
};

type InventarioCompraItemPayload = {
  productoId?: unknown;
  descripcion?: unknown;
  cantidad?: unknown;
  costoUnitario?: unknown;
};

type InventarioCompraPayload = {
  proveedorId?: unknown;
  fecha?: unknown;
  observaciones?: unknown;
  items?: unknown;
};

type InventarioEntradaItemPayload = {
  productoId?: unknown;
  compraItemId?: unknown;
  cantidad?: unknown;
  costoUnitario?: unknown;
  serial?: unknown;
};

type InventarioEntradaPayload = {
  fecha?: unknown;
  origenTipo?: unknown;
  origenId?: unknown;
  compraId?: unknown;
  bodegaId?: unknown;
  observaciones?: unknown;
  items?: unknown;
};

type InventarioProductosFilters = {
  q?: string;
  estado?: InventarioProductoEstado;
  tipoItem?: InventarioProductoTipoItem;
  limit?: number;
};

type InventarioProveedoresFilters = {
  q?: string;
  estado?: ContableTerceroEstado;
  limit?: number;
};

type InventarioComprasFilters = {
  q?: string;
  estado?: InventarioCompraEstado;
  proveedorId?: string;
  limit?: number;
};

type InventarioEntradasFilters = {
  q?: string;
  origenTipo?: InventarioEntradaOrigenTipo;
  compraId?: string;
  limit?: number;
};

type BuiltProveedor = {
  id: string;
  nombreRazonSocial: string;
  documentoNit: string;
  contacto?: string;
  telefono?: string;
  correo?: string;
  ciudad?: string;
  direccion?: string;
  observaciones?: string;
  estado: ContableTerceroEstado;
};

type BuiltProducto = {
  id: string;
  tipoItem: InventarioProductoTipoItem;
  codigo: string;
  nombre: string;
  descripcion?: string;
  categoria: string;
  marca?: string;
  modelo?: string;
  serial?: string;
  manejaSerial: boolean;
  unidad: string;
  costo: number;
  precio: number;
  stockActual: number;
  estado: InventarioProductoEstado;
  visibleEnMercado: boolean;
  tipoDisponibilidad: MercadoDisponibilidadTipo;
  imagenUrl?: string;
  referenciaExternaTipo?: string;
  referenciaExternaId?: string;
};

type BuiltCompraItem = {
  id: string;
  productoId: string;
  descripcion: string;
  cantidad: number;
  costoUnitario: number;
  total: number;
};

type BuiltCompra = {
  id: string;
  numeroCompra: string;
  proveedorId: string;
  fecha: string;
  observaciones?: string;
  estado: InventarioCompraEstado;
  total: number;
  items: BuiltCompraItem[];
};

type BuiltEntradaItem = {
  id: string;
  productoId: string;
  compraItemId?: string;
  cantidad: number;
  costoUnitario: number;
  total: number;
  serial?: string;
};

type BuiltEntrada = {
  id: string;
  numeroEntrada: string;
  fecha: string;
  origenTipo: InventarioEntradaOrigenTipo;
  origenId?: string;
  compraId?: string;
  bodegaId?: string;
  observaciones?: string;
  totalItems: number;
  totalCosto: number;
  items: BuiltEntradaItem[];
};

const PRODUCTO_TIPOS = new Set<InventarioProductoTipoItem>([
  InventarioProductoTipoItem.PRODUCTO,
  InventarioProductoTipoItem.EQUIPO,
]);

const PRODUCTO_ESTADOS = new Set<InventarioProductoEstado>([
  InventarioProductoEstado.ACTIVO,
  InventarioProductoEstado.INACTIVO,
  InventarioProductoEstado.DESCONTINUADO,
]);

const MERCADO_DISPONIBILIDADES = new Set<MercadoDisponibilidadTipo>([
  MercadoDisponibilidadTipo.STOCK,
  MercadoDisponibilidadTipo.BAJO_PEDIDO,
]);

const PROVEEDOR_ESTADOS = new Set<ContableTerceroEstado>([
  ContableTerceroEstado.ACTIVO,
  ContableTerceroEstado.INACTIVO,
]);

const ENTRADA_ORIGENES = new Set<InventarioEntradaOrigenTipo>([
  InventarioEntradaOrigenTipo.MANUAL,
  InventarioEntradaOrigenTipo.COMPRA,
  InventarioEntradaOrigenTipo.AJUSTE,
  InventarioEntradaOrigenTipo.SERTEC,
  InventarioEntradaOrigenTipo.COMERCIAL,
  InventarioEntradaOrigenTipo.TRASLADO,
  InventarioEntradaOrigenTipo.GARANTIA,
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

function getInventoryResource(pathname: string) {
  const normalized = pathname.replace(/\/+$/, "");

  if (normalized === "/api/inventario") {
    return "";
  }

  if (normalized.startsWith("/api/inventario/")) {
    return normalized.slice("/api/inventario/".length);
  }

  return null;
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

function formatDateOnlyValue(value: string | Date) {
  if (typeof value === "string") {
    return value.slice(0, 10);
  }

  return value.toISOString().slice(0, 10);
}

function formatTimestampValue(value: string | Date) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function readDateOnly(value: unknown, fieldLabel: string) {
  const raw = readString(value);

  if (!raw) {
    throw new Error(`La fecha de ${fieldLabel} es obligatoria`);
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    throw new Error(`La fecha de ${fieldLabel} no es valida`);
  }

  return raw;
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function isValidationError(error: unknown) {
  return (
    error instanceof Error &&
    /obligatori|inval|debes|correo|proveedor|producto|compra|entrada|cantidad|costo|precio|stock|serial/i.test(
      error.message
    )
  );
}

function isConflictError(error: unknown) {
  return (
    error instanceof Error &&
    /duplicate key value|already exists|ya existe|unique/i.test(error.message)
  );
}

function normalizeDatabaseError(error: unknown) {
  if (
    error instanceof Error &&
    /inventario_productos_codigo_key|inventario_productos_codigo_unique/i.test(
      error.message
    )
  ) {
    return new Error("Ya existe un producto con ese codigo");
  }

  if (
    error instanceof Error &&
    /inventario_compras_numero_compra_key|inventario_entradas_numero_entrada_key/i.test(
      error.message
    )
  ) {
    return new Error("No se pudo generar un consecutivo unico. Intenta de nuevo");
  }

  if (
    error instanceof Error &&
    /contable_terceros_documento_nit_key|idx_contable_terceros_documento_nit_unique/i.test(
      error.message
    )
  ) {
    return new Error("Ya existe un proveedor con ese documento o NIT");
  }

  return error;
}

function mapProveedorRow(row: ProveedorRow): ContableTerceroApiRecord {
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
    createdAt: formatTimestampValue(row.created_at),
    updatedAt: formatTimestampValue(row.updated_at),
  };
}

function mapProductoRow(row: ProductoRow): InventarioProductoApiRecord {
  return {
    id: row.id,
    tipoItem: row.tipo_item,
    codigo: row.codigo,
    nombre: row.nombre,
    descripcion: row.descripcion ?? undefined,
    categoria: row.categoria,
    marca: row.marca ?? undefined,
    modelo: row.modelo ?? undefined,
    serial: row.serial ?? undefined,
    manejaSerial: row.maneja_serial,
    unidad: row.unidad,
    costo: Number(row.costo),
    precio: Number(row.precio),
    stockActual: Number(row.stock_actual),
    estado: row.estado,
    visibleEnMercado: row.visible_en_mercado,
    tipoDisponibilidad: row.tipo_disponibilidad,
    imagenUrl: row.imagen_url ?? undefined,
    referenciaExternaTipo: row.referencia_externa_tipo ?? undefined,
    referenciaExternaId: row.referencia_externa_id ?? undefined,
    createdAt: formatTimestampValue(row.created_at),
    updatedAt: formatTimestampValue(row.updated_at),
  };
}

function mapCompraItemRow(row: CompraItemRow): InventarioCompraItemApiRecord {
  const cantidad = Number(row.cantidad);
  const cantidadRecibida = Number(row.cantidad_recibida ?? 0);

  return {
    id: row.id,
    compraId: row.compra_id,
    productoId: row.producto_id,
    productoCodigo: row.producto_codigo,
    productoNombre: row.producto_nombre,
    descripcion: row.descripcion,
    cantidad,
    costoUnitario: Number(row.costo_unitario),
    total: Number(row.total),
    cantidadRecibida,
    pendienteRecibir: roundMoney(Math.max(cantidad - cantidadRecibida, 0)),
  };
}

function mapEntradaItemRow(row: EntradaItemRow): InventarioEntradaItemApiRecord {
  return {
    id: row.id,
    entradaId: row.entrada_id,
    productoId: row.producto_id,
    productoCodigo: row.producto_codigo,
    productoNombre: row.producto_nombre,
    cantidad: Number(row.cantidad),
    costoUnitario: Number(row.costo_unitario),
    total: Number(row.total),
    serial: row.serial ?? undefined,
    compraItemId: row.compra_item_id ?? undefined,
  };
}

function groupCompras(
  headerRows: CompraHeaderRow[],
  itemRows: CompraItemRow[]
): InventarioCompraApiRecord[] {
  const itemsByCompraId = new Map<string, InventarioCompraItemApiRecord[]>();

  for (const row of itemRows) {
    const current = itemsByCompraId.get(row.compra_id) ?? [];
    current.push(mapCompraItemRow(row));
    itemsByCompraId.set(row.compra_id, current);
  }

  return headerRows.map(row => ({
    id: row.id,
    numeroCompra: row.numero_compra,
    proveedorId: row.proveedor_id,
    proveedorNombreRazonSocial: row.proveedor_nombre_razon_social,
    proveedorDocumentoNit: row.proveedor_documento_nit,
    fecha: formatDateOnlyValue(row.fecha),
    observaciones: row.observaciones ?? undefined,
    estado: row.estado,
    total: Number(row.total),
    items: itemsByCompraId.get(row.id) ?? [],
    createdAt: formatTimestampValue(row.created_at),
    updatedAt: formatTimestampValue(row.updated_at),
  }));
}

function groupEntradas(
  headerRows: EntradaHeaderRow[],
  itemRows: EntradaItemRow[]
): InventarioEntradaApiRecord[] {
  const itemsByEntradaId = new Map<string, InventarioEntradaItemApiRecord[]>();

  for (const row of itemRows) {
    const current = itemsByEntradaId.get(row.entrada_id) ?? [];
    current.push(mapEntradaItemRow(row));
    itemsByEntradaId.set(row.entrada_id, current);
  }

  return headerRows.map(row => ({
    id: row.id,
    numeroEntrada: row.numero_entrada,
    fecha: formatDateOnlyValue(row.fecha),
    origenTipo: row.origen_tipo,
    origenId: row.origen_id ?? undefined,
    compraId: row.compra_id ?? undefined,
    compraNumero: row.compra_numero ?? undefined,
    bodegaId: row.bodega_id ?? undefined,
    observaciones: row.observaciones ?? undefined,
    totalItems: Number(row.total_items),
    totalCosto: Number(row.total_costo),
    items: itemsByEntradaId.get(row.id) ?? [],
    createdAt: formatTimestampValue(row.created_at),
    updatedAt: formatTimestampValue(row.updated_at),
  }));
}

async function listInventarioProveedores(
  filters: InventarioProveedoresFilters = {}
) {
  const sql = getSql();
  const whereClauses = [`tipo_tercero = 'proveedor'`];
  const params: unknown[] = [];

  if (filters.estado) {
    params.push(filters.estado);
    whereClauses.push(`estado = $${params.length}`);
  }

  if (filters.q) {
    params.push(`%${filters.q}%`);
    whereClauses.push(`(
      nombre_razon_social ILIKE $${params.length}
      OR documento_nit ILIKE $${params.length}
      OR COALESCE(contacto, '') ILIKE $${params.length}
      OR COALESCE(ciudad, '') ILIKE $${params.length}
    )`);
  }

  let query = `
    SELECT
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
    FROM contable_terceros
    WHERE ${whereClauses.join(" AND ")}
    ORDER BY nombre_razon_social ASC
  `;

  if (filters.limit) {
    params.push(filters.limit);
    query += ` LIMIT $${params.length}`;
  }

  const rows = (await sql.query(query, params)) as ProveedorRow[];
  return rows.map(mapProveedorRow);
}

async function findProveedorById(id: string) {
  const sql = getSql();
  const rows = (await sql`
    SELECT
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
    FROM contable_terceros
    WHERE id = ${id}
      AND tipo_tercero = ${ContableTerceroTipo.PROVEEDOR}
    LIMIT 1
  `) as ProveedorRow[];

  return rows[0] ? mapProveedorRow(rows[0]) : null;
}

function validateEmail(email: string | undefined) {
  if (!email) {
    return;
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("El correo del proveedor no es valido");
  }
}

function buildProveedor(payload: unknown): BuiltProveedor {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Cuerpo de solicitud invalido");
  }

  const data = payload as InventarioProveedorPayload;
  const nombreRazonSocial = readString(data.nombreRazonSocial) ?? "";
  const documentoNit = readString(data.documentoNit) ?? "";
  const contacto = readOptionalString(data.contacto);
  const telefono = readOptionalString(data.telefono);
  const correo = readOptionalString(data.correo)?.toLowerCase();
  const ciudad = readOptionalString(data.ciudad);
  const direccion = readOptionalString(data.direccion);
  const observaciones = readOptionalString(data.observaciones);
  const estado =
    (readString(data.estado) as ContableTerceroEstado | undefined) ??
    ContableTerceroEstado.ACTIVO;

  if (!nombreRazonSocial) {
    throw new Error("El nombre o razon social del proveedor es obligatorio");
  }

  if (!documentoNit) {
    throw new Error("El documento o NIT del proveedor es obligatorio");
  }

  if (!PROVEEDOR_ESTADOS.has(estado)) {
    throw new Error("El estado del proveedor es invalido");
  }

  validateEmail(correo);

  return {
    id: `ter-${nanoid(8)}`,
    nombreRazonSocial,
    documentoNit,
    contacto,
    telefono,
    correo,
    ciudad,
    direccion,
    observaciones,
    estado,
  };
}

async function insertInventarioProveedor(payload: unknown) {
  const proveedor = buildProveedor(payload);
  const sql = getSql();

  try {
    await sql`
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
        ${proveedor.id},
        ${ContableTerceroTipo.PROVEEDOR},
        ${proveedor.nombreRazonSocial},
        ${proveedor.documentoNit},
        ${proveedor.contacto ?? null},
        ${proveedor.telefono ?? null},
        ${proveedor.correo ?? null},
        ${proveedor.ciudad ?? null},
        ${proveedor.direccion ?? null},
        ${proveedor.observaciones ?? null},
        ${proveedor.estado},
        NOW(),
        NOW()
      )
    `;

    const created = await findProveedorById(proveedor.id);

    if (!created) {
      throw new Error("No se pudo recuperar el proveedor creado");
    }

    return created;
  } catch (error) {
    throw normalizeDatabaseError(error);
  }
}

async function listInventarioProductos(
  filters: InventarioProductosFilters = {}
) {
  const sql = getSql();
  const whereClauses = ["1 = 1"];
  const params: unknown[] = [];

  if (filters.estado) {
    params.push(filters.estado);
    whereClauses.push(`estado = $${params.length}`);
  }

  if (filters.tipoItem) {
    params.push(filters.tipoItem);
    whereClauses.push(`tipo_item = $${params.length}`);
  }

  if (filters.q) {
    params.push(`%${filters.q}%`);
    whereClauses.push(`(
      codigo ILIKE $${params.length}
      OR nombre ILIKE $${params.length}
      OR categoria ILIKE $${params.length}
      OR COALESCE(marca, '') ILIKE $${params.length}
      OR COALESCE(modelo, '') ILIKE $${params.length}
    )`);
  }

  let query = `
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
    ORDER BY created_at DESC, nombre ASC
  `;

  if (filters.limit) {
    params.push(filters.limit);
    query += ` LIMIT $${params.length}`;
  }

  const rows = (await sql.query(query, params)) as ProductoRow[];
  return rows.map(mapProductoRow);
}

async function listInventarioProductosByIds(ids: string[]) {
  if (ids.length === 0) {
    return [];
  }

  const sql = getSql();
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
      WHERE id = ANY($1::text[])
    `,
    [ids]
  )) as ProductoRow[];

  return rows.map(mapProductoRow);
}

function buildProducto(payload: unknown): BuiltProducto {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Cuerpo de solicitud invalido");
  }

  const data = payload as InventarioProductoPayload;
  const tipoItem =
    (readString(data.tipoItem) as InventarioProductoTipoItem | undefined) ??
    InventarioProductoTipoItem.PRODUCTO;
  const codigo = readString(data.codigo)?.toUpperCase() ?? "";
  const nombre = readString(data.nombre) ?? "";
  const descripcion = readOptionalString(data.descripcion);
  const categoria = readString(data.categoria) ?? "";
  const marca = readOptionalString(data.marca);
  const modelo = readOptionalString(data.modelo);
  const serial = readOptionalString(data.serial);
  const unidad = readString(data.unidad) ?? "";
  const costo = roundMoney(readNumber(data.costo));
  const precio = roundMoney(readNumber(data.precio));
  const stockActual = roundMoney(readNumber(data.stockActual, 0));
  const estado =
    (readString(data.estado) as InventarioProductoEstado | undefined) ??
    InventarioProductoEstado.ACTIVO;
  const visibleEnMercado = readBoolean(data.visibleEnMercado, false);
  const tipoDisponibilidad =
    (readString(data.tipoDisponibilidad) as MercadoDisponibilidadTipo | undefined) ??
    MercadoDisponibilidadTipo.STOCK;
  const imagenUrl = readOptionalString(data.imagenUrl);
  const referenciaExternaTipo = readOptionalString(data.referenciaExternaTipo);
  const referenciaExternaId = readOptionalString(data.referenciaExternaId);
  const manejaSerial = readBoolean(data.manejaSerial, Boolean(serial));

  if (!PRODUCTO_TIPOS.has(tipoItem)) {
    throw new Error("El tipo de producto o equipo es invalido");
  }

  if (!codigo) {
    throw new Error("El codigo del producto es obligatorio");
  }

  if (!nombre) {
    throw new Error("El nombre del producto es obligatorio");
  }

  if (!categoria) {
    throw new Error("La categoria del producto es obligatoria");
  }

  if (!unidad) {
    throw new Error("La unidad del producto es obligatoria");
  }

  if (!Number.isFinite(costo) || costo < 0) {
    throw new Error("El costo del producto es invalido");
  }

  if (!Number.isFinite(precio) || precio < 0) {
    throw new Error("El precio del producto es invalido");
  }

  if (!Number.isFinite(stockActual) || stockActual < 0) {
    throw new Error("El stock del producto es invalido");
  }

  if (!PRODUCTO_ESTADOS.has(estado)) {
    throw new Error("El estado del producto es invalido");
  }

  if (!MERCADO_DISPONIBILIDADES.has(tipoDisponibilidad)) {
    throw new Error("La disponibilidad del producto es invalida");
  }

  return {
    id: `prd-${nanoid(8)}`,
    tipoItem,
    codigo,
    nombre,
    descripcion,
    categoria,
    marca,
    modelo,
    serial,
    manejaSerial,
    unidad,
    costo,
    precio,
    stockActual,
    estado,
    visibleEnMercado,
    tipoDisponibilidad,
    imagenUrl,
    referenciaExternaTipo,
    referenciaExternaId,
  };
}

export async function insertInventarioProducto(payload: unknown) {
  const producto = buildProducto(payload);
  const sql = getSql();

  try {
    const rows = (await sql`
      INSERT INTO inventario_productos (
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
      ) VALUES (
        ${producto.id},
        ${producto.tipoItem},
        ${producto.codigo},
        ${producto.nombre},
        ${producto.descripcion ?? null},
        ${producto.categoria},
        ${producto.marca ?? null},
        ${producto.modelo ?? null},
        ${producto.serial ?? null},
        ${producto.manejaSerial},
        ${producto.unidad},
        ${producto.costo},
        ${producto.precio},
        ${producto.stockActual},
        ${producto.estado},
        ${producto.visibleEnMercado},
        ${producto.tipoDisponibilidad},
        ${producto.imagenUrl ?? null},
        ${producto.referenciaExternaTipo ?? null},
        ${producto.referenciaExternaId ?? null},
        NOW(),
        NOW()
      )
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
      throw new Error("No se pudo recuperar el producto creado");
    }

    return mapProductoRow(rows[0]);
  } catch (error) {
    throw normalizeDatabaseError(error);
  }
}

function generateDocumentNumber(prefix: "CMP" | "ENT") {
  const now = new Date();
  const yyyymmdd = now.toISOString().slice(0, 10).replace(/-/g, "");
  return `${prefix}-${yyyymmdd}-${nanoid(6).toUpperCase()}`;
}

async function listInventarioCompras(
  filters: InventarioComprasFilters = {}
) {
  const sql = getSql();
  const whereClauses = ["1 = 1"];
  const params: unknown[] = [];

  if (filters.estado) {
    params.push(filters.estado);
    whereClauses.push(`c.estado = $${params.length}`);
  }

  if (filters.proveedorId) {
    params.push(filters.proveedorId);
    whereClauses.push(`c.proveedor_id = $${params.length}`);
  }

  if (filters.q) {
    params.push(`%${filters.q}%`);
    whereClauses.push(`(
      c.numero_compra ILIKE $${params.length}
      OR p.nombre_razon_social ILIKE $${params.length}
      OR p.documento_nit ILIKE $${params.length}
    )`);
  }

  let headersQuery = `
    SELECT
      c.id,
      c.numero_compra,
      c.proveedor_id,
      p.nombre_razon_social AS proveedor_nombre_razon_social,
      p.documento_nit AS proveedor_documento_nit,
      c.fecha,
      c.observaciones,
      c.estado,
      c.total,
      c.created_at,
      c.updated_at
    FROM inventario_compras c
    JOIN contable_terceros p
      ON p.id = c.proveedor_id
    WHERE ${whereClauses.join(" AND ")}
    ORDER BY c.fecha DESC, c.created_at DESC
  `;

  if (filters.limit) {
    params.push(filters.limit);
    headersQuery += ` LIMIT $${params.length}`;
  }

  const headerRows = (await sql.query(headersQuery, params)) as CompraHeaderRow[];

  if (headerRows.length === 0) {
    return [];
  }

  const compraIds = headerRows.map(row => row.id);
  const itemRows = (await sql.query(
    `
      SELECT
        i.id,
        i.compra_id,
        i.producto_id,
        p.codigo AS producto_codigo,
        p.nombre AS producto_nombre,
        i.descripcion,
        i.cantidad,
        i.costo_unitario,
        i.total,
        COALESCE(recibido.cantidad_recibida, 0) AS cantidad_recibida
      FROM inventario_compra_items i
      JOIN inventario_productos p
        ON p.id = i.producto_id
      LEFT JOIN (
        SELECT
          compra_item_id,
          SUM(cantidad) AS cantidad_recibida
        FROM inventario_entrada_items
        WHERE compra_item_id IS NOT NULL
        GROUP BY compra_item_id
      ) recibido
        ON recibido.compra_item_id = i.id
      WHERE i.compra_id = ANY($1::text[])
      ORDER BY i.created_at ASC
    `,
    [compraIds]
  )) as CompraItemRow[];

  return groupCompras(headerRows, itemRows);
}

async function findInventarioCompraById(id: string) {
  const compras = await listInventarioCompras();
  return compras.find(item => item.id === id) ?? null;
}

function buildCompraItems(
  rawItems: unknown,
  productosById: Map<string, InventarioProductoApiRecord>
): BuiltCompraItem[] {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    throw new Error("Debes agregar al menos un item a la compra");
  }

  return rawItems.map((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new Error(`El item ${index + 1} de la compra es invalido`);
    }

    const row = item as InventarioCompraItemPayload;
    const productoId = readString(row.productoId) ?? "";
    const producto = productosById.get(productoId);

    if (!producto) {
      throw new Error(`El producto del item ${index + 1} no existe`);
    }

    const cantidad = roundMoney(readNumber(row.cantidad));
    const costoUnitario = roundMoney(readNumber(row.costoUnitario));
    const descripcion =
      readString(row.descripcion) ?? `${producto.codigo} - ${producto.nombre}`;

    if (!Number.isFinite(cantidad) || cantidad <= 0) {
      throw new Error(`La cantidad del item ${index + 1} debe ser mayor que cero`);
    }

    if (!Number.isFinite(costoUnitario) || costoUnitario < 0) {
      throw new Error(`El costo del item ${index + 1} es invalido`);
    }

    return {
      id: `cmpi-${nanoid(8)}`,
      productoId,
      descripcion,
      cantidad,
      costoUnitario,
      total: roundMoney(cantidad * costoUnitario),
    };
  });
}

async function insertInventarioCompra(payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Cuerpo de solicitud invalido");
  }

  const data = payload as InventarioCompraPayload;
  const proveedorId = readString(data.proveedorId) ?? "";
  const fecha = readDateOnly(data.fecha, "compra");
  const observaciones = readOptionalString(data.observaciones);

  if (!proveedorId) {
    throw new Error("Debes seleccionar un proveedor");
  }

  const proveedor = await findProveedorById(proveedorId);

  if (!proveedor) {
    throw new Error("El proveedor seleccionado no existe");
  }

  const productoIds = Array.isArray(data.items)
    ? data.items
        .map(item =>
          item && typeof item === "object" && !Array.isArray(item)
            ? readString((item as InventarioCompraItemPayload).productoId)
            : undefined
        )
        .filter((item): item is string => Boolean(item))
    : [];

  const productos = await listInventarioProductosByIds(
    Array.from(new Set(productoIds))
  );
  const productosById = new Map(productos.map(item => [item.id, item]));
  const items = buildCompraItems(data.items, productosById);
  const total = roundMoney(items.reduce((sum, item) => sum + item.total, 0));
  const compra: BuiltCompra = {
    id: `cmp-${nanoid(8)}`,
    numeroCompra: generateDocumentNumber("CMP"),
    proveedorId,
    fecha,
    observaciones,
    estado: InventarioCompraEstado.REGISTRADA,
    total,
    items,
  };
  const sql = getSql();

  try {
    await sql.transaction(txn => [
      txn`
        INSERT INTO inventario_compras (
          id,
          numero_compra,
          proveedor_id,
          fecha,
          observaciones,
          estado,
          total,
          created_at,
          updated_at
        ) VALUES (
          ${compra.id},
          ${compra.numeroCompra},
          ${compra.proveedorId},
          ${compra.fecha},
          ${compra.observaciones ?? null},
          ${compra.estado},
          ${compra.total},
          NOW(),
          NOW()
        )
      `,
      ...compra.items.map(item => txn`
        INSERT INTO inventario_compra_items (
          id,
          compra_id,
          producto_id,
          descripcion,
          cantidad,
          costo_unitario,
          total,
          created_at,
          updated_at
        ) VALUES (
          ${item.id},
          ${compra.id},
          ${item.productoId},
          ${item.descripcion},
          ${item.cantidad},
          ${item.costoUnitario},
          ${item.total},
          NOW(),
          NOW()
        )
      `),
    ]);

    const created = await findInventarioCompraById(compra.id);

    if (!created) {
      throw new Error("No se pudo recuperar la compra creada");
    }

    return created;
  } catch (error) {
    throw normalizeDatabaseError(error);
  }
}

async function listInventarioEntradas(
  filters: InventarioEntradasFilters = {}
) {
  const sql = getSql();
  const whereClauses = ["1 = 1"];
  const params: unknown[] = [];

  if (filters.origenTipo) {
    params.push(filters.origenTipo);
    whereClauses.push(`e.origen_tipo = $${params.length}`);
  }

  if (filters.compraId) {
    params.push(filters.compraId);
    whereClauses.push(`e.compra_id = $${params.length}`);
  }

  if (filters.q) {
    params.push(`%${filters.q}%`);
    whereClauses.push(`(
      e.numero_entrada ILIKE $${params.length}
      OR COALESCE(c.numero_compra, '') ILIKE $${params.length}
      OR COALESCE(e.observaciones, '') ILIKE $${params.length}
    )`);
  }

  let headersQuery = `
    SELECT
      e.id,
      e.numero_entrada,
      e.fecha,
      e.origen_tipo,
      e.origen_id,
      e.compra_id,
      c.numero_compra AS compra_numero,
      e.bodega_id,
      e.observaciones,
      e.total_items,
      e.total_costo,
      e.created_at,
      e.updated_at
    FROM inventario_entradas e
    LEFT JOIN inventario_compras c
      ON c.id = e.compra_id
    WHERE ${whereClauses.join(" AND ")}
    ORDER BY e.fecha DESC, e.created_at DESC
  `;

  if (filters.limit) {
    params.push(filters.limit);
    headersQuery += ` LIMIT $${params.length}`;
  }

  const headerRows = (await sql.query(headersQuery, params)) as EntradaHeaderRow[];

  if (headerRows.length === 0) {
    return [];
  }

  const entradaIds = headerRows.map(row => row.id);
  const itemRows = (await sql.query(
    `
      SELECT
        i.id,
        i.entrada_id,
        i.producto_id,
        p.codigo AS producto_codigo,
        p.nombre AS producto_nombre,
        i.cantidad,
        i.costo_unitario,
        i.total,
        i.serial,
        i.compra_item_id
      FROM inventario_entrada_items i
      JOIN inventario_productos p
        ON p.id = i.producto_id
      WHERE i.entrada_id = ANY($1::text[])
      ORDER BY i.created_at ASC
    `,
    [entradaIds]
  )) as EntradaItemRow[];

  return groupEntradas(headerRows, itemRows);
}

async function findInventarioEntradaById(id: string) {
  const entradas = await listInventarioEntradas();
  return entradas.find(item => item.id === id) ?? null;
}

function buildEntradaItems(
  rawItems: unknown,
  productosById: Map<string, InventarioProductoApiRecord>,
  compra?: InventarioCompraApiRecord | null
): BuiltEntradaItem[] {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    throw new Error("Debes agregar al menos un item a la entrada");
  }

  const compraItemsById = new Map(
    (compra?.items ?? []).map(item => [item.id, item])
  );

  return rawItems.map((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new Error(`El item ${index + 1} de la entrada es invalido`);
    }

    const row = item as InventarioEntradaItemPayload;
    const productoId = readString(row.productoId) ?? "";
    const producto = productosById.get(productoId);

    if (!producto) {
      throw new Error(`El producto del item ${index + 1} no existe`);
    }

    const compraItemId = readOptionalString(row.compraItemId);
    const compraItem = compraItemId ? compraItemsById.get(compraItemId) : undefined;
    const cantidad = roundMoney(readNumber(row.cantidad));
    const costoUnitario = roundMoney(readNumber(row.costoUnitario, producto.costo));
    const serial = readOptionalString(row.serial);

    if (!Number.isFinite(cantidad) || cantidad <= 0) {
      throw new Error(`La cantidad del item ${index + 1} debe ser mayor que cero`);
    }

    if (!Number.isFinite(costoUnitario) || costoUnitario < 0) {
      throw new Error(`El costo del item ${index + 1} es invalido`);
    }

    if (producto.manejaSerial && !serial) {
      throw new Error(`Debes indicar el serial del item ${index + 1}`);
    }

    if (compra) {
      if (!compraItemId || !compraItem) {
        throw new Error(
          `El item ${index + 1} debe estar vinculado a un item de la compra seleccionada`
        );
      }

      if (compraItem.productoId !== productoId) {
        throw new Error(
          `El item ${index + 1} no corresponde al producto de la compra seleccionada`
        );
      }

      if (cantidad > compraItem.pendienteRecibir) {
        throw new Error(
          `La cantidad del item ${index + 1} supera el pendiente por recibir de la compra`
        );
      }
    }

    return {
      id: `enti-${nanoid(8)}`,
      productoId,
      compraItemId,
      cantidad,
      costoUnitario,
      total: roundMoney(cantidad * costoUnitario),
      serial,
    };
  });
}

async function insertInventarioEntrada(payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Cuerpo de solicitud invalido");
  }

  const data = payload as InventarioEntradaPayload;
  const fecha = readDateOnly(data.fecha, "entrada");
  const origenTipo =
    (readString(data.origenTipo) as InventarioEntradaOrigenTipo | undefined) ??
    InventarioEntradaOrigenTipo.MANUAL;
  const origenId = readOptionalString(data.origenId);
  const compraId = readOptionalString(data.compraId);
  const bodegaId = readOptionalString(data.bodegaId);
  const observaciones = readOptionalString(data.observaciones);

  if (!ENTRADA_ORIGENES.has(origenTipo)) {
    throw new Error("El origen de la entrada es invalido");
  }

  const compra = compraId ? await findInventarioCompraById(compraId) : null;

  if (compraId && !compra) {
    throw new Error("La compra seleccionada no existe");
  }

  const productoIds = Array.isArray(data.items)
    ? data.items
        .map(item =>
          item && typeof item === "object" && !Array.isArray(item)
            ? readString((item as InventarioEntradaItemPayload).productoId)
            : undefined
        )
        .filter((item): item is string => Boolean(item))
    : [];

  const productos = await listInventarioProductosByIds(
    Array.from(new Set(productoIds))
  );
  const productosById = new Map(productos.map(item => [item.id, item]));
  const items = buildEntradaItems(data.items, productosById, compra);
  const totalItems = roundMoney(items.reduce((sum, item) => sum + item.cantidad, 0));
  const totalCosto = roundMoney(items.reduce((sum, item) => sum + item.total, 0));
  const entrada: BuiltEntrada = {
    id: `ent-${nanoid(8)}`,
    numeroEntrada: generateDocumentNumber("ENT"),
    fecha,
    origenTipo,
    origenId,
    compraId,
    bodegaId,
    observaciones,
    totalItems,
    totalCosto,
    items,
  };
  const sql = getSql();

  try {
    await sql.transaction(txn => [
      txn`
        INSERT INTO inventario_entradas (
          id,
          numero_entrada,
          fecha,
          origen_tipo,
          origen_id,
          compra_id,
          bodega_id,
          observaciones,
          total_items,
          total_costo,
          created_at,
          updated_at
        ) VALUES (
          ${entrada.id},
          ${entrada.numeroEntrada},
          ${entrada.fecha},
          ${entrada.origenTipo},
          ${entrada.origenId ?? null},
          ${entrada.compraId ?? null},
          ${entrada.bodegaId ?? null},
          ${entrada.observaciones ?? null},
          ${entrada.totalItems},
          ${entrada.totalCosto},
          NOW(),
          NOW()
        )
      `,
      ...entrada.items.flatMap(item => [
        txn`
          INSERT INTO inventario_entrada_items (
            id,
            entrada_id,
            producto_id,
            compra_item_id,
            cantidad,
            costo_unitario,
            total,
            serial,
            created_at,
            updated_at
          ) VALUES (
            ${item.id},
            ${entrada.id},
            ${item.productoId},
            ${item.compraItemId ?? null},
            ${item.cantidad},
            ${item.costoUnitario},
            ${item.total},
            ${item.serial ?? null},
            NOW(),
            NOW()
          )
        `,
        txn`
          UPDATE inventario_productos
          SET
            stock_actual = stock_actual + ${item.cantidad},
            costo = CASE
              WHEN ${item.costoUnitario} > 0 THEN ${item.costoUnitario}
              ELSE costo
            END,
            updated_at = NOW()
          WHERE id = ${item.productoId}
        `,
      ]),
      ...(entrada.compraId
        ? [
            txn`
              UPDATE inventario_compras compra
              SET
                estado = CASE
                  WHEN COALESCE(recibido.total_recibido, 0) >= COALESCE(comprado.total_comprado, 0)
                    AND COALESCE(comprado.total_comprado, 0) > 0
                  THEN ${InventarioCompraEstado.RECIBIDA}
                  WHEN COALESCE(recibido.total_recibido, 0) > 0
                  THEN ${InventarioCompraEstado.PARCIAL}
                  ELSE ${InventarioCompraEstado.REGISTRADA}
                END,
                updated_at = NOW()
              FROM (
                SELECT
                  compra_id,
                  SUM(cantidad) AS total_comprado
                FROM inventario_compra_items
                WHERE compra_id = ${entrada.compraId}
                GROUP BY compra_id
              ) comprado
              LEFT JOIN (
                SELECT
                  ci.compra_id,
                  SUM(ei.cantidad) AS total_recibido
                FROM inventario_compra_items ci
                LEFT JOIN inventario_entrada_items ei
                  ON ei.compra_item_id = ci.id
                WHERE ci.compra_id = ${entrada.compraId}
                GROUP BY ci.compra_id
              ) recibido
                ON recibido.compra_id = compra.id
              WHERE compra.id = ${entrada.compraId}
            `,
          ]
        : []),
    ]);

    const created = await findInventarioEntradaById(entrada.id);

    if (!created) {
      throw new Error("No se pudo recuperar la entrada creada");
    }

    return created;
  } catch (error) {
    throw normalizeDatabaseError(error);
  }
}

async function getInventarioDashboardData(): Promise<InventarioDashboardDataApiRecord> {
  const sql = getSql();

  const [
    proveedoresCountRows,
    productosCountRows,
    comprasCountRows,
    entradasCountRows,
    stockRows,
    comprasRecientes,
    entradasRecientes,
    productosRecientes,
  ] = await Promise.all([
    sql`
      SELECT COUNT(*)::int AS total
      FROM contable_terceros
      WHERE tipo_tercero = ${ContableTerceroTipo.PROVEEDOR}
    `,
    sql`
      SELECT COUNT(*)::int AS total
      FROM inventario_productos
    `,
    sql`
      SELECT COUNT(*)::int AS total
      FROM inventario_compras
    `,
    sql`
      SELECT COUNT(*)::int AS total
      FROM inventario_entradas
    `,
    sql`
      SELECT
        COALESCE(SUM(stock_actual), 0) AS stock_total,
        COALESCE(SUM(stock_actual * costo), 0) AS valor_inventario
      FROM inventario_productos
    `,
    listInventarioCompras({ limit: 5 }),
    listInventarioEntradas({ limit: 5 }),
    listInventarioProductos({ limit: 6 }),
  ]);

  const proveedores = Number(
    (proveedoresCountRows as Array<{ total: number | string }>)[0]?.total ?? 0
  );
  const productos = Number(
    (productosCountRows as Array<{ total: number | string }>)[0]?.total ?? 0
  );
  const compras = Number(
    (comprasCountRows as Array<{ total: number | string }>)[0]?.total ?? 0
  );
  const entradas = Number(
    (entradasCountRows as Array<{ total: number | string }>)[0]?.total ?? 0
  );
  const stockRow = (
    stockRows as Array<{
      stock_total: number | string;
      valor_inventario: number | string;
    }>
  )[0];

  return {
    resumen: {
      proveedores,
      productos,
      compras,
      entradas,
      stockTotal: Number(stockRow?.stock_total ?? 0),
      valorInventario: Number(stockRow?.valor_inventario ?? 0),
    },
    comprasRecientes,
    entradasRecientes,
    productosRecientes,
  };
}

export async function handleInventarioRoute(
  req: NodeRequest,
  res: ServerResponse
) {
  const pathname = getPathname(req.url);
  const resource = getInventoryResource(pathname);

  if (resource === null) {
    sendErrorJson(res, 404, "Ruta no encontrada", "La ruta de inventario no existe");
    return;
  }

  try {
    if (resource === "") {
      if (req.method !== "GET") {
        sendMethodNotAllowed(res, ["GET"]);
        return;
      }

      const data = await getInventarioDashboardData();
      sendJson(res, 200, data);
      return;
    }

    if (resource === "proveedores") {
      if (req.method === "GET") {
        const params = getSearchParams(req.url);
        const data = await listInventarioProveedores({
          estado:
            (readString(params.get("estado")) as ContableTerceroEstado | undefined) ??
            undefined,
          q: readString(params.get("q")) ?? undefined,
        });
        sendJson(res, 200, data);
        return;
      }

      if (req.method === "POST") {
        const payload = await readJsonBody(req);
        const created = await insertInventarioProveedor(payload);
        sendJson(res, 201, created);
        return;
      }

      sendMethodNotAllowed(res, ["GET", "POST"]);
      return;
    }

    if (resource === "productos") {
      if (req.method === "GET") {
        const params = getSearchParams(req.url);
        const data = await listInventarioProductos({
          estado:
            (readString(params.get("estado")) as InventarioProductoEstado | undefined) ??
            undefined,
          tipoItem:
            (readString(params.get("tipoItem")) as InventarioProductoTipoItem | undefined) ??
            undefined,
          q: readString(params.get("q")) ?? undefined,
        });
        sendJson(res, 200, data);
        return;
      }

      if (req.method === "POST") {
        const payload = await readJsonBody(req);
        const created = await insertInventarioProducto(payload);
        sendJson(res, 201, created);
        return;
      }

      sendMethodNotAllowed(res, ["GET", "POST"]);
      return;
    }

    if (resource === "compras") {
      if (req.method === "GET") {
        const params = getSearchParams(req.url);
        const data = await listInventarioCompras({
          estado:
            (readString(params.get("estado")) as InventarioCompraEstado | undefined) ??
            undefined,
          proveedorId: readString(params.get("proveedorId")) ?? undefined,
          q: readString(params.get("q")) ?? undefined,
        });
        sendJson(res, 200, data);
        return;
      }

      if (req.method === "POST") {
        const payload = await readJsonBody(req);
        const created = await insertInventarioCompra(payload);
        sendJson(res, 201, created);
        return;
      }

      sendMethodNotAllowed(res, ["GET", "POST"]);
      return;
    }

    if (resource === "entradas") {
      if (req.method === "GET") {
        const params = getSearchParams(req.url);
        const data = await listInventarioEntradas({
          origenTipo:
            (readString(params.get("origenTipo")) as
              | InventarioEntradaOrigenTipo
              | undefined) ?? undefined,
          compraId: readString(params.get("compraId")) ?? undefined,
          q: readString(params.get("q")) ?? undefined,
        });
        sendJson(res, 200, data);
        return;
      }

      if (req.method === "POST") {
        const payload = await readJsonBody(req);
        const created = await insertInventarioEntrada(payload);
        sendJson(res, 201, created);
        return;
      }

      sendMethodNotAllowed(res, ["GET", "POST"]);
      return;
    }

    sendErrorJson(
      res,
      404,
      "Ruta no encontrada",
      `El recurso de inventario "${resource}" no existe`
    );
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
        ? "Conflicto al guardar informacion de inventario"
        : statusCode === 400
          ? "Solicitud invalida"
          : "Error interno",
      getErrorMessage(
        normalizedError,
        "No se pudo procesar la solicitud de inventario"
      )
    );
  }
}

export function createInventarioDevMiddleware() {
  return (req: NodeRequest, res: ServerResponse, next: ConnectNext) => {
    const pathname = getPathname(req.url);

    if (pathname === "/api/inventario" || pathname.startsWith("/api/inventario/")) {
      void handleInventarioRoute(req, res).catch(next);
      return;
    }

    next();
  };
}
