import type {
  Usuario,
  UsuarioRol,
} from "./types";

type UserApiRecord = {
  activo: boolean;
  createdAt: string;
  email: string;
  id: string;
  nombre: string;
  preferencias: Usuario["preferencias"];
  rol: UsuarioRol;
  ultimoLoginAt?: string;
  updatedAt: string;
};

export type UserMutationInput = {
  activo?: boolean;
  email: string;
  nombre: string;
  password: string;
  rol: UsuarioRol;
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

const USERS_API_URL = buildApiUrl("/api/users");

const JSON_HEADERS = {
  "Content-Type": "application/json",
};

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

function toUsuario(record: UserApiRecord): Usuario {
  return {
    activo: record.activo,
    createdAt: new Date(record.createdAt),
    email: record.email,
    id: record.id,
    nombre: record.nombre,
    preferencias: record.preferencias,
    rol: record.rol,
    ultimoLoginAt: record.ultimoLoginAt
      ? new Date(record.ultimoLoginAt)
      : undefined,
    updatedAt: new Date(record.updatedAt),
  };
}

export async function getUsers() {
  const response = await fetch(USERS_API_URL, {
    cache: "no-store",
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const data = (await response.json()) as UserApiRecord[];
  return data.map(toUsuario);
}

export async function createUser(payload: UserMutationInput) {
  const response = await fetch(USERS_API_URL, {
    body: JSON.stringify(payload),
    credentials: "include",
    headers: JSON_HEADERS,
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const data = (await response.json()) as UserApiRecord;
  return toUsuario(data);
}
