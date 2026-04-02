import type { ContableEgreso, ContableEgresoDetalle } from "./types";

type ContableEgresoDetalleApiRecord = Omit<
  ContableEgresoDetalle,
  "createdAt" | "facturaFecha" | "facturaFechaVencimiento"
> & {
  createdAt: string;
  facturaFecha: string;
  facturaFechaVencimiento: string;
};

type ContableEgresoApiRecord = Omit<
  ContableEgreso,
  "createdAt" | "fecha" | "detalles"
> & {
  createdAt: string;
  fecha: string;
  detalles?: ContableEgresoDetalleApiRecord[];
};

export type ContableEgresoDetalleMutationInput = {
  facturaId: string;
  valorPagado: number;
};

export type ContableEgresoMutationInput = {
  numeroComprobante: string;
  terceroId: string;
  cuentaBancariaId?: string;
  fecha: string;
  valorTotal?: number;
  metodoPago: ContableEgreso["metodoPago"];
  observaciones?: string;
  soporteUrl?: string;
  detalles: ContableEgresoDetalleMutationInput[];
};

export type ContableEgresoFilters = {
  q?: string;
  terceroId?: string;
};

type FacturaDisponibleApiRecord = {
  id: string;
  numeroFactura: string;
  terceroId: string;
  terceroNombreRazonSocial: string;
  terceroDocumentoNit: string;
  fechaFactura: string;
  fechaVencimiento: string;
  subtotal: number;
  iva: number;
  total: number;
  saldo: number;
  estado: string;
  createdAt: string;
  updatedAt: string;
};

export type ContableFacturaDisponibleParaEgreso = {
  id: string;
  numeroFactura: string;
  terceroId: string;
  terceroNombreRazonSocial: string;
  terceroDocumentoNit: string;
  fechaFactura: Date;
  fechaVencimiento: Date;
  subtotal: number;
  iva: number;
  total: number;
  saldo: number;
  estado: string;
  createdAt: Date;
  updatedAt: Date;
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

const EGRESOS_API_URL = buildApiUrl("/api/contable/egresos");

const JSON_HEADERS = {
  "Content-Type": "application/json",
};

function toEgresoDetalle(
  record: ContableEgresoDetalleApiRecord
): ContableEgresoDetalle {
  return {
    ...record,
    facturaFecha: parseDateOnly(record.facturaFecha),
    facturaFechaVencimiento: parseDateOnly(record.facturaFechaVencimiento),
    createdAt: new Date(record.createdAt),
  };
}

function toEgreso(record: ContableEgresoApiRecord): ContableEgreso {
  return {
    ...record,
    fecha: parseDateOnly(record.fecha),
    createdAt: new Date(record.createdAt),
    detalles: record.detalles?.map(toEgresoDetalle),
  };
}

function toFacturaDisponible(
  record: FacturaDisponibleApiRecord
): ContableFacturaDisponibleParaEgreso {
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

export async function getEgresos(filters: ContableEgresoFilters = {}) {
  const params = new URLSearchParams();

  if (filters.q?.trim()) {
    params.set("q", filters.q.trim());
  }

  if (filters.terceroId?.trim()) {
    params.set("terceroId", filters.terceroId);
  }

  const response = await fetch(
    params.size > 0 ? `${EGRESOS_API_URL}?${params.toString()}` : EGRESOS_API_URL,
    {
      cache: "no-store",
      credentials: "include",
    }
  );

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const data = (await response.json()) as ContableEgresoApiRecord[];
  return data.map(toEgreso);
}

export async function getEgresoById(id: string) {
  const response = await fetch(`${EGRESOS_API_URL}/${id}`, {
    cache: "no-store",
    credentials: "include",
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const data = (await response.json()) as ContableEgresoApiRecord;
  return toEgreso(data);
}

export async function getFacturasDisponiblesParaEgreso(terceroId: string) {
  const response = await fetch(
    `${EGRESOS_API_URL}?resource=facturas-disponibles&terceroId=${encodeURIComponent(
      terceroId
    )}`,
    {
      cache: "no-store",
      credentials: "include",
    }
  );

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const data = (await response.json()) as FacturaDisponibleApiRecord[];
  return data.map(toFacturaDisponible);
}

export async function createEgreso(payload: ContableEgresoMutationInput) {
  const response = await fetch(EGRESOS_API_URL, {
    credentials: "include",
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const data = (await response.json()) as ContableEgresoApiRecord;
  return toEgreso(data);
}

export async function deleteEgreso(id: string) {
  const response = await fetch(`${EGRESOS_API_URL}/${id}`, {
    credentials: "include",
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }
}
