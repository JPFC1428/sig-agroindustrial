import type {
  ContableCuentaBancaria,
  ContableConciliacionBancaria,
  ContableCuentaBancariaMovimientos,
  ContableMovimientoBancario,
} from "./types";

type ContableCuentaBancariaApiRecord = Omit<
  ContableCuentaBancaria,
  "createdAt" | "updatedAt"
> & {
  createdAt: string;
  updatedAt: string;
};

type ContableMovimientoBancarioApiRecord = Omit<
  ContableMovimientoBancario,
  "createdAt" | "fecha" | "fechaConciliacion"
> & {
  createdAt: string;
  fecha: string;
  fechaConciliacion?: string;
};

type ContableCuentaBancariaMovimientosApiRecord = Omit<
  ContableCuentaBancariaMovimientos,
  "cuenta" | "fechaDesde" | "fechaHasta" | "movimientos"
> & {
  cuenta: ContableCuentaBancariaApiRecord;
  fechaDesde?: string;
  fechaHasta?: string;
  movimientos: ContableMovimientoBancarioApiRecord[];
};

type ContableConciliacionBancariaApiRecord = Omit<
  ContableConciliacionBancaria,
  "cuenta" | "fechaDesde" | "fechaHasta" | "movimientos"
> & {
  cuenta: ContableCuentaBancariaApiRecord;
  fechaDesde?: string;
  fechaHasta?: string;
  movimientos: ContableMovimientoBancarioApiRecord[];
};

export type ContableCuentaBancariaMutationInput = {
  activa: boolean;
  nombreBanco: string;
  nombreCuenta: string;
  numeroCuenta: string;
  observaciones?: string;
  saldoInicial: number;
  titular: string;
  tipoCuenta: ContableCuentaBancaria["tipoCuenta"];
};

export type ContableCuentasBancariasFilters = {
  activa?: boolean;
  q?: string;
};

export type ContableCuentaBancariaMovimientosFilters = {
  fechaDesde?: string;
  fechaHasta?: string;
};

