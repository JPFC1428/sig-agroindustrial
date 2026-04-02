import type { ContableTercero } from "./types";

type ContableTerceroApiRecord = Omit<
  ContableTercero,
  "createdAt" | "updatedAt"
> & {
  createdAt: string;
  updatedAt: string;
};

export type ContableTerceroMutationInput = {
  tipoTercero: ContableTercero["tipoTercero"];
  nombreRazonSocial: string;
  documentoNit: string;
  contacto?: string;
  telefono?: string;
  correo?: string;
  ciudad?: string;
  direccion?: string;
  observaciones?: string;
  estado: ContableTercero["estado"];
};

export type ContableTerceroFilters = {
  estado?: ContableTercero["estado"];
  q?: string;
  tipo?: ContableTercero["tipoTercero"];
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

const CONTABLE_TERCEROS_API_URL = buildApiUrl("/api/contable/terceros");

const JSON_HEADERS = {
  "Content-Type": "application/json",
};

function toContableTercero(record: ContableTerceroApiRecord): ContableTercero {
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

    return (
      data.message || data.detail || data.error || `Error ${response.status}`
    );
  } catch {
    return `Error ${response.status}`;
  }
}

export async function getContableTerceros(
  filters: ContableTerceroFilters = {}
) {
  const params = new URLSearchParams();

  if (filters.q?.trim()) {
    params.set("q", filters.q.trim());
  }

  if (filters.tipo?.trim()) {
    params.set("tipo", filters.tipo);
  }

  if (filters.estado?.trim()) {
    params.set("estado", filters.estado);
  }

  const response = await fetch(
    params.size > 0
      ? `${CONTABLE_TERCEROS_API_URL}?${params.toString()}`
      : CONTABLE_TERCEROS_API_URL,
    {
      cache: "no-store",
      credentials: "include",
    }
  );

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const data = (await response.json()) as ContableTerceroApiRecord[];
  return data.map(toContableTercero);
}

export async function getContableTerceroById(id: string) {
  const response = await fetch(`${CONTABLE_TERCEROS_API_URL}/${id}`, {
    cache: "no-store",
    credentials: "include",
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const data = (await response.json()) as ContableTerceroApiRecord;
  return toContableTercero(data);
}

export async function createContableTercero(
  payload: ContableTerceroMutationInput
) {
  const response = await fetch(CONTABLE_TERCEROS_API_URL, {
    credentials: "include",
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const data = (await response.json()) as ContableTerceroApiRecord;
  return toContableTercero(data);
}

export async function updateContableTercero(
  id: string,
  payload: Partial<ContableTerceroMutationInput>
) {
  const response = await fetch(`${CONTABLE_TERCEROS_API_URL}/${id}`, {
    credentials: "include",
    method: "PUT",
    headers: JSON_HEADERS,
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const data = (await response.json()) as ContableTerceroApiRecord;
  return toContableTercero(data);
}

export async function deleteContableTercero(id: string) {
  const response = await fetch(`${CONTABLE_TERCEROS_API_URL}/${id}`, {
    credentials: "include",
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }
}
