import type { ContableArchivoDocumento } from "./types";

type ContableArchivoDocumentoApiRecord = Omit<
  ContableArchivoDocumento,
  "fecha"
> & {
  fecha: string;
};

export type ContableArchivoFilters = {
  fechaDesde?: string;
  fechaHasta?: string;
  tercero?: string;
  tipoDocumento?: ContableArchivoDocumento["tipoDocumento"];
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

function resolveSupportUrl(urlValue?: string) {
  if (!urlValue) {
    return undefined;
  }

  if (/^https?:\/\//i.test(urlValue)) {
    return urlValue;
  }

  return buildApiUrl(urlValue);
}

const CONTABLE_ARCHIVO_API_URL = buildApiUrl("/api/contable/archivo");

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

function toContableArchivoDocumento(
  record: ContableArchivoDocumentoApiRecord
): ContableArchivoDocumento {
  return {
    ...record,
    fecha: parseDateOnly(record.fecha),
    soporteViewUrl: resolveSupportUrl(record.soporteViewUrl),
    soporteDownloadUrl: resolveSupportUrl(record.soporteDownloadUrl),
  };
}

export async function getContableArchivo(
  filters: ContableArchivoFilters = {}
) {
  const params = new URLSearchParams();

  if (filters.tipoDocumento) {
    params.set("tipoDocumento", filters.tipoDocumento);
  }

  if (filters.tercero?.trim()) {
    params.set("tercero", filters.tercero.trim());
  }

  if (filters.fechaDesde?.trim()) {
    params.set("fechaDesde", filters.fechaDesde.trim());
  }

  if (filters.fechaHasta?.trim()) {
    params.set("fechaHasta", filters.fechaHasta.trim());
  }

  const response = await fetch(
    params.size > 0
      ? `${CONTABLE_ARCHIVO_API_URL}?${params.toString()}`
      : CONTABLE_ARCHIVO_API_URL,
    {
      cache: "no-store",
      credentials: "include",
    }
  );

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const data = (await response.json()) as ContableArchivoDocumentoApiRecord[];
  return data.map(toContableArchivoDocumento);
}