export type ContableMovimientoConciliacionMutationInput = {
  conciliado: boolean;
  referenciaId: string;
  referenciaTipo: ContableMovimientoBancario["referenciaTipo"];
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

const CONTABLE_BANCOS_API_URL = buildApiUrl("/api/contable/bancos");

const JSON_HEADERS = {
  "Content-Type": "application/json",
};

function toCuentaBancaria(
  record: ContableCuentaBancariaApiRecord
): ContableCuentaBancaria {
  return {
    ...record,
    createdAt: new Date(record.createdAt),
    updatedAt: new Date(record.updatedAt),
  };
}

function toMovimientoBancario(
  record: ContableMovimientoBancarioApiRecord
): ContableMovimientoBancario {
  return {
    ...record,
    fecha: parseDateOnly(record.fecha),
    fechaConciliacion: record.fechaConciliacion
      ? new Date(record.fechaConciliacion)
      : undefined,
    createdAt: new Date(record.createdAt),
  };
}

function toMovimientosCuenta(
  record: ContableCuentaBancariaMovimientosApiRecord
): ContableCuentaBancariaMovimientos {
  return {
    ...record,
    cuenta: toCuentaBancaria(record.cuenta),
    fechaDesde: record.fechaDesde ? parseDateOnly(record.fechaDesde) : undefined,
    fechaHasta: record.fechaHasta ? parseDateOnly(record.fechaHasta) : undefined,
    movimientos: record.movimientos.map(toMovimientoBancario),
  };
}

function toConciliacionBancaria(
  record: ContableConciliacionBancariaApiRecord
): ContableConciliacionBancaria {
  return {
    ...record,
    cuenta: toCuentaBancaria(record.cuenta),
    fechaDesde: record.fechaDesde ? parseDateOnly(record.fechaDesde) : undefined,
    fechaHasta: record.fechaHasta ? parseDateOnly(record.fechaHasta) : undefined,
    movimientos: record.movimientos.map(toMovimientoBancario),
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

export async function getContableBancos(
  filters: ContableCuentasBancariasFilters = {}
) {
  const params = new URLSearchParams();

  if (filters.q?.trim()) {
    params.set("q", filters.q.trim());
  }

  if (filters.activa !== undefined) {
    params.set("activa", String(filters.activa));
  }

  const response = await fetch(
    params.size > 0
      ? `${CONTABLE_BANCOS_API_URL}?${params.toString()}`
      : CONTABLE_BANCOS_API_URL,
    {
      cache: "no-store",
      credentials: "include",
    }
  );

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const data = (await response.json()) as ContableCuentaBancariaApiRecord[];
  return data.map(toCuentaBancaria);
}

export async function getContableBancoById(id: string) {
  const response = await fetch(`${CONTABLE_BANCOS_API_URL}/${id}`, {
    cache: "no-store",
    credentials: "include",
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const data = (await response.json()) as ContableCuentaBancariaApiRecord;
  return toCuentaBancaria(data);
}

export async function getContableBancoMovimientos(
  id: string,
  filters: ContableCuentaBancariaMovimientosFilters = {}
) {
  const params = new URLSearchParams();
  params.set("resource", "movimientos");

  if (filters.fechaDesde?.trim()) {
    params.set("fechaDesde", filters.fechaDesde);
  }

  if (filters.fechaHasta?.trim()) {
    params.set("fechaHasta", filters.fechaHasta);
  }

  const response = await fetch(
    `${CONTABLE_BANCOS_API_URL}/${id}?${params.toString()}`,
    {
      cache: "no-store",
      credentials: "include",
    }
  );

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const data = (await response.json()) as ContableCuentaBancariaMovimientosApiRecord;
  return toMovimientosCuenta(data);
}

export async function getContableBancoConciliacion(
  id: string,
  filters: ContableCuentaBancariaMovimientosFilters = {}
) {
  const params = new URLSearchParams();
  params.set("resource", "conciliacion");

  if (filters.fechaDesde?.trim()) {
    params.set("fechaDesde", filters.fechaDesde);
  }

  if (filters.fechaHasta?.trim()) {
    params.set("fechaHasta", filters.fechaHasta);
  }

  const response = await fetch(
    `${CONTABLE_BANCOS_API_URL}/${id}?${params.toString()}`,
    {
      cache: "no-store",
      credentials: "include",
    }
  );

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const data = (await response.json()) as ContableConciliacionBancariaApiRecord;
  return toConciliacionBancaria(data);
}

export async function updateContableBancoConciliacion(
  cuentaId: string,
  payload: ContableMovimientoConciliacionMutationInput
) {
  const params = new URLSearchParams();
  params.set("resource", "conciliacion");

  const response = await fetch(
    `${CONTABLE_BANCOS_API_URL}/${cuentaId}?${params.toString()}`,
    {
      body: JSON.stringify(payload),
      credentials: "include",
      headers: JSON_HEADERS,
      method: "PUT",
    }
  );

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  return (await response.json()) as {
    conciliado: boolean;
    fechaConciliacion?: string;
    referenciaId: string;
    referenciaTipo: ContableMovimientoBancario["referenciaTipo"];
  };
}

export async function createContableBanco(
  payload: ContableCuentaBancariaMutationInput
) {
  const response = await fetch(CONTABLE_BANCOS_API_URL, {
    body: JSON.stringify(payload),
    credentials: "include",
    headers: JSON_HEADERS,
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const data = (await response.json()) as ContableCuentaBancariaApiRecord;
  return toCuentaBancaria(data);
}

export async function updateContableBanco(
  id: string,
  payload: Partial<ContableCuentaBancariaMutationInput>
) {
  const response = await fetch(`${CONTABLE_BANCOS_API_URL}/${id}`, {
    body: JSON.stringify(payload),
    credentials: "include",
    headers: JSON_HEADERS,
    method: "PUT",
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const data = (await response.json()) as ContableCuentaBancariaApiRecord;
  return toCuentaBancaria(data);
}
