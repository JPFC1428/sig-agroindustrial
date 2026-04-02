import type { ContableNotaCredito } from "./types";

type ContableNotaCreditoApiRecord = Omit<
  ContableNotaCredito,
  "fecha" | "createdAt" | "updatedAt"
> & {
  fecha: string;
  createdAt: string;
  updatedAt: string;
};

export type ContableNotaCreditoMutationInput = {
  numeroNota: string;
  terceroId: string;
  tipo: ContableNotaCredito["tipo"];
  fecha: string;
  valor: number;
  motivo: string;
  referenciaDocumento?: string;
  observaciones?: string;
  estado: ContableNotaCredito["estado"];
  documentoRelacionadoTipo?: ContableNotaCredito["documentoRelacionadoTipo"];
  documentoRelacionadoId?: string;
};

export type ContableNotaCreditoFilters = {
  estado?: ContableNotaCredito["estado"];
  q?: string;
  terceroId?: string;
  tipo?: ContableNotaCredito["tipo"];
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

const NOTAS_CREDITO_API_URL = buildApiUrl("/api/contable/notas-credito");

const JSON_HEADERS = {
  "Content-Type": "application/json",
};

function toNotaCredito(
  record: ContableNotaCreditoApiRecord
): ContableNotaCredito {
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

    return (
      data.message || data.detail || data.error || `Error ${response.status}`
    );
  } catch {
    return `Error ${response.status}`;
  }
}

export async function getContableNotasCredito(
  filters: ContableNotaCreditoFilters = {}
) {
  const params = new URLSearchParams();

  if (filters.q?.trim()) {
    params.set("q", filters.q.trim());
  }

  if (filters.estado?.trim()) {
    params.set("estado", filters.estado);
  }

  if (filters.tipo?.trim()) {
    params.set("tipo", filters.tipo);
  }

  if (filters.terceroId?.trim()) {
    params.set("terceroId", filters.terceroId);
  }

  const response = await fetch(
    params.size > 0
      ? `${NOTAS_CREDITO_API_URL}?${params.toString()}`
      : NOTAS_CREDITO_API_URL,
    {
      cache: "no-store",
      credentials: "include",
    }
  );

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const data = (await response.json()) as ContableNotaCreditoApiRecord[];
  return data.map(toNotaCredito);
}

export async function getContableNotaCreditoById(id: string) {
  const response = await fetch(`${NOTAS_CREDITO_API_URL}/${id}`, {
    cache: "no-store",
    credentials: "include",
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const data = (await response.json()) as ContableNotaCreditoApiRecord;
  return toNotaCredito(data);
}

export async function createContableNotaCredito(
  payload: ContableNotaCreditoMutationInput
) {
  const response = await fetch(NOTAS_CREDITO_API_URL, {
    credentials: "include",
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const data = (await response.json()) as ContableNotaCreditoApiRecord;
  return toNotaCredito(data);
}
