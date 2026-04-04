import type {
  InventarioProducto,
  MercadoBootstrapData,
  MercadoDisponibilidadTipo,
} from "./types";

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
  whatsappNumero?: string;
};

export type MercadoProductoUpdateInput = {
  categoria: string;
  descripcion?: string;
  imagenUrl?: string;
  marca?: string;
  nombre: string;
  precio: number;
  stockActual?: number;
  tipoDisponibilidad: MercadoDisponibilidadTipo;
  visibleEnMercado: boolean;
};

export type MercadoProductoCreateInput = {
  categoria: string;
  descripcion?: string;
  imagenUrl?: string;
  marca?: string;
  nombre: string;
  precio: number;
  stockInicial?: number;
  stockActual?: number;
  tipoDisponibilidad: MercadoDisponibilidadTipo;
  visibleEnMercado: boolean;
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

const MERCADO_API_URL = buildApiUrl("/api/mercado");
const JSON_HEADERS = { "Content-Type": "application/json" };

function toInventarioProducto(record: InventarioProductoApiRecord): InventarioProducto {
  return {
    ...record,
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

export async function getMercadoBootstrapData(): Promise<MercadoBootstrapData> {
  const data = await fetchJson<MercadoBootstrapDataApiRecord>(MERCADO_API_URL);

  return {
    puedeAdministrar: data.puedeAdministrar,
    productos: data.productos.map(toInventarioProducto),
    whatsappNumeroConfigurado: data.whatsappNumeroConfigurado,
    whatsappNumero: data.whatsappNumero,
  };
}

export async function getMercadoProductos(params?: {
  q?: string;
  visibilidad?: "todos" | "visibles" | "ocultos";
}) {
  const searchParams = new URLSearchParams();

  if (params?.q?.trim()) {
    searchParams.set("q", params.q.trim());
  }

  if (params?.visibilidad && params.visibilidad !== "todos") {
    searchParams.set("visibilidad", params.visibilidad);
  }

  const url =
    searchParams.size > 0
      ? `${MERCADO_API_URL}/productos?${searchParams.toString()}`
      : `${MERCADO_API_URL}/productos`;

  const data = await fetchJson<InventarioProductoApiRecord[]>(url);
  return data.map(toInventarioProducto);
}

export async function getMercadoProductoById(productoId: string) {
  const data = await fetchJson<InventarioProductoApiRecord>(
    `${MERCADO_API_URL}/productos/${productoId}`
  );

  return toInventarioProducto(data);
}

export async function createMercadoProducto(payload: MercadoProductoCreateInput) {
  const data = await fetchJson<InventarioProductoApiRecord>(
    `${MERCADO_API_URL}/productos`,
    {
      body: JSON.stringify(payload),
      headers: JSON_HEADERS,
      method: "POST",
    }
  );

  return toInventarioProducto(data);
}

export async function updateMercadoProducto(
  productoId: string,
  payload: MercadoProductoUpdateInput
) {
  const data = await fetchJson<InventarioProductoApiRecord>(
    `${MERCADO_API_URL}/productos/${productoId}`,
    {
      body: JSON.stringify(payload),
      headers: JSON_HEADERS,
      method: "PUT",
    }
  );

  return toInventarioProducto(data);
}
