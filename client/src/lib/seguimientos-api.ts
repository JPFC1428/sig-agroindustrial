import type { Seguimiento } from "./types";
import { notifyDashboardDataChanged } from "./dashboard-events";

type SeguimientoApiRecord = Omit<
  Seguimiento,
  "fechaVencimiento" | "fecha" | "proximoSeguimiento"
> & {
  fechaVencimiento: string;
  fecha?: string;
  proximoSeguimiento?: string;
};

export type SeguimientoMutationInput = {
  clienteId?: string;
  prospectoId?: string;
  cotizacionId?: string;
  tipo?: Seguimiento["tipo"];
  fechaVencimiento?: string | Date;
  observaciones?: string;
  estado?: NonNullable<Seguimiento["estado"]>;
  completado?: boolean;
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

const SEGUIMIENTOS_API_URL = buildApiUrl("/api/seguimientos");

const JSON_HEADERS = {
  "Content-Type": "application/json",
};

function toSeguimiento(record: SeguimientoApiRecord): Seguimiento {
  const fechaVencimiento = new Date(record.fechaVencimiento);

  return {
    ...record,
    fechaVencimiento,
    fecha: record.fecha ? new Date(record.fecha) : fechaVencimiento,
    proximoSeguimiento: record.proximoSeguimiento
      ? new Date(record.proximoSeguimiento)
      : fechaVencimiento,
  };
}

function serializePayload(payload: SeguimientoMutationInput) {
  return {
    ...payload,
    fechaVencimiento:
      payload.fechaVencimiento instanceof Date
        ? payload.fechaVencimiento.toISOString()
        : payload.fechaVencimiento,
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

export async function getSeguimientos() {
  const response = await fetch(SEGUIMIENTOS_API_URL, {
    cache: "no-store",
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const data = (await response.json()) as SeguimientoApiRecord[];
  return data.map(toSeguimiento);
}

export async function getSeguimientoById(id: string) {
  const response = await fetch(`${SEGUIMIENTOS_API_URL}/${id}`, {
    cache: "no-store",
    credentials: "include",
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const data = (await response.json()) as SeguimientoApiRecord;
  return toSeguimiento(data);
}

export async function createSeguimiento(payload: SeguimientoMutationInput) {
  const response = await fetch(SEGUIMIENTOS_API_URL, {
    credentials: "include",
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify(serializePayload(payload)),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const data = (await response.json()) as SeguimientoApiRecord;
  const seguimiento = toSeguimiento(data);
  notifyDashboardDataChanged();
  return seguimiento;
}

export async function updateSeguimiento(
  id: string,
  payload: SeguimientoMutationInput
) {
  const response = await fetch(`${SEGUIMIENTOS_API_URL}/${id}`, {
    credentials: "include",
    method: "PUT",
    headers: JSON_HEADERS,
    body: JSON.stringify(serializePayload(payload)),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const data = (await response.json()) as SeguimientoApiRecord;
  const seguimiento = toSeguimiento(data);
  notifyDashboardDataChanged();
  return seguimiento;
}

export async function deleteSeguimiento(id: string) {
  const response = await fetch(`${SEGUIMIENTOS_API_URL}/${id}`, {
    credentials: "include",
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  notifyDashboardDataChanged();
}
