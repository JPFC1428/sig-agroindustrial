import type { Cliente } from "./types";
import { notifyDashboardDataChanged } from "./dashboard-events";

type ClienteApiRecord = Omit<Cliente, "fechaRegistro" | "ultimaVisita"> & {
  fechaRegistro: string;
  ultimaVisita?: string;
};

export type ClienteMutationInput = {
  nombre: string;
  empresa: string;
  ciudad: string;
  estado: Cliente["estado"];
  email?: string;
  telefono?: string;
  departamento?: string;
  direccion?: string;
  nit?: string;
  contactoPrincipal?: string;
  cargoContacto?: string;
  tipoCliente?: Cliente["tipoCliente"];
  totalCompras?: number;
  montoTotalCompras?: number;
  notas?: string;
  fechaRegistro?: string | Date;
  ultimaVisita?: string | Date | null;
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

const CLIENTES_API_URL = buildApiUrl("/api/clientes");

const JSON_HEADERS = {
  "Content-Type": "application/json",
};

function toCliente(record: ClienteApiRecord): Cliente {
  return {
    ...record,
    fechaRegistro: new Date(record.fechaRegistro),
    ultimaVisita: record.ultimaVisita
      ? new Date(record.ultimaVisita)
      : undefined,
  };
}

function serializePayload(payload: Partial<ClienteMutationInput>) {
  return {
    ...payload,
    fechaRegistro:
      payload.fechaRegistro instanceof Date
        ? payload.fechaRegistro.toISOString()
        : payload.fechaRegistro,
    ultimaVisita:
      payload.ultimaVisita instanceof Date
        ? payload.ultimaVisita.toISOString()
        : payload.ultimaVisita,
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

export async function getClientes() {
  const response = await fetch(CLIENTES_API_URL, {
    cache: "no-store",
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const data = (await response.json()) as ClienteApiRecord[];
  return data.map(toCliente);
}

export async function getClienteById(id: string) {
  const response = await fetch(`${CLIENTES_API_URL}/${id}`, {
    cache: "no-store",
    credentials: "include",
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const data = (await response.json()) as ClienteApiRecord;
  return toCliente(data);
}

export async function createCliente(payload: ClienteMutationInput) {
  const response = await fetch(CLIENTES_API_URL, {
    credentials: "include",
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify(serializePayload(payload)),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const data = (await response.json()) as ClienteApiRecord;
  const cliente = toCliente(data);
  notifyDashboardDataChanged();
  return cliente;
}

export async function updateCliente(
  id: string,
  payload: Partial<ClienteMutationInput>
) {
  const response = await fetch(`${CLIENTES_API_URL}/${id}`, {
    credentials: "include",
    method: "PUT",
    headers: JSON_HEADERS,
    body: JSON.stringify(serializePayload(payload)),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const data = (await response.json()) as ClienteApiRecord;
  const cliente = toCliente(data);
  notifyDashboardDataChanged();
  return cliente;
}

export async function deleteCliente(id: string) {
  const response = await fetch(`${CLIENTES_API_URL}/${id}`, {
    credentials: "include",
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  notifyDashboardDataChanged();
}
