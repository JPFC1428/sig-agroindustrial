import type { ContableFacturaCompra } from "./types";

type ContableFacturaCompraApiRecord = Omit<
  ContableFacturaCompra,
  "createdAt" | "updatedAt" | "fechaFactura" | "fechaVencimiento"
> & {
  createdAt: string;
  updatedAt: string;
  fechaFactura: string;
  fechaVencimiento: string;
};

export type ContableFacturaCompraMutationInput = {
  numeroFactura: string;
  terceroId: string;
  fechaFactura: string;
  fechaVencimiento: string;
  subtotal: number;
  iva: number;
  total: number;
  saldo: number;
  estado: ContableFacturaCompra["estado"];
  observaciones?: string;
  soporteUrl?: string;
};

export type ContableFacturaCompraFilters = {
  estado?: ContableFacturaCompra["estado"];
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

export function formatDateOnlyInput(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const FACTURAS_COMPRA_API_URL = buildApiUrl("/api/contable/facturas-compra");

const JSON_HEADERS = {
  "Content-Type": "application/json",
};

function toFacturaCompra(
  record: ContableFacturaCompraApiRecord
): ContableFacturaCompra {
  return {
    ...record,
    fechaFactura: parseDateOnly(record.fechaFactura),
    fechaVencimiento: parseDateOnly(record.fechaVencimiento),
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

    return (
      data.message || data.detail || data.error || `Error ${response.status}`
    );
  } catch {
    return `Error ${response.status}`;
  }
}

export async function getFacturasCompra(
  filters: ContableFacturaCompraFilters = {}
) {
  const params = new URLSearchParams();

  if (filters.q?.trim()) {
    params.set("q", filters.q.trim());
  }

  if (filters.estado?.trim()) {
    params.set("estado", filters.estado);
  }

  if (filters.terceroId?.trim()) {
    params.set("terceroId", filters.terceroId);
  }

  const response = await fetch(
    params.size > 0
      ? `${FACTURAS_COMPRA_API_URL}?${params.toString()}`
      : FACTURAS_COMPRA_API_URL,
    {
      cache: "no-store",
      credentials: "include",
    }
  );

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const data = (await response.json()) as ContableFacturaCompraApiRecord[];
  return data.map(toFacturaCompra);
}

export async function getFacturaCompraById(id: string) {
  const response = await fetch(`${FACTURAS_COMPRA_API_URL}/${id}`, {
    cache: "no-store",
    credentials: "include",
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const data = (await response.json()) as ContableFacturaCompraApiRecord;
  return toFacturaCompra(data);
}

export async function createFacturaCompra(
  payload: ContableFacturaCompraMutationInput
) {
  const response = await fetch(FACTURAS_COMPRA_API_URL, {
    credentials: "include",
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const data = (await response.json()) as ContableFacturaCompraApiRecord;
  return toFacturaCompra(data);
}

export async function updateFacturaCompra(
  id: string,
  payload: Partial<ContableFacturaCompraMutationInput>
) {
  const response = await fetch(`${FACTURAS_COMPRA_API_URL}/${id}`, {
    credentials: "include",
    method: "PUT",
    headers: JSON_HEADERS,
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const data = (await response.json()) as ContableFacturaCompraApiRecord;
  return toFacturaCompra(data);
}

export async function deleteFacturaCompra(id: string) {
  const response = await fetch(`${FACTURAS_COMPRA_API_URL}/${id}`, {
    credentials: "include",
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }
}
