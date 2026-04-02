import type {
  ContableCuadreCaja,
  ContableCuadreCajaMovimiento,
  ContableCuadreCajaResumen,
} from "./types";

type ContableCuadreCajaMovimientoApiRecord = Omit<
  ContableCuadreCajaMovimiento,
  "fecha"
> & {
  fecha: string;
};

type ContableCuadreCajaApiRecord = Omit<
  ContableCuadreCaja,
  "fechaDesde" | "fechaHasta" | "createdAt" | "updatedAt"
> & {
  fechaDesde: string;
  fechaHasta: string;
  createdAt: string;
  updatedAt: string;
};

type ContableCuadreCajaResumenApiRecord = Omit<
  ContableCuadreCajaResumen,
  "fechaDesde" | "fechaHasta" | "ingresos" | "salidas"
> & {
  fechaDesde: string;
  fechaHasta: string;
  ingresos: ContableCuadreCajaMovimientoApiRecord[];
  salidas: ContableCuadreCajaMovimientoApiRecord[];
};

export type ContableCuadreCajaMutationInput = {
  fechaDesde: string;
  fechaHasta: string;
  observaciones?: string;
};

export type ContableCuadreCajaResumenFilters = {
  fechaDesde: string;
  fechaHasta: string;
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

const CUADRES_CAJA_API_URL = buildApiUrl("/api/contable/cuadres-caja");

const JSON_HEADERS = {
  "Content-Type": "application/json",
};

function toMovimiento(
  record: ContableCuadreCajaMovimientoApiRecord
): ContableCuadreCajaMovimiento {
  return {
    ...record,
    fecha: parseDateOnly(record.fecha),
  };
}

function toCuadreCaja(record: ContableCuadreCajaApiRecord): ContableCuadreCaja {
  return {
    ...record,
    fechaDesde: parseDateOnly(record.fechaDesde),
    fechaHasta: parseDateOnly(record.fechaHasta),
    createdAt: new Date(record.createdAt),
    updatedAt: new Date(record.updatedAt),
  };
}

function toCuadreCajaResumen(
  record: ContableCuadreCajaResumenApiRecord
): ContableCuadreCajaResumen {
  return {
    ...record,
    fechaDesde: parseDateOnly(record.fechaDesde),
    fechaHasta: parseDateOnly(record.fechaHasta),
    ingresos: record.ingresos.map(toMovimiento),
    salidas: record.salidas.map(toMovimiento),
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

export async function getContableCuadresCaja() {
  const response = await fetch(CUADRES_CAJA_API_URL, {
    cache: "no-store",
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const data = (await response.json()) as ContableCuadreCajaApiRecord[];
  return data.map(toCuadreCaja);
}

export async function getContableCuadreCajaResumen(
  filters: ContableCuadreCajaResumenFilters
) {
  const params = new URLSearchParams({
    resource: "resumen",
    fechaDesde: filters.fechaDesde,
    fechaHasta: filters.fechaHasta,
  });

  const response = await fetch(`${CUADRES_CAJA_API_URL}?${params.toString()}`, {
    cache: "no-store",
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const data = (await response.json()) as ContableCuadreCajaResumenApiRecord;
  return toCuadreCajaResumen(data);
}

export async function createContableCuadreCaja(
  payload: ContableCuadreCajaMutationInput
) {
  const response = await fetch(CUADRES_CAJA_API_URL, {
    credentials: "include",
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const data = (await response.json()) as ContableCuadreCajaApiRecord;
  return toCuadreCaja(data);
}
