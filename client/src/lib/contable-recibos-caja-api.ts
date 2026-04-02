import type { ContableReciboCaja, ContableReciboCajaDetalle } from "./types";

type ContableReciboCajaDetalleApiRecord = Omit<
  ContableReciboCajaDetalle,
  "createdAt"
> & {
  createdAt: string;
};

type ContableReciboCajaApiRecord = Omit<
  ContableReciboCaja,
  "createdAt" | "fecha" | "detalles"
> & {
  createdAt: string;
  fecha: string;
  detalles?: ContableReciboCajaDetalleApiRecord[];
};

export type ContableReciboCajaDetalleMutationInput = {
  documentoId?: string;
  documentoReferencia?: string;
  documentoTipo: ContableReciboCajaDetalle["documentoTipo"];
  valorDocumento?: number;
  valorPagado: number;
};

export type ContableReciboCajaMutationInput = {
  cuentaBancariaId?: string;
  detalles?: ContableReciboCajaDetalleMutationInput[];
  fecha: string;
  metodoPago: ContableReciboCaja["metodoPago"];
  numeroRecibo: string;
  observaciones?: string;
  soporteUrl?: string;
  terceroId: string;
  valorTotal: number;
};

export type ContableReciboCajaFilters = {
  fecha?: string;
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

const RECIBOS_CAJA_API_URL = buildApiUrl("/api/contable/recibos-caja");

const JSON_HEADERS = {
  "Content-Type": "application/json",
};

function toReciboDetalle(
  record: ContableReciboCajaDetalleApiRecord
): ContableReciboCajaDetalle {
  return {
    ...record,
    createdAt: new Date(record.createdAt),
  };
}

function toReciboCaja(record: ContableReciboCajaApiRecord): ContableReciboCaja {
  return {
    ...record,
    createdAt: new Date(record.createdAt),
    detalles: record.detalles?.map(toReciboDetalle),
    fecha: parseDateOnly(record.fecha),
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

export async function getRecibosCaja(
  filters: ContableReciboCajaFilters = {}
) {
  const params = new URLSearchParams();

  if (filters.q?.trim()) {
    params.set("q", filters.q.trim());
  }

  if (filters.terceroId?.trim()) {
    params.set("terceroId", filters.terceroId);
  }

  if (filters.fecha?.trim()) {
    params.set("fecha", filters.fecha);
  }

  const response = await fetch(
    params.size > 0
      ? `${RECIBOS_CAJA_API_URL}?${params.toString()}`
      : RECIBOS_CAJA_API_URL,
    {
      cache: "no-store",
      credentials: "include",
    }
  );

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const data = (await response.json()) as ContableReciboCajaApiRecord[];
  return data.map(toReciboCaja);
}

export async function getReciboCajaById(id: string) {
  const response = await fetch(`${RECIBOS_CAJA_API_URL}/${id}`, {
    cache: "no-store",
    credentials: "include",
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const data = (await response.json()) as ContableReciboCajaApiRecord;
  return toReciboCaja(data);
}

export async function createReciboCaja(
  payload: ContableReciboCajaMutationInput
) {
  const response = await fetch(RECIBOS_CAJA_API_URL, {
    body: JSON.stringify(payload),
    credentials: "include",
    headers: JSON_HEADERS,
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const data = (await response.json()) as ContableReciboCajaApiRecord;
  return toReciboCaja(data);
}

export async function deleteReciboCaja(id: string) {
  const response = await fetch(`${RECIBOS_CAJA_API_URL}/${id}`, {
    credentials: "include",
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }
}
