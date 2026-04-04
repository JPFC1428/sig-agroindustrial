import type {
  ContableTercero,
  ContableTerceroEstado,
  InventarioCompra,
  InventarioDashboardData,
  InventarioEntrada,
  InventarioEntradaOrigenTipo,
  InventarioProducto,
  InventarioProductoEstado,
  InventarioProductoTipoItem,
  MercadoDisponibilidadTipo,
} from "./types";

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

type InventarioCompraApiRecord = Omit<
  InventarioCompra,
  "fecha" | "createdAt" | "updatedAt"
> & {
  fecha: string;
  createdAt: string;
  updatedAt: string;
};

type InventarioEntradaApiRecord = Omit<
  InventarioEntrada,
  "fecha" | "createdAt" | "updatedAt"
> & {
  fecha: string;
  createdAt: string;
  updatedAt: string;
};

type InventarioDashboardDataApiRecord = {
  resumen: InventarioDashboardData["resumen"];
  comprasRecientes: InventarioCompraApiRecord[];
  entradasRecientes: InventarioEntradaApiRecord[];
  productosRecientes: InventarioProductoApiRecord[];
};

export type InventarioProveedorMutationInput = {
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

export type InventarioProductoMutationInput = {
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
  estado: InventarioProductoEstado;
  visibleEnMercado?: boolean;
  tipoDisponibilidad?: MercadoDisponibilidadTipo;
  imagenUrl?: string;
  referenciaExternaTipo?: string;
  referenciaExternaId?: string;
};

export type InventarioCompraMutationItemInput = {
  productoId: string;
  descripcion?: string;
  cantidad: number;
  costoUnitario: number;
};

export type InventarioCompraMutationInput = {
  proveedorId: string;
  fecha: string;
  observaciones?: string;
  items: InventarioCompraMutationItemInput[];
};

export type InventarioEntradaMutationItemInput = {
  productoId: string;
  compraItemId?: string;
  cantidad: number;
  costoUnitario: number;
  serial?: string;
};

export type InventarioEntradaMutationInput = {
  fecha: string;
  origenTipo: InventarioEntradaOrigenTipo;
  origenId?: string;
  compraId?: string;
  bodegaId?: string;
  observaciones?: string;
  items: InventarioEntradaMutationItemInput[];
};

export type InventarioProveedorFilters = {
  q?: string;
  estado?: ContableTerceroEstado;
};

export type InventarioProductoFilters = {
  q?: string;
  estado?: InventarioProductoEstado;
  tipoItem?: InventarioProductoTipoItem;
};

export type InventarioCompraFilters = {
  q?: string;
  estado?: InventarioCompra["estado"];
  proveedorId?: string;
};

export type InventarioEntradaFilters = {
  q?: string;
  origenTipo?: InventarioEntradaOrigenTipo;
  compraId?: string;
};

function getApiBaseUrl() {
  const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();

  if (!configuredBaseUrl) {
    return "";
  }

  return configuredBaseUrl.replace(/\/+$/, "");
}

function buildApiUrl(pathname: string) {
  const apiBaseUrl = getApiBaseUrl();
  return apiBaseUrl ? `${apiBaseUrl}${pathname}` : pathname;
}

const INVENTARIO_API_URL = buildApiUrl("/api/inventario");
const JSON_HEADERS = { "Content-Type": "application/json" };

function parseDateOnly(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1);
}

function toProveedor(record: ContableTerceroApiRecord): ContableTercero {
  return {
    ...record,
    createdAt: new Date(record.createdAt),
    updatedAt: new Date(record.updatedAt),
  };
}

function toProducto(record: InventarioProductoApiRecord): InventarioProducto {
  return {
    ...record,
    createdAt: new Date(record.createdAt),
    updatedAt: new Date(record.updatedAt),
  };
}

function toCompra(record: InventarioCompraApiRecord): InventarioCompra {
  return {
    ...record,
    fecha: parseDateOnly(record.fecha),
    createdAt: new Date(record.createdAt),
    updatedAt: new Date(record.updatedAt),
  };
}

function toEntrada(record: InventarioEntradaApiRecord): InventarioEntrada {
  return {
    ...record,
    fecha: parseDateOnly(record.fecha),
    createdAt: new Date(record.createdAt),
    updatedAt: new Date(record.updatedAt),
  };
}

async function readErrorMessage(response: Response) {
  try {
    const data = (await response.json()) as {
      detail?: string;
      error?: string;
      message?: string;
    };

    return data.message || data.detail || data.error || `Error ${response.status}`;
  } catch {
    return `Error ${response.status}`;
  }
}

