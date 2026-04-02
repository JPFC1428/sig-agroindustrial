import type {
  AccentColor,
  AuthUser,
  ThemePreference,
} from "./types";

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

const AUTH_LOGIN_URL = buildApiUrl("/api/auth/login");
const AUTH_LOGOUT_URL = buildApiUrl("/api/auth/logout");
const AUTH_ME_URL = buildApiUrl("/api/auth/me");
const AUTH_PREFERENCES_URL = buildApiUrl("/api/auth/preferences");

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

function parseAuthUser(record: AuthUser) {
  return {
    preferencias: record.preferencias,
    email: record.email,
    id: record.id,
    nombre: record.nombre,
    rol: record.rol,
  } satisfies AuthUser;
}

export async function getCurrentUser() {
  const response = await fetch(AUTH_ME_URL, {
    cache: "no-store",
    credentials: "include",
  });

  if (response.status === 401) {
    return null;
  }

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const data = (await response.json()) as AuthUser;
  return parseAuthUser(data);
}

export async function loginWithPassword(email: string, password: string) {
  const response = await fetch(AUTH_LOGIN_URL, {
    body: JSON.stringify({ email, password }),
    credentials: "include",
    headers: JSON_HEADERS,
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const data = (await response.json()) as AuthUser;
  return parseAuthUser(data);
}

export async function logoutFromSession() {
  const response = await fetch(AUTH_LOGOUT_URL, {
    credentials: "include",
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }
}

export async function updateCurrentUserPreferences(
  themePreference: ThemePreference,
  accentColor: AccentColor
) {
  const response = await fetch(AUTH_PREFERENCES_URL, {
    body: JSON.stringify({ accentColor, themePreference }),
    credentials: "include",
    headers: JSON_HEADERS,
    method: "PUT",
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const data = (await response.json()) as AuthUser;
  return parseAuthUser(data);
}
