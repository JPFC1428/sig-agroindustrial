import type { Prospecto } from "./types";
import { notifyDashboardDataChanged } from "./dashboard-events";

type ProspectoApiRecord = Omit<
  Prospecto,
  "fechaCaptura" | "proximoSeguimiento"
> & {
  fechaCaptura: string;
  proximoSeguimiento?: string;
};

export type ProspectoMutationInput = {
  nombre: string;
  empresa: string;
  ciudad: string;
  estado: Prospecto["estado"];
  fuente: Prospecto["fuente"];
  email?: string;
  telefono?: string;
  departamento?: string;
  contactoPrincipal?: string;
  cargoContacto?: string;
  fechaCaptura?: string | Date;
  proximoSeguimiento?: string | Date | null;
  probabilidadConversion?: number;
  montoEstimado?: number | null;
  notas?: string;
  asignadoA?: string;
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

const PROSPECTOS_API_URL = buildApiUrl("/api/prospectos");

const JSON_HEADERS = {
  "Content-Type": "application/json",
};

function toProspecto(record: ProspectoApiRecord): Prospecto {
  return {
    ...record,
    fechaCaptura: new Date(record.fechaCaptura),
    proximoSeguimiento: record.proximoSeguimiento
      ? new Date(record.proximoSeguimiento)
      : undefined,
  };
}

function serializePayload(payload: Partial<ProspectoMutationInput>) {
  return {
    ...payload,
    fechaCaptura:
      payload.fechaCaptura instanceof Date
        ? payload.fechaCaptura.toISOString()
        : payload.fechaCaptura,
    proximoSeguimiento:
      payload.proximoSeguimiento instanceof Date
        ? payload.proximoSeguimiento.toISOString()
        : payload.proximoSeguimiento,
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

export async function getProspectos() {
  const response = await fetch(PROSPECTOS_API_URL, {
    cache: "no-store",
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const data = (await response.json()) as ProspectoApiRecord[];
  return data.map(toProspecto);
}

export async function getProspectoById(id: string) {
  const response = await fetch(`${PROSPECTOS_API_URL}/${id}`, {
    cache: "no-store",
    credentials: "include",
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const data = (await response.json()) as ProspectoApiRecord;
  return toProspecto(data);
}

export async function createProspecto(payload: ProspectoMutationInput) {
  const response = await fetch(PROSPECTOS_API_URL, {
    credentials: "include",
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify(serializePayload(payload)),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const data = (await response.json()) as ProspectoApiRecord;
  const prospecto = toProspecto(data);
  notifyDashboardDataChanged();
  return prospecto;
}

export async function updateProspecto(
  id: string,
  payload: Partial<ProspectoMutationInput>
) {
  const response = await fetch(`${PROSPECTOS_API_URL}/${id}`, {
    credentials: "include",
    method: "PUT",
    headers: JSON_HEADERS,
    body: JSON.stringify(serializePayload(payload)),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const data = (await response.json()) as ProspectoApiRecord;
  const prospecto = toProspecto(data);
  notifyDashboardDataChanged();
  return prospecto;
}

export async function deleteProspecto(id: string) {
  const response = await fetch(`${PROSPECTOS_API_URL}/${id}`, {
    credentials: "include",
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  notifyDashboardDataChanged();
}