async function fetchJson<T>(url: string, init?: RequestInit) {
  const response = await fetch(url, {
    cache: "no-store",
    credentials: "include",
    ...init,
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  return (await response.json()) as T;
}

export async function getInventarioDashboardData() {
  const data = await fetchJson<InventarioDashboardDataApiRecord>(INVENTARIO_API_URL);

  return {
    resumen: data.resumen,
    comprasRecientes: data.comprasRecientes.map(toCompra),
    entradasRecientes: data.entradasRecientes.map(toEntrada),
    productosRecientes: data.productosRecientes.map(toProducto),
  };
}

export async function getInventarioProveedores(
  filters: InventarioProveedorFilters = {}
) {
  const params = new URLSearchParams();

  if (filters.q?.trim()) {
    params.set("q", filters.q.trim());
  }

  if (filters.estado?.trim()) {
    params.set("estado", filters.estado);
  }

  const url =
    params.size > 0
      ? `${INVENTARIO_API_URL}/proveedores?${params.toString()}`
      : `${INVENTARIO_API_URL}/proveedores`;

  const data = await fetchJson<ContableTerceroApiRecord[]>(url);
  return data.map(toProveedor);
}

export async function createInventarioProveedor(
  payload: InventarioProveedorMutationInput
) {
  const data = await fetchJson<ContableTerceroApiRecord>(
    `${INVENTARIO_API_URL}/proveedores`,
    {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify(payload),
    }
  );

  return toProveedor(data);
}

export async function getInventarioProductos(
  filters: InventarioProductoFilters = {}
) {
  const params = new URLSearchParams();

  if (filters.q?.trim()) {
    params.set("q", filters.q.trim());
  }

  if (filters.estado?.trim()) {
    params.set("estado", filters.estado);
  }

  if (filters.tipoItem?.trim()) {
    params.set("tipoItem", filters.tipoItem);
  }

  const url =
    params.size > 0
      ? `${INVENTARIO_API_URL}/productos?${params.toString()}`
      : `${INVENTARIO_API_URL}/productos`;

  const data = await fetchJson<InventarioProductoApiRecord[]>(url);
  return data.map(toProducto);
}

export async function createInventarioProducto(
  payload: InventarioProductoMutationInput
) {
  const data = await fetchJson<InventarioProductoApiRecord>(
    `${INVENTARIO_API_URL}/productos`,
    {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify(payload),
    }
  );

  return toProducto(data);
}

export async function getInventarioCompras(
  filters: InventarioCompraFilters = {}
) {
  const params = new URLSearchParams();

  if (filters.q?.trim()) {
    params.set("q", filters.q.trim());
  }

  if (filters.estado?.trim()) {
    params.set("estado", filters.estado);
  }

  if (filters.proveedorId?.trim()) {
    params.set("proveedorId", filters.proveedorId);
  }

  const url =
    params.size > 0
      ? `${INVENTARIO_API_URL}/compras?${params.toString()}`
      : `${INVENTARIO_API_URL}/compras`;

  const data = await fetchJson<InventarioCompraApiRecord[]>(url);
  return data.map(toCompra);
}

export async function createInventarioCompra(
  payload: InventarioCompraMutationInput
) {
  const data = await fetchJson<InventarioCompraApiRecord>(
    `${INVENTARIO_API_URL}/compras`,
    {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify(payload),
    }
  );

  return toCompra(data);
}

export async function getInventarioEntradas(
  filters: InventarioEntradaFilters = {}
) {
  const params = new URLSearchParams();

  if (filters.q?.trim()) {
    params.set("q", filters.q.trim());
  }

  if (filters.origenTipo?.trim()) {
    params.set("origenTipo", filters.origenTipo);
  }

  if (filters.compraId?.trim()) {
    params.set("compraId", filters.compraId);
  }

  const url =
    params.size > 0
      ? `${INVENTARIO_API_URL}/entradas?${params.toString()}`
      : `${INVENTARIO_API_URL}/entradas`;

  const data = await fetchJson<InventarioEntradaApiRecord[]>(url);
  return data.map(toEntrada);
}

export async function createInventarioEntrada(
  payload: InventarioEntradaMutationInput
) {
  const data = await fetchJson<InventarioEntradaApiRecord>(
    `${INVENTARIO_API_URL}/entradas`,
    {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify(payload),
    }
  );

  return toEntrada(data);
}
