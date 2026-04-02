import type {
  SertecComercialOrigen,
  SertecOrden,
  SertecOrdenAdjunto,
  SertecOrdenEstado,
  SertecGarantia,
  SertecOrdenHistorial,
} from "./types";

type SertecOrdenAdjuntoApiRecord = Omit<SertecOrdenAdjunto, "createdAt"> & {
  createdAt: string;
};

type SertecGarantiaApiRecord = Omit<
  SertecGarantia,
  "fechaVenta" | "vigenteHasta"
> & {
  fechaVenta?: string;
  vigenteHasta?: string;
};

type SertecOrdenHistorialApiRecord = Omit<SertecOrdenHistorial, "createdAt"> & {
  createdAt: string;
};

type SertecOrdenApiRecord = Omit<
  SertecOrden,
  | "fechaIngreso"
  | "fechaReparacion"
  | "fechaSalida"
  | "createdAt"
  | "updatedAt"
  | "adjuntos"
  | "historial"
  | "garantia"
> & {
  fechaIngreso: string;
  fechaReparacion?: string;
  fechaSalida?: string;
  createdAt: string;
  updatedAt: string;
  garantia?: SertecGarantiaApiRecord;
  adjuntos?: SertecOrdenAdjuntoApiRecord[];
  historial?: SertecOrdenHistorialApiRecord[];
};

type SertecComercialOrigenApiRecord = Omit<
  SertecComercialOrigen,
  "fechaVenta"
> & {
  fechaVenta: string;
};

export type SertecAdjuntoUpload = {
  contentBase64: string;
  descripcion?: string;
  fileName: string;
  fileSize: number;
  mimeType: SertecOrdenAdjunto["tipoMime"];
};

export type SertecOrdenMutationInput = {
  clienteId?: string;
  clienteDocumento?: string;
  clienteNombre: string;
  clienteTelefono?: string;
  cotizacionId?: string;
  cotizacionItemId?: string;
  diagnostico?: string;
  equipoMarca?: string;
  equipoModelo?: string;
  equipoSerial?: string;
  equipoTipo: string;
  fallaReportada: string;
  fechaVenta?: string;
  garantiaMeses?: number;
  observaciones?: string;
  trabajoRealizado?: string;
  adjuntos?: SertecAdjuntoUpload[];
};

export type SertecOrdenTransitionInput = {
  detalle?: string;
  diagnostico?: string;
  observaciones?: string;
  trabajoRealizado?: string;
};

export type SertecOrdenFilters = {
  cliente?: string;
  estado?: SertecOrdenEstado;
  numero?: string;
  serial?: string;
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

const SERTEC_API_URL = buildApiUrl("/api/sertec");

const JSON_HEADERS = {
  "Content-Type": "application/json",
};

function toSertecGarantia(record?: SertecGarantiaApiRecord) {
  if (!record) {
    return undefined;
  }

  return {
    ...record,
    fechaVenta: record.fechaVenta ? new Date(record.fechaVenta) : undefined,
    vigenteHasta: record.vigenteHasta
      ? new Date(record.vigenteHasta)
      : undefined,
  };
}

function toSertecOrden(record: SertecOrdenApiRecord): SertecOrden {
  return {
    ...record,
    fechaIngreso: new Date(record.fechaIngreso),
    fechaReparacion: record.fechaReparacion
      ? new Date(record.fechaReparacion)
      : undefined,
    fechaSalida: record.fechaSalida ? new Date(record.fechaSalida) : undefined,
    createdAt: new Date(record.createdAt),
    garantia: toSertecGarantia(record.garantia),
    updatedAt: new Date(record.updatedAt),
    adjuntos: record.adjuntos?.map(adjunto => ({
      ...adjunto,
      createdAt: new Date(adjunto.createdAt),
    })),
    historial: record.historial?.map(evento => ({
      ...evento,
      createdAt: new Date(evento.createdAt),
    })),
  };
}

function toSertecComercialOrigen(
  record: SertecComercialOrigenApiRecord
): SertecComercialOrigen {
  return {
    ...record,
    fechaVenta: new Date(record.fechaVenta),
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

export async function getSertecOrdenes(filters: SertecOrdenFilters = {}) {
  const params = new URLSearchParams();

  if (filters.numero?.trim()) {
    params.set("numero", filters.numero.trim());
  }

  if (filters.cliente?.trim()) {
    params.set("cliente", filters.cliente.trim());
  }

  if (filters.serial?.trim()) {
    params.set("serial", filters.serial.trim());
  }

  if (filters.estado?.trim()) {
    params.set("estado", filters.estado);
  }

  const response = await fetch(
    params.size > 0 ? `${SERTEC_API_URL}?${params.toString()}` : SERTEC_API_URL,
    {
    cache: "no-store",
    credentials: "include",
    }
  );

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const data = (await response.json()) as SertecOrdenApiRecord[];
  return data.map(toSertecOrden);
}

export async function getSertecComercialOrigenes() {
  const response = await fetch(
    `${SERTEC_API_URL}?resource=comercial-origenes`,
    {
      cache: "no-store",
      credentials: "include",
    }
  );

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const data = (await response.json()) as SertecComercialOrigenApiRecord[];
  return data.map(toSertecComercialOrigen);
}

export async function getSertecOrdenById(id: string) {
  const response = await fetch(`${SERTEC_API_URL}/${id}`, {
    cache: "no-store",
    credentials: "include",
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const data = (await response.json()) as SertecOrdenApiRecord;
  return toSertecOrden(data);
}

export async function createSertecOrden(payload: SertecOrdenMutationInput) {
  const response = await fetch(SERTEC_API_URL, {
    credentials: "include",
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const data = (await response.json()) as SertecOrdenApiRecord;
  return toSertecOrden(data);
}

export async function transitionSertecOrden(
  id: string,
  estado: "reparacion" | "salida",
  payload: SertecOrdenTransitionInput = {}
) {
  const response = await fetch(
    `${SERTEC_API_URL}/${id}?transition=${encodeURIComponent(estado)}`,
    {
      credentials: "include",
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify(payload),
    }
  );

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const data = (await response.json()) as SertecOrdenApiRecord;
  return toSertecOrden(data);
}

export async function appendSertecAdjuntos(
  ordenId: string,
  payload: { adjuntos: SertecAdjuntoUpload[] }
) {
  const params = new URLSearchParams({
    resource: "adjuntos",
  });
  const response = await fetch(`${SERTEC_API_URL}/${ordenId}?${params.toString()}`, {
    credentials: "include",
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const data = (await response.json()) as SertecOrdenApiRecord;
  return toSertecOrden(data);
}

export function getSertecAdjuntoUrl(
  ordenId: string,
  adjuntoId: string,
  mode: "view" | "download" = "view"
) {
  const params = new URLSearchParams({
    resource: "adjuntos",
    adjuntoId,
    ...(mode === "download" ? { download: "1" } : {}),
  });

  return `${SERTEC_API_URL}/${ordenId}?${params.toString()}`;
}
