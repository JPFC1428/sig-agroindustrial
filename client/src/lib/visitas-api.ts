import type {
  Visita,
  VisitaViatico,
  VisitaViaticoSoporte,
  VisitaViaticoSoporteUpload,
} from "./types";
import { notifyDashboardDataChanged } from "./dashboard-events";

type VisitaViaticoApiRecord = Omit<VisitaViatico, "fecha"> & {
  fecha: string;
  soporte?: VisitaViaticoSoporte;
};

type VisitaApiRecord = Omit<Visita, "fecha" | "proximaFecha" | "viaticos"> & {
  fecha: string;
  proximaFecha?: string;
  viaticos?: VisitaViaticoApiRecord[];
};

export type VisitaMutationInput = {
  clienteId?: string;
  prospectoId?: string;
  tipo: Visita["tipo"];
  fecha: string | Date;
  hora: string;
  objetivo: string;
  resultado?: string;
  observaciones?: string;
  proximaAccion?: string;
  estado: NonNullable<Visita["estado"]>;
};

export type VisitaViaticoMutationInput = {
  tipoGasto: NonNullable<VisitaViatico["tipoGasto"]>;
  fecha: string | Date;
  valor: number;
  descripcion: string;
  observaciones?: string;
  removeSoporte?: boolean;
  soporte?: VisitaViaticoSoporteUpload;
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

const VISITAS_API_URL = buildApiUrl("/api/visitas");

const JSON_HEADERS = {
  "Content-Type": "application/json",
};

function getDownloadFileName(response: Response, fallback: string) {
  const contentDisposition = response.headers.get("Content-Disposition");

  if (!contentDisposition) {
    return fallback;
  }

  const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);

  if (utf8Match?.[1]) {
    return decodeURIComponent(utf8Match[1]);
  }

  const simpleMatch = contentDisposition.match(/filename=\"?([^\";]+)\"?/i);
  return simpleMatch?.[1] ?? fallback;
}

function toVisita(record: VisitaApiRecord): Visita {
  return {
    ...record,
    fecha: new Date(record.fecha),
    proximaFecha: record.proximaFecha
      ? new Date(record.proximaFecha)
      : undefined,
    viaticos: record.viaticos?.map(viatico => ({
      ...viatico,
      fecha: new Date(viatico.fecha),
    })),
  };
}

function serializePayload(payload: VisitaMutationInput) {
  return {
    ...payload,
    fecha:
      payload.fecha instanceof Date
        ? payload.fecha.toISOString()
        : payload.fecha,
  };
}

function serializeViaticoPayload(payload: VisitaViaticoMutationInput) {
  return {
    ...payload,
    fecha:
      payload.fecha instanceof Date
        ? payload.fecha.toISOString()
        : payload.fecha,
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

export async function getVisitas() {
  const response = await fetch(VISITAS_API_URL, {
    cache: "no-store",
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const data = (await response.json()) as VisitaApiRecord[];
  return data.map(toVisita);
}

export async function getVisitaById(id: string) {
  const response = await fetch(`${VISITAS_API_URL}/${id}`, {
    cache: "no-store",
    credentials: "include",
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const data = (await response.json()) as VisitaApiRecord;
  return toVisita(data);
}

export async function createVisita(payload: VisitaMutationInput) {
  const response = await fetch(VISITAS_API_URL, {
    credentials: "include",
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify(serializePayload(payload)),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const data = (await response.json()) as VisitaApiRecord;
  const visita = toVisita(data);
  notifyDashboardDataChanged();
  return visita;
}

export async function updateVisita(id: string, payload: VisitaMutationInput) {
  const response = await fetch(`${VISITAS_API_URL}/${id}`, {
    credentials: "include",
    method: "PUT",
    headers: JSON_HEADERS,
    body: JSON.stringify(serializePayload(payload)),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const data = (await response.json()) as VisitaApiRecord;
  const visita = toVisita(data);
  notifyDashboardDataChanged();
  return visita;
}

export async function deleteVisita(id: string) {
  const response = await fetch(`${VISITAS_API_URL}/${id}`, {
    credentials: "include",
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  notifyDashboardDataChanged();
}

export async function createVisitaViatico(
  visitaId: string,
  payload: VisitaViaticoMutationInput
) {
  const response = await fetch(`${VISITAS_API_URL}/${visitaId}?resource=viaticos`, {
    credentials: "include",
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify(serializeViaticoPayload(payload)),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const data = (await response.json()) as VisitaApiRecord;
  return toVisita(data);
}

export async function updateVisitaViatico(
  visitaId: string,
  viaticoId: string,
  payload: VisitaViaticoMutationInput
) {
  const response = await fetch(
    `${VISITAS_API_URL}/${visitaId}?resource=viaticos&viaticoId=${encodeURIComponent(
      viaticoId
    )}`,
    {
      credentials: "include",
      method: "PUT",
      headers: JSON_HEADERS,
      body: JSON.stringify(serializeViaticoPayload(payload)),
    }
  );

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const data = (await response.json()) as VisitaApiRecord;
  return toVisita(data);
}

export async function deleteVisitaViatico(visitaId: string, viaticoId: string) {
  const response = await fetch(
    `${VISITAS_API_URL}/${visitaId}?resource=viaticos&viaticoId=${encodeURIComponent(
      viaticoId
    )}`,
    {
      credentials: "include",
      method: "DELETE",
    }
  );

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const data = (await response.json()) as VisitaApiRecord;
  return toVisita(data);
}

export function getVisitaViaticoSupportUrl(
  visitaId: string,
  viaticoId: string,
  mode: "view" | "download" = "view"
) {
  const params = new URLSearchParams({
    resource: "viaticos",
    support: "1",
    viaticoId,
    ...(mode === "download" ? { download: "1" } : {}),
  });

  return `${VISITAS_API_URL}/${visitaId}?${params.toString()}`;
}

async function downloadVisitaExport(
  visitaId: string,
  format: "excel" | "pdf"
) {
  const response = await fetch(
    `${VISITAS_API_URL}/${visitaId}?export=${format}`,
    {
      cache: "no-store",
      credentials: "include",
    }
  );

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const extension = format === "excel" ? "xlsx" : "pdf";
  const blob = await response.blob();
  const fileName = getDownloadFileName(
    response,
    `viaticos-${visitaId}.${extension}`
  );
  const objectUrl = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = objectUrl;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(objectUrl);
}

export function downloadVisitaViaticosExcel(visitaId: string) {
  return downloadVisitaExport(visitaId, "excel");
}

export function downloadVisitaViaticosPdf(visitaId: string) {
  return downloadVisitaExport(visitaId, "pdf");
}
