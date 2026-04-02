import type {
  ContableCarteraClienteItem,
  ContableCarteraProveedorItem,
  ContableCarteraEstado,
} from "./types";

type ContableCarteraProveedorApiRecord = Omit<
  ContableCarteraProveedorItem,
  "fechaFactura" | "fechaVencimiento"
> & {
  fechaFactura: string;
  fechaVencimiento: string;
};

type ContableCarteraClienteApiRecord = Omit<
  ContableCarteraClienteItem,
  "fechaUltimoMovimiento"
> & {
  fechaUltimoMovimiento: string;
};

export type ContableCarteraFilters = {
  estado?: ContableCarteraEstado;
  fechaDesde?: string;
  fechaHasta?: string;
  q?: string;
  terceroId?: string;
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

  if (!apiBaseUrl) {
    return pathname;
  }

  return `${apiBaseUrl}${pathname}`;
}

function parseDateOnly(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}

const CARTERA_PROVEEDORES_API_URL = buildApiUrl(
  "/api/contable/cartera-proveedores"
);
const CARTERA_CLIENTES_API_URL = buildApiUrl("/api/contable/cartera-clientes");

function buildFiltersQuery(filters: ContableCarteraFilters) {
  const params = new URLSearchParams();

  if (filters.q?.trim()) {
    params.set("q", filters.q.trim());
  }

  if (filters.terceroId?.trim()) {
    params.set("terceroId", filters.terceroId);
  }

  if (filters.estado?.trim()) {
    params.set("estado", filters.estado);
  }

  if (filters.fechaDesde?.trim()) {
    params.set("fechaDesde", filters.fechaDesde);
  }

  if (filters.fechaHasta?.trim()) {
    params.set("fechaHasta", filters.fechaHasta);
  }

  return params;
}

function toCarteraProveedor(
  record: ContableCarteraProveedorApiRecord
): ContableCarteraProveedorItem {
  return {
    ...record,
    fechaFactura: parseDateOnly(record.fechaFactura),
    fechaVencimiento: parseDateOnly(record.fechaVencimiento),
  };
}

function toCarteraCliente(
  record: ContableCarteraClienteApiRecord
): ContableCarteraClienteItem {
  return {
    ...record,
    fechaUltimoMovimiento: parseDateOnly(record.fechaUltimoMovimiento),
  };
}

async function readErrorMessage(response: Response) {
  try {
    const data = (await response.json()) as {
      detail?: string;
      error?: string;
      message?: string;
    };

    return (
      data.message || data.detail || data.error || `Error ${response.status}`
    );
  } catch {
    return `Error ${response.status}`;
  }
}

export async function getCarteraProveedores(
  filters: ContableCarteraFilters = {}
) {
  const params = buildFiltersQuery(filters);
  const response = await fetch(
    params.size > 0
      ? `${CARTERA_PROVEEDORES_API_URL}?${params.toString()}`
      : CARTERA_PROVEEDORES_API_URL,
    {
      cache: "no-store",
      credentials: "include",
    }
  );

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const data = (await response.json()) as ContableCarteraProveedorApiRecord[];
  return data.map(toCarteraProveedor);
}

export async function getCarteraClientes(
  filters: ContableCarteraFilters = {}
) {
  const params = buildFiltersQuery(filters);
  const response = await fetch(
    params.size > 0
      ? `${CARTERA_CLIENTES_API_URL}?${params.toString()}`
      : CARTERA_CLIENTES_API_URL,
    {
      cache: "no-store",
      credentials: "include",
    }
  );

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const data = (await response.json()) as ContableCarteraClienteApiRecord[];
  return data.map(toCarteraCliente);
}
